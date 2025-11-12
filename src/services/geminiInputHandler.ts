/**
 * Gemini Live Input Handler
 * Manages voice input processing and audio capture
 */

import { resampleTo16kHz } from '../utils/audioCapture';

export interface InputCallbacks {
  onAudioData: (base64Audio: string) => void;
  onAudioLevel: (level: number) => void;
  onTranscript: (transcript: string) => void;
  onError: (error: string) => void;
}

export class GeminiInputHandler {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private callbacks: InputCallbacks | null = null;
  private isRecording: boolean = false;

  constructor() {}

  /**
   * Initialize audio input with proper context
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

      console.log('🔊 Input audio context ready:', this.audioContext.state);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize input audio context:', error);
      return false;
    }
  }

  /**
   * Start voice input recording
   */
  async startRecording(callbacks: InputCallbacks): Promise<boolean> {
    if (this.isRecording) {
      console.log('🎤 Already recording');
      return true;
    }

    this.callbacks = callbacks;

    // Ensure audio context is ready
    if (!this.audioContext) {
      const initialized = await this.initializeAudioContext();
      if (!initialized) {
        callbacks.onError('Failed to initialize audio context');
        return false;
      }
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
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

        // Calculate audio level
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const level = Math.min(100, (sum / inputData.length) * 1000);
        this.callbacks.onAudioLevel(level);

        // Resample to 16kHz for Gemini
        const resampledData = resampleTo16kHz(inputData, this.audioContext!.sampleRate);

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32767));
        }

        // Convert to base64
        const bytes = new Uint8Array(pcmData.buffer);
        const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(bytes)));

        // Send audio data
        this.callbacks.onAudioData(base64Audio);

        chunkCounter++;
      };

      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext!.destination);

      this.isRecording = true;
      console.log('🎤 ✅ Voice input started');
      return true;

    } catch (error) {
      console.error('❌ Failed to start voice input:', error);
      this.callbacks?.onError('Failed to start voice input');
      return false;
    }
  }

  /**
   * Stop voice input recording
   */
  stopRecording(): void {
    if (!this.isRecording) {
      console.log('🎤 Not currently recording');
      return;
    }

    console.log('🛑 Stopping voice input...');

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
    console.log('🎤 ✅ Voice input stopped');
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get audio context state
   */
  getAudioContextState(): string {
    return this.audioContext?.state || 'not-initialized';
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