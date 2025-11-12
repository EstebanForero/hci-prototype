/**
 * Gemini Live WebSocket Connection Management
 * Handles connection, reconnection, message parsing, and communication with Gemini Live API
 */

import {
  GeminiSetupMessage,
  RealtimeInputMessage,
  ToolResponseMessage,
  GeminiWebSocketMessage,
  WebSocketState,
  DebugInfo,
  MessageType
} from '../types/gemini';

export interface WebSocketCallbacks {
  onOpen: () => void;
  onMessage: (message: GeminiWebSocketMessage) => void;
  onError: (error: Event) => void;
  onClose: (event: CloseEvent) => void;
  onStateChange: (state: WebSocketState) => void;
  onDebugLog?: (debugInfo: DebugInfo) => void;
}

export interface GeminiConnectionConfig {
  apiKey: string;
  model?: string;
  voiceName?: string;
  debugLogsEnabled?: boolean;
  systemInstruction?: string;
  functionDeclarations?: any[];
}

export class GeminiWebSocketManager {
  private websocket: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private callbacks: WebSocketCallbacks;
  private config: GeminiConnectionConfig;
  private state: WebSocketState;
  private debugLogsEnabled: boolean;

  constructor(callbacks: WebSocketCallbacks, config: GeminiConnectionConfig) {
    this.callbacks = callbacks;
    this.config = {
      model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
      voiceName: 'Kore',
      debugLogsEnabled: false,
      ...config
    };
    this.debugLogsEnabled = this.config.debugLogsEnabled || false;
    this.state = {
      isConnected: false,
      isConnecting: false,
      error: null,
      lastErrorTime: null
    };
  }

  private log(message: string, type: MessageType = 'info', data?: any): void {
    const debugInfo: DebugInfo = {
      timestamp: new Date(),
      type,
      message,
      data
    };

    if (this.debugLogsEnabled) {
      console.log(`🔌 GeminiWS: ${message}`, data || '');
    }

    this.callbacks.onDebugLog?.(debugInfo);
  }

  private updateState(newState: Partial<WebSocketState>): void {
    this.state = { ...this.state, ...newState };
    this.callbacks.onStateChange(this.state);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createSetupMessage(): GeminiSetupMessage {
    const { model, voiceName, systemInstruction, functionDeclarations } = this.config;

    return {
      setup: {
        model: model || 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        generation_config: {
          response_modalities: ['AUDIO'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: voiceName || 'Kore'
              }
            }
          }
        },
        system_instruction: {
          parts: [{
            text: systemInstruction || 'You are a helpful AI assistant.'
          }]
        },
        tools: [{
          function_declarations: functionDeclarations || []
        }]
      }
    };
  }

  private handleOpen = (): void => {
    this.log('WebSocket connection opened', 'setup');
    this.updateState({
      isConnected: true,
      isConnecting: false,
      error: null,
      lastErrorTime: null
    });

    // Session ID generated for debugging purposes

    // Send setup message
    const setupMessage = this.createSetupMessage();
    this.log('Sending setup message', 'setup', setupMessage);

    try {
      this.websocket!.send(JSON.stringify(setupMessage));
      this.callbacks.onOpen();
    } catch (error) {
      this.log(`Failed to send setup message: ${error}`, 'error', error);
      this.handleSetupError(new Error('Failed to send setup message'));
    }
  };

  private handleMessage = (event: MessageEvent): void => {
    const processMessage = async () => {
      try {
        let message: GeminiWebSocketMessage;

        this.log('Received WebSocket message', 'info', {
          type: typeof event.data,
          size: typeof event.data === 'string' ? event.data.length : (event.data as Blob).size
        });

        // Handle different message types
        if (typeof event.data === 'string') {
          message = JSON.parse(event.data);
        } else if (event.data instanceof Blob) {
          // Try to decode blob as text first
          try {
            const text = await event.data.text();
            message = JSON.parse(text);
          } catch (textError) {
            this.log('Blob is not text, treating as binary audio', 'info');
            // Create a placeholder message for binary audio
            message = { binaryAudio: event.data };
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Try to decode ArrayBuffer as text
          try {
            const text = new TextDecoder().decode(event.data);
            message = JSON.parse(text);
          } catch (textError) {
            this.log('ArrayBuffer is not text, treating as binary audio', 'info');
            // Create a placeholder message for binary audio
            message = { binaryAudio: event.data };
          }
        } else {
          this.log('Unknown message type', 'error', { dataType: typeof event.data });
          return;
        }

        this.log('Processed message', 'info', message);
        this.callbacks.onMessage(message);

      } catch (error) {
        this.log(`Error parsing message: ${error}`, 'error', error);
      }
    };

    processMessage();
  };

  private handleError = (error: Event): void => {
    this.log(`WebSocket error: ${error}`, 'error', error);
    this.updateState({
      isConnected: false,
      isConnecting: false,
      error: 'Failed to connect to Gemini Live API',
      lastErrorTime: Date.now()
    });
    this.callbacks.onError(error);
  };

  private handleSetupError = (error: Error): void => {
    this.log(`Setup error: ${error}`, 'error', error);
    this.updateState({
      isConnected: false,
      isConnecting: false,
      error: 'Failed to setup WebSocket connection',
      lastErrorTime: Date.now()
    });

    // Create a synthetic Event for compatibility
    const syntheticEvent = new Event('error');
    this.callbacks.onError(syntheticEvent);
  };

  private handleClose = (event: CloseEvent): void => {
    this.log(`WebSocket closed: ${event.code} - ${event.reason}`, 'info');

    this.updateState({
      isConnected: false,
      isConnecting: false
    });

    // Check for quota exceeded error
    if (event.code === 1011 || event.reason.includes('quota')) {
      this.log('API quota exceeded', 'error');
      this.updateState({
        error: 'API quota exceeded. Please check your billing at https://aistudio.google.com/',
        lastErrorTime: Date.now()
      });
      this.callbacks.onClose(event);
      return;
    }

    this.callbacks.onClose(event);

    // Auto-reconnect if not intentionally closed
    if (event.code !== 1000) {
      this.log('Scheduling reconnection', 'info');
      this.scheduleReconnect();
    }
  };

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.log('Attempting to reconnect', 'info');
      this.connect();
    }, 5000);
  }

  /**
   * Connect to Gemini Live WebSocket API
   */
  public connect(): void {
    // Prevent duplicate connections
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.log('Already connected, skipping connection', 'warning');
      return;
    }

    // Close existing connection if any
    if (this.websocket) {
      this.log('Closing existing connection', 'info');
      this.websocket.close();
      this.websocket = null;
    }

    const apiKey = this.config.apiKey;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      const error = 'Please add your Gemini API key';
      this.log(error, 'error');
      this.updateState({
        isConnected: false,
        isConnecting: false,
        error,
        lastErrorTime: Date.now()
      });
      return;
    }

    this.updateState({ isConnecting: true, error: null });

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    this.log(`Creating WebSocket connection to: ${wsUrl.replace(/key=.*/, 'key=***')}`, 'setup');

    try {
      this.websocket = new WebSocket(wsUrl);
      this.websocket.onopen = this.handleOpen;
      this.websocket.onmessage = this.handleMessage;
      this.websocket.onerror = this.handleError;
      this.websocket.onclose = this.handleClose;
    } catch (error) {
      this.log(`Failed to create WebSocket: ${error}`, 'error', error);
      this.handleSetupError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Disconnect from Gemini Live WebSocket API
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.websocket) {
      this.log('Disconnecting WebSocket', 'info');
      this.websocket.close(1000, 'User initiated disconnect');
      this.websocket = null;
    }

    this.updateState({
      isConnected: false,
      isConnecting: false,
      error: null
    });
  }

  /**
   * Send text message to Gemini
   */
  public sendText(text: string): boolean {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send text: WebSocket not connected', 'warning');
      return false;
    }

    const message: RealtimeInputMessage = {
      realtime_input: {
        text
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      this.log(`Sent text message: ${text}`, 'info');
      return true;
    } catch (error) {
      this.log(`Failed to send text: ${error}`, 'error', error);
      return false;
    }
  }

  /**
   * Send audio data to Gemini
   */
  public sendAudio(base64Audio: string, mimeType: string = "audio/pcm;rate=48000"): boolean {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send audio: WebSocket not connected', 'warning');
      return false;
    }

    const message: RealtimeInputMessage = {
      realtime_input: {
        audio: {
          data: base64Audio,
          mimeType
        }
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.log(`Failed to send audio: ${error}`, 'error', error);
      return false;
    }
  }

  /**
   * Send audio stream end signal
   */
  public sendAudioStreamEnd(): boolean {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send audio stream end: WebSocket not connected', 'warning');
      return false;
    }

    const message: RealtimeInputMessage = {
      realtime_input: {
        audio_stream_end: true
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      this.log('Sent audio stream end signal', 'info');
      return true;
    } catch (error) {
      this.log(`Failed to send audio stream end: ${error}`, 'error', error);
      return false;
    }
  }

  /**
   * Send tool response to Gemini
   */
  public sendToolResponse(functionResponses: any[]): boolean {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send tool response: WebSocket not connected', 'warning');
      return false;
    }

    const message: ToolResponseMessage = {
      tool_response: {
        function_responses: functionResponses
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      this.log(`Sent tool responses: ${functionResponses.length} functions`, 'info');
      return true;
    } catch (error) {
      this.log(`Failed to send tool response: ${error}`, 'error', error);
      return false;
    }
  }

  /**
   * Get current connection state
   */
  public getState(): WebSocketState {
    return { ...this.state };
  }

  /**
   * Check if WebSocket is ready
   */
  public isReady(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get WebSocket ready state
   */
  public getReadyState(): number {
    return this.websocket?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<GeminiConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.debugLogsEnabled = this.config.debugLogsEnabled || false;
    this.log('Configuration updated', 'info', newConfig);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.disconnect();
    this.callbacks = { onOpen: () => {}, onMessage: () => {}, onError: () => {}, onClose: () => {}, onStateChange: () => {} };
  }
}

/**
 * Create a Gemini WebSocket manager with default configuration
 */
export function createGeminiWebSocket(
  callbacks: WebSocketCallbacks,
  config: GeminiConnectionConfig
): GeminiWebSocketManager {
  return new GeminiWebSocketManager(callbacks, config);
}