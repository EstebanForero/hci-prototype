/**
 * Gemini Audio Service
 * Handles all audio recording and playback technical implementation details
 */

import { resampleTo16kHz } from '../utils/audioCapture';

export interface AudioCallbacks {
  onAudioData: (base64Audio: string) => void;
  onAudioLevel: (level: number) => void;
  onError: (error: string) => void;
}

export class GeminiAudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private callbacks: AudioCallbacks | null = null;
  private isRecording: boolean = false;
  private audioLevel: number = 0;
  private debugLogsEnabled: boolean = false;

  constructor(debugLogsEnabled: boolean = false) {
    this.debugLogsEnabled = debugLogsEnabled;
  }

  /**
   * Initialize audio context
   */
  async initializeAudioContext(): Promise<boolean> {
    try {
      // Create or resume audio context
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('🔊 Audio service context ready:', this.audioContext.state);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize audio service context:', error);
      return false;
    }
  }

  /**
   * Ensure audio context is ready (with retry mechanism)
   */
  private async ensureAudioContextReady(): Promise<boolean> {
    if (!this.audioContext) {
      const initialized = await this.initializeAudioContext();
      if (!initialized) {
        this.callbacks?.onError('Failed to initialize audio context');
        return false;
      }
    }

    // Resume audio context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Wait for context to be ready with retry mechanism
    let retryCount = 0;
    const maxRetries = 10;
    while (this.audioContext.state !== 'running' && retryCount < maxRetries) {
      if (this.debugLogsEnabled) {
        console.log(`⏳ Waiting for audio context to be ready... (${retryCount + 1}/${maxRetries}) - Current state: ${this.audioContext.state}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      } else if (this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      retryCount++;
    }

    if (this.audioContext.state !== 'running') {
      console.error('❌ Failed to get audio context to running state:', this.audioContext.state);
      this.callbacks?.onError('Audio context failed to initialize. Please try again.');
      return false;
    }

    console.log('🎤 Audio context ready:', this.audioContext.state);
    return true;
  }

  /**
   * Start voice recording
   */
  async startRecording(callbacks: AudioCallbacks): Promise<boolean> {
    if (this.isRecording) {
      console.log('🎤 Already recording');
      return true;
    }

    this.callbacks = callbacks;

    // Ensure audio context is ready
    const contextReady = await this.ensureAudioContextReady();
    if (!contextReady) {
      return false;
    }

    try {
      // Get microphone access with Gemini Live compatible settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000  // Gemini Live expects 16kHz
        }
      });

      this.mediaStream = stream;

      // Create audio processing pipeline
      this.source = this.audioContext!.createMediaStreamSource(stream);
      this.processor = this.audioContext!.createScriptProcessor(4096, 1, 1);

      let chunkCounter = 0;

      this.processor.onaudioprocess = (event) => {
        if (!this.callbacks) return;

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Calculate audio level for visualization
        let sum = 0;
        let maxSample = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          sum += abs;
          maxSample = Math.max(maxSample, abs);
        }

        const average = sum / inputData.length;
        const level = Math.min(100, average * 1000); // Scale for visualization
        this.audioLevel = level;

        // Update audio level
        this.callbacks.onAudioLevel(level);

        // Debug logging for first few chunks
        if (this.debugLogsEnabled && chunkCounter < 3) {
          console.log(`🎤 Audio chunk #${chunkCounter}: level=${level.toFixed(1)}, max=${maxSample.toFixed(4)}`);
        }

        // Resample audio to 16kHz for Gemini Live
        const resampledData = resampleTo16kHz(inputData, this.audioContext!.sampleRate);

        // Convert Float32Array to 16-bit PCM (required by Gemini Live)
        const pcmData = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32767));
        }

        // Convert PCM to base64
        const bytes = new Uint8Array(pcmData.buffer);
        const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(bytes)));

        // Send audio data via callback
        this.callbacks.onAudioData(base64Audio);

        chunkCounter++;
      };

      // Connect audio nodes: source -> processor -> destination
      // Note: We connect to destination to ensure the processor runs
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext!.destination);

      this.isRecording = true;
      console.log('🎤 ✅ Voice recording started');
      console.log(`🎤 Sample rate: ${this.audioContext!.sampleRate}Hz`);
      console.log(`🎤 Buffer size: 4096 samples`);
      console.log('🎤 Ready to capture audio');
      console.log('🎤 WARNING: You may hear echo - this is normal and required for processing');

      return true;

    } catch (error) {
      console.error('❌ Failed to start voice recording:', error);
      this.callbacks?.onError('Failed to start voice input');
      return false;
    }
  }

  /**
   * Stop voice recording
   */
  stopRecording(): void {
    if (!this.isRecording) {
      console.log('🎤 Not currently recording');
      return;
    }

    console.log('🛑 Stopping voice recording...');

    // Disconnect audio nodes
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isRecording = false;
    this.audioLevel = 0;
    console.log('🎤 ✅ Voice recording stopped');
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get current audio level
   */
  getAudioLevel(): number {
    return this.audioLevel;
  }

  /**
   * Get audio context state
   */
  getAudioContextState(): string {
    return this.audioContext?.state || 'not-initialized';
  }

  /**
   * Get audio context sample rate
   */
  getSampleRate(): number {
    return this.audioContext?.sampleRate || 0;
  }

  /**
   * Set debug logging
   */
  setDebugLogs(enabled: boolean): void {
    this.debugLogsEnabled = enabled;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopRecording();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.callbacks = null;
  }
}