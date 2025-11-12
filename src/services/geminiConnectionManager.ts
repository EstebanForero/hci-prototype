/**
 * Gemini Connection Manager Service
 * Handles all WebSocket and audio technical implementation details
 */

import { createGeminiWebSocket } from '../utils/geminiWebSocket';
import { createToolExecutionManager } from '../utils/toolExecution';
import { createFunctionDeclarations } from '../utils/toolExecution';
import { extractAudioFromMessage } from '../utils/audioCapture';
import { AudioStreamManager } from '../utils/audioStreamManager';

export interface ConnectionCallbacks {
  onReady: () => void;
  onError: (error: string) => void;
  onMessage: (message: any) => void;
  onTranscription: (text: string) => void;
  onToolCall: (toolCalls: any[]) => void;
  onAudioChunk: (audioData: string, isFirstChunk: boolean) => void;
  onTurnComplete: () => void;
  onStopWash?: (reason?: string) => void;
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
  private isConnected: boolean = false;

  constructor(private callbacks: ConnectionCallbacks, private onStopWashCallback?: (reason?: string) => void) {}

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
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        this.callbacks.onError('Please add your Gemini API key to .env file');
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
          console.log('Gemini Live connected');
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
    console.log('🔍 Processing Gemini response:', JSON.stringify(message, null, 2));

    // Handle setup completion
    if (message.setup_complete || message.setupComplete) {
      console.log('✅ Setup complete');
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
      console.log(`🔧 Processing ${content.toolCalls.length} tool calls`);
      this.callbacks.onToolCall(content.toolCalls);
    }

    // Handle text responses
    if (content.textParts.length > 0) {
      const combinedText = content.textParts.join(' ');
      if (combinedText.trim()) {
        console.log('💬 Received text response:', combinedText.substring(0, 100) + '...');
        this.callbacks.onMessage({ text: combinedText, type: 'assistant' });
      }
    }

    // Handle audio responses - REAL-TIME STREAMING
    if (content.audioParts.length > 0) {
      console.log(`🎉 Found ${content.audioParts.length} audio chunk(s)!`);
      content.audioParts.forEach((audioData, index) => {
        console.log(`🔊 🎵 REAL-TIME AUDIO CHUNK ${index + 1}: ${audioData.length} chars`);
        this.callbacks.onAudioChunk(audioData, index === 0);
      });
    } else {
      console.log('🔍 No audio chunks found in this message');
      // Log available keys for debugging
      console.log('🔍 Available message keys:', Object.keys(message));

      // Look for any potential audio data in different formats
      const messageStr = JSON.stringify(message);
      if (messageStr.includes('data') || messageStr.includes('audio')) {
        console.log('🔍 Message contains potential audio data - checking deeper...');

        // Try to find any base64-like strings
        const base64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/g;
        const matches = messageStr.match(base64Pattern);
        if (matches && matches.length > 0) {
          console.log(`🔍 Found ${matches.length} potential base64 strings`);
          matches.forEach((match, i) => {
            console.log(`🔍 Base64 ${i + 1}: ${match.substring(0, 50)}... (${match.length} chars)`);
          });

          // Try to play the first match as audio
          console.log('🧪 Trying to play first base64 match as audio...');
          this.callbacks.onAudioChunk(matches[0], true);
        }
      }
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
    if (!this.isConnected || !this.wsManager?.websocket?.readyState === WebSocket.OPEN) {
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
    // Add to buffer instead of playing immediately
    this.audioBuffer.push(base64Audio);

    // Start playing sequence if this is the first chunk and we're not already playing
    if (isFirstChunk && !this.isPlayingSequence) {
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

    // Limit buffer size to prevent memory issues (increase limit)
    if (this.audioBuffer.length > 500) {
      console.log('🔊 Buffer overflow protection: trimming buffer from', this.audioBuffer.length, 'to 500 chunks');
      this.audioBuffer = this.audioBuffer.slice(-500); // Keep last 500 chunks
    }

    const base64Audio = this.audioBuffer.shift()!; // Get next chunk

    try {
      // Convert base64 to PCM data
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));
      const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Convert 16-bit PCM to float32 with slight attenuation to prevent clipping
      const attenuationFactor = 0.8; // Reduce volume slightly to prevent distortion
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = (pcmData[i] / 32768.0) * attenuationFactor;
      }

      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume * 0.3; // Lower overall volume to prevent distortion

      // Create and configure audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Use Web Audio API scheduling instead of setTimeout for precise timing
      const chunkDuration = audioBuffer.duration; // Duration in seconds
      const currentTime = this.audioContext.currentTime;

      // Schedule this chunk to play at the correct time
      const playTime = this.nextPlayTime !== null ? this.nextPlayTime : currentTime + 0.01; // Small initial delay
      source.start(playTime);

      // Calculate when the next chunk should play (with tiny gap to prevent overlap)
      this.nextPlayTime = playTime + chunkDuration + 0.001; // 1ms gap between chunks

      // Schedule the next chunk using the Web Audio API timing
      source.onended = () => {
        // Use setTimeout only as a fallback for reliability
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
   * Fallback audio chunk player (using the working logic from monolithic version)
   */
  private playAudioChunkFallback(base64Audio: string, isFirstChunk: boolean, volume: number): void {
    if (!this.audioContext) return;

    // Stop any currently playing audio to prevent overlap
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
      this.currentAudioSource = null;
    }

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));
      const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      // Apply gentle fade-in only for the very first chunk
      if (isFirstChunk && audioBuffer.length > 100) {
        const fadeLength = Math.min(100, audioBuffer.length);
        for (let i = 0; i < fadeLength; i++) {
          const fadeGain = i / fadeLength;
          channelData[i] *= fadeGain;
        }
      }

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume * 0.5; // Moderate volume

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Keep reference to prevent overlap
      this.currentAudioSource = source;

      source.onended = () => {
        this.currentAudioSource = null;
      };

      source.start();
    } catch (error) {
      console.error('❌ Error in fallback audio playback:', error);
    }
  }

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