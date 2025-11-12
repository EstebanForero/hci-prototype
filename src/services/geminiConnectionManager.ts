/**
 * Gemini Connection Manager Service
 * Handles all WebSocket and audio technical implementation details
 */

import { createGeminiWebSocket } from '../utils/geminiWebSocket';
import { createToolExecutionManager } from '../utils/toolExecution';
import { createFunctionDeclarations } from '../utils/toolExecution';
import { AudioStreamManager } from '../utils/audioStreamManager';
import { AudioProcessor } from '../utils/audioProcessor';
import { GeminiValidator } from '../utils/validation';

export interface ConnectionCallbacks {
  onReady: () => void;
  onError: (error: string) => void;
  onMessage: (message: any) => void;
  onTranscription: (text: string) => void;
  onToolCall: (toolCalls: any[]) => void;
  onAudioChunk: (audioData: string, isFirstChunk: boolean) => void;
  onTurnComplete: () => void;
  onStopWash?: (reason?: string) => void;
  onGetConsumption?: (config: any) => void;
}

export interface SystemStatus {
  overallHealth: number;
  isActive: boolean;
  currentCycle: number;
  totalCyclesScheduled: number;
  timeRemaining: string;
  parts: any[];
}

export class GeminiConnectionManager {
  private wsManager: any = null;
  private audioStreamManager: AudioStreamManager | null = null;
  private toolManager: any = null;
  private audioContext: AudioContext | null = null;
  private audioProcessor: AudioProcessor;
  private isConnected: boolean = false;

  constructor(
    private callbacks: ConnectionCallbacks,
    private onStopWashCallback?: (reason?: string) => void,
    private onGetConsumptionCallback?: (config: any) => void
  ) {
    this.audioProcessor = new AudioProcessor({
      volume: 0.5,
      attenuationFactor: 0.9,
      sampleRate: 24000
    });
  }

  /**
   * Initialize audio context
   */
  async initializeAudioContext(): Promise<boolean> {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        console.log('🔊 Creating audio context...');
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        console.log('🔊 Resuming audio context...');
        await this.audioContext.resume();
      }

      // Initialize audio stream manager
      if (!this.audioStreamManager) {
        this.audioStreamManager = new AudioStreamManager(this.audioContext);
      }

      console.log('🔊 Audio context ready:', this.audioContext.state);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
      return false;
    }
  }

  /**
   * Connect to Gemini Live API
   */
  async connect(
    apiKey: string,
    systemStatus: SystemStatus,
    onStartWash: (config: any) => void,
    onStopWash?: (reason?: string) => void
  ): Promise<boolean> {
    try {
      // Validate inputs
      const keyValidation = GeminiValidator.validateApiKey(apiKey);
      if (!keyValidation.isValid) {
        this.callbacks.onError(keyValidation.error || 'Invalid API key');
        return false;
      }

      const statusValidation = GeminiValidator.validateSystemStatus(systemStatus);
      if (!statusValidation.isValid) {
        this.callbacks.onError(statusValidation.error || 'Invalid system status');
        return false;
      }

      // Store the stop callback
      this.onStopWashCallback = onStopWash;

      // Initialize audio context first
      const audioReady = await this.initializeAudioContext();
      if (!audioReady) {
        this.callbacks.onError('Failed to initialize audio system');
        return false;
      }

      // Create tool execution manager
      this.toolManager = createToolExecutionManager({
        onStartWash: (config: any) => {
          onStartWash(config);
        },
        onStopWash: (reason?: string) => {
          console.log(`🛑 Wash cycle stopped${reason ? ` - ${reason}` : ''}`);
          // Call the main app's stop functionality
          this.onStopWashCallback?.(reason);
        },
        onToolExecuted: (toolName: string, result: any) => {
          console.log(`Tool ${toolName} executed:`, result);
        },
        onToolError: (toolName: string, error: string) => {
          console.error(`Tool ${toolName} error:`, error);
        }
      }, systemStatus);

      // Create WebSocket manager
      this.wsManager = createGeminiWebSocket({
        onOpen: () => {
          this.isConnected = true;
          this.callbacks.onReady();
          // Gemini connected
        },
        onMessage: async (message: any) => {
          await this.handleMessage(message);
        },
        onError: (error: any) => {
          this.isConnected = false;
          this.callbacks.onError('Failed to connect to Gemini Live API');
          console.error('WebSocket error:', error);
        },
        onClose: () => {
          this.isConnected = false;
          console.log('Gemini Live disconnected');
        },
        onStateChange: (state: any) => {
          console.log('WebSocket state changed:', state);
        }
      }, {
        apiKey,
        model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        voiceName: 'Kore',
        debugLogsEnabled: false,
        systemInstruction: this.buildSystemInstruction(systemStatus),
        functionDeclarations: createFunctionDeclarations()
      });

      // Connect to Gemini Live
      this.wsManager.connect();
      return true;

    } catch (err) {
      console.error('Failed to initialize Gemini Live:', err);
      this.callbacks.onError('Failed to initialize Gemini Live. Please check your API key.');
      return false;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(message: any) {
    // Validate message structure
    const validation = GeminiValidator.validateWebSocketMessage(message);
    if (!validation.isValid) {
      console.error('❌ Invalid message:', validation.error);
      return;
    }

    // Handle setup completion
    if (message.setup_complete || message.setupComplete) {
      // Setup complete
      return;
    }

    // Check for any error responses
    if (message.error) {
      console.error('❌ Gemini returned error:', message.error);
      this.callbacks.onError(`Gemini error: ${message.error.message || message.error}`);
      return;
    }

    // Extract content using the working pattern
    const content = this.extractContent(message);

    // Handle tool calls
    if (content.toolCalls.length > 0) {
      console.log(`🔧 Processing ${content.toolCalls.length} tool calls:`, content.toolCalls.map(tc => tc.name || tc.function?.name));
      this.callbacks.onToolCall(content.toolCalls);
    }

    // Handle text responses
    if (content.textParts.length > 0) {
      const combinedText = content.textParts.join(' ');
      if (combinedText.trim()) {
        console.log('💬 Received text response:', combinedText.substring(0, 100) + '...');
        console.log('🎯 This appears to be Gemini responding to tool result');
        this.callbacks.onMessage({ text: combinedText, type: 'assistant' });
      }
    }

    // Handle audio responses - REAL-TIME STREAMING
    if (content.audioParts.length > 0) {
      content.audioParts.forEach((audioData, index) => {
        // Validate each audio chunk
        const audioValidation = this.audioProcessor.validateBase64Audio(audioData);
        if (audioValidation) {
          this.callbacks.onAudioChunk(audioData, index === 0);
        }
      });
    }

    // Handle transcription if available
    if (message.server_content?.output_transcription?.text) {
      const text = message.server_content.output_transcription.text;
      console.log('📝 Transcription:', text);
      this.callbacks.onTranscription(text);
    }

    // Handle turn complete
    if (message.server_content?.turn_complete) {
      console.log('🔄 Turn complete detected');
      this.callbacks.onTurnComplete();
    }
  }

  /**
   * Extract content from Gemini message using the working pattern
   */
  private extractContent(message: any): { textParts: string[], audioParts: string[], toolCalls: any[] } {
    const textParts: string[] = [];
    const audioParts: string[] = [];
    const toolCalls: any[] = [];

    // Helper function to search recursively for content
    const searchRecursively = (obj: any, path: string = '') => {
      if (obj === null || obj === undefined) return;

      // Check for text content
      if (obj.text && typeof obj.text === 'string' && obj.text.trim()) {
        textParts.push(obj.text);
        console.log(`💬 Found text at ${path}: ${obj.text.substring(0, 50)}...`);
      }

      // Check for tool calls (both possible structures)
      if (obj.functionCalls && Array.isArray(obj.functionCalls)) {
        toolCalls.push(...obj.functionCalls);
        console.log(`🔧 Found ${obj.functionCalls.length} tool calls at ${path}`);
      } else if (obj.function_calls && Array.isArray(obj.function_calls)) {
        toolCalls.push(...obj.function_calls);
        console.log(`🔧 Found ${obj.function_calls.length} tool calls at ${path}`);
      }

      // Check for common audio data fields
      const audioFields = ['data', 'audio_data', 'audio', 'inline_data', 'inlineData'];
      for (const field of audioFields) {
        if (obj[field] && typeof obj[field] === 'string' && obj[field].length > 100) {
          audioParts.push(obj[field]);
          console.log(`🎵 Found audio at ${path}.${field}: ${obj[field].length} chars`);
        }
      }

      // Recursively search objects and arrays
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            searchRecursively(obj[key], path ? `${path}.${key}` : key);
          }
        }
      } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          searchRecursively(obj[i], `${path}[${i}]`);
        }
      }
    };

    searchRecursively(message);
    return { textParts, audioParts, toolCalls };
  }

  /**
   * Build system instruction from current status
   */
  private buildSystemInstruction(status: SystemStatus): string {
    return `You are SmartWash Pro AI Assistant. Help users control their washing machine.

Current status: ${status.isActive ? `Running cycle ${status.currentCycle}/${status.totalCyclesScheduled}, ${status.timeRemaining} remaining` : 'Idle'} - Health: ${status.overallHealth}%

Functions available:
- start_wash: Ask clothing type, recommend settings, start cycle
- stop_wash: Stop current cycle immediately
- get_wash_status: Check current progress
- get_current_cycles: Scheduling info
- get_component_states: Health diagnostics

IMPORTANT: Respond directly and concisely. Do not speak your thoughts or planning. Just answer the user's question immediately.`;
  }

  /**
   * Send audio data to Gemini
   */
  sendAudio(base64Audio: string): boolean {
    if (!this.isConnected || !this.wsManager?.websocket || this.wsManager.websocket.readyState !== WebSocket.OPEN) {
      console.log('❌ Cannot send audio - not connected or WebSocket not ready');
      return false;
    }

    // Validate audio data before sending
    if (!this.audioProcessor.validateBase64Audio(base64Audio)) {
      console.error('❌ Invalid audio data, not sending');
      return false;
    }

    const audioMessage = {
      realtime_input: {
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"  // Use 16kHz for input
        }
      }
    };

    try {
      this.wsManager.websocket.send(JSON.stringify(audioMessage));
      return true;
    } catch (error) {
      console.error('Error sending audio:', error);
      // Mark as disconnected if there's an error
      if (error instanceof Error && error.message.includes('WebSocket')) {
        this.isConnected = false;
      }
      return false;
    }
  }

  /**
   * Send text message to Gemini
   */
  sendText(text: string): boolean {
    if (!this.isConnected || !this.wsManager?.websocket || this.wsManager.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const textMessage = {
      realtime_input: {
        text: text
      }
    };

    try {
      this.wsManager.websocket.send(JSON.stringify(textMessage));
      return true;
    } catch (error) {
      console.error('Error sending text:', error);
      // Mark as disconnected if there's an error
      if (error instanceof Error && error.message.includes('WebSocket')) {
        this.isConnected = false;
      }
      return false;
    }
  }

  /**
   * Send audio stream end signal
   */
  sendAudioStreamEnd(): boolean {
    if (!this.isConnected || !this.wsManager?.websocket || this.wsManager.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const audioStreamEndMessage = {
      realtime_input: {
        audio_stream_end: true
      }
    };

    try {
      this.wsManager.websocket.send(JSON.stringify(audioStreamEndMessage));
      console.log('📤 Sent audio_stream_end signal');
      return true;
    } catch (error) {
      console.error('Error sending audio_stream_end:', error);
      // Mark as disconnected if there's an error
      if (error instanceof Error && error.message.includes('WebSocket')) {
        this.isConnected = false;
      }
      return false;
    }
  }

  /**
   * Send tool response
   */
  sendToolResponse(responses: any[]): boolean {
    if (!this.isConnected || !this.wsManager?.websocket || this.wsManager.websocket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not ready for tool response');
      return false;
    }

    // Wrap responses in the correct message format (matching working version)
    const toolResponseMessage = {
      tool_response: {
        function_responses: responses.map(r => ({
          id: r.id,
          name: r.name,
          response: r.response
        }))
      }
    };

    try {
      console.log('🔧 Sending tool responses:', JSON.stringify(toolResponseMessage, null, 2));
      this.wsManager.websocket.send(JSON.stringify(toolResponseMessage));
      console.log('✅ Tool response sent, waiting for Gemini to process and respond...');
      return true;
    } catch (error) {
      console.error('Error sending tool response:', error);
      return false;
    }
  }

  /**
   * Play audio chunk with proper buffering (fixed version)
   */
  playAudioChunk(base64Audio: string, isFirstChunk: boolean = false, volume: number = 0.8): void {
    // Calculate estimated duration
    const estimatedSamples = Math.floor((base64Audio.length * 3) / 4) / 2; // Rough estimate
    const estimatedDuration = estimatedSamples / 24000; // 24kHz sample rate

    console.log(`🎵 Buffering audio chunk: ${estimatedDuration.toFixed(3)}s (${base64Audio.length} chars)`);

    // Add to buffer
    this.audioBuffer.push(base64Audio);

    // Calculate total buffered duration
    const totalBufferedDuration = this.audioBuffer.reduce((total, chunk) => {
      const chunkSamples = Math.floor((chunk.length * 3) / 4) / 2;
      return total + (chunkSamples / 24000);
    }, 0);

    // Start playing if we have enough buffer (0.3s) or if this is the first chunk
    if (!this.isPlayingSequence && (totalBufferedDuration >= 0.3 || isFirstChunk)) {
      console.log(`▶️ Starting playback with ${totalBufferedDuration.toFixed(3)}s buffered`);
      this.isPlayingSequence = true;
      this.nextPlayTime = null; // Reset timing
      this.playNextBufferedChunk(volume);
    }
  }

  /**
   * Play the next chunk from the buffer with proper timing
   */
  private playNextBufferedChunk(volume: number): void {
    if (this.audioBuffer.length === 0) {
      // No more chunks to play
      this.isPlayingSequence = false;
      this.nextPlayTime = null;
      return;
    }

    if (!this.audioContext) {
      console.error('❌ No audio context for playback');
      return;
    }

    // Limit buffer size to prevent memory issues
    if (this.audioBuffer.length > 500) {
      console.log('🔊 Buffer overflow protection: trimming buffer from', this.audioBuffer.length, 'to 500 chunks');
      this.audioBuffer = this.audioBuffer.slice(-500); // Keep last 500 chunks
    }

    const base64Audio = this.audioBuffer.shift()!; // Get next chunk

    // Validate audio data
    const chunkInfo = this.audioProcessor.getAudioChunkInfo(base64Audio);
    if (!chunkInfo.isValid) {
      console.error('❌ Invalid audio chunk data, skipping');
      this.playNextBufferedChunk(volume);
      return;
    }

    try {
      // Convert base64 to PCM using the optimized processor
      const pcmData = this.audioProcessor.base64ToPCM(base64Audio);
      if (pcmData.length === 0) {
        console.error('❌ Empty PCM data, skipping chunk');
        this.playNextBufferedChunk(volume);
        return;
      }

      // Create audio buffer using the processor
      const audioBuffer = this.audioProcessor.pcmToAudioBuffer(pcmData, this.audioContext);
      if (!audioBuffer) {
        console.error('❌ Failed to create audio buffer, skipping chunk');
        this.playNextBufferedChunk(volume);
        return;
      }

      // Play the audio buffer using the processor
      const source = this.audioProcessor.playAudioBuffer(audioBuffer, this.audioContext, volume);
      if (!source) {
        console.error('❌ Failed to play audio buffer, skipping chunk');
        this.playNextBufferedChunk(volume);
        return;
      }

      // Calculate timing for next chunk
      const chunkDuration = audioBuffer.duration;
      const currentTime = this.audioContext.currentTime;

      // Schedule this chunk to play at the correct time
      const playTime = this.nextPlayTime !== null ? this.nextPlayTime : currentTime + 0.01;
      source.start(playTime);

      // Calculate when the next chunk should play (with tiny gap to prevent overlap)
      this.nextPlayTime = playTime + chunkDuration + 0.001; // 1ms gap between chunks

      // Schedule the next chunk
      source.onended = () => {
        if (this.audioBuffer.length > 0) {
          setTimeout(() => {
            this.playNextBufferedChunk(volume);
          }, 5); // Very small delay
        } else {
          // No more chunks
          this.isPlayingSequence = false;
          this.nextPlayTime = null;
        }
      };

      // Log chunk info for debugging
      console.log(`🔊 Playing chunk: ${pcmData.length} samples, ${chunkDuration.toFixed(3)}s duration`);

    } catch (error) {
      console.error('❌ Error playing buffered audio chunk:', error);
      // Continue with next chunk even if this one fails
      if (this.audioBuffer.length > 0) {
        setTimeout(() => {
          this.playNextBufferedChunk(volume);
        }, 10);
      } else {
        this.isPlayingSequence = false;
        this.nextPlayTime = null;
      }
    }
  }

  /**
   * Clear audio buffer (call when turn completes)
   */
  clearAudioBuffer(): void {
    this.audioBuffer = [];
    this.isPlayingSequence = false;
    this.nextPlayTime = null;

    // Stop any currently playing audio
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
      this.currentAudioSource = null;
    }
  }

  // Keep track of currently playing audio to prevent overlap
  private currentAudioSource: AudioBufferSourceNode | null = null;

  // Audio buffering system (like the test.ts approach)
  private audioBuffer: string[] = [];
  private isPlayingSequence: boolean = false;
  private nextPlayTime: number | null = null;

  
  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected && this.wsManager?.websocket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get audio context
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get tool manager
   */
  getToolManager(): any {
    return this.toolManager;
  }

  /**
   * Test audio system - play a simple test tone
   */
  playTestTone(): void {
    if (!this.audioContext) {
      console.error('❌ No audio context for test tone');
      return;
    }

    try {
      console.log('🔔 Playing 440Hz test tone...');

      const testBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 1, this.audioContext.sampleRate);
      const channelData = testBuffer.getChannelData(0);

      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / this.audioContext.sampleRate) * 0.3;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = testBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      console.log('✅ Test tone played successfully');
    } catch (error) {
      console.error('❌ Error playing test tone:', error);
    }
  }

  /**
   * Play a WAV file from URL (for testing with test_complete_response.wav)
   */
  async playTestWAV(url: string = '/test_complete_response.wav'): Promise<void> {
    if (!this.audioContext) {
      console.error('❌ No audio context for WAV playback');
      return;
    }

    try {
      console.log('🎵 Playing test WAV file:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch WAV file: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      console.log('✅ WAV file played successfully');
      console.log(`🎵 Audio details: ${audioBuffer.duration}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} channels`);
    } catch (error) {
      console.error('❌ Error playing WAV file:', error);

      // Try to create the test file if it doesn't exist
      if (error instanceof Error && error.message.includes('404')) {
        console.log('💡 Test WAV file not found. You can add test_complete_response.wav to the public directory.');
      }
    }
  }

  /**
   * Test synthetic PCM audio (like Gemini would send)
   */
  playTestPCMAudio(): void {
    if (!this.audioContext) {
      console.error('❌ No audio context for PCM test');
      return;
    }

    try {
      console.log('🧪 Playing synthetic PCM audio (simulating Gemini)...');

      // Create a 440Hz tone at 24kHz for 1 second (like Gemini audio)
      const sampleRate = 24000;
      const duration = 1;
      const frequency = 440;
      const samples = sampleRate * duration;

      // Create 16-bit PCM data
      const pcmData = new Int16Array(samples);
      for (let i = 0; i < samples; i++) {
        pcmData[i] = Math.floor(Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5 * 32767);
      }

      // Convert to base64 (same as Gemini would send)
      const uint8Array = new Uint8Array(pcmData.buffer);
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

      console.log(`🧪 Created test PCM: ${samples} samples at ${sampleRate}Hz`);
      console.log(`📦 Base64 length: ${base64Data.length}`);

      // Test the exact same playback function we use for Gemini
      this.playAudioChunk(base64Data, true, 0.8);

    } catch (error) {
      console.error('❌ Error testing PCM audio:', error);
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Clear audio buffer before disconnecting
    this.clearAudioBuffer();

    if (this.wsManager) {
      this.wsManager.disconnect();
      this.wsManager = null;
    }

    if (this.audioStreamManager) {
      this.audioStreamManager.cleanup();
      this.audioStreamManager = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isConnected = false;
    this.toolManager = null;
  }
}