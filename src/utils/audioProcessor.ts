/**
 * Audio Processing Utilities
 * Handles base64 to PCM conversion and audio buffer management
 */

export interface AudioProcessingOptions {
  volume: number;
  attenuationFactor: number;
  sampleRate: number;
}

export class AudioProcessor {
  private readonly options: AudioProcessingOptions;

  constructor(options: Partial<AudioProcessingOptions> = {}) {
    this.options = {
      volume: 0.8,
      attenuationFactor: 0.8,
      sampleRate: 24000,
      ...options
    };
  }

  /**
   * Convert base64 audio data to PCM Int16Array
   * Optimized to prevent data loss
   */
  base64ToPCM(base64Audio: string): Int16Array {
    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);

      // Fill bytes array
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Direct buffer casting without slicing to preserve all data
      return new Int16Array(bytes.buffer);
    } catch (error) {
      console.error('❌ Error converting base64 to PCM:', error);
      return new Int16Array();
    }
  }

  /**
   * Convert PCM data to Web Audio API buffer
   */
  pcmToAudioBuffer(pcmData: Int16Array, audioContext: AudioContext): AudioBuffer | null {
    try {
      const audioBuffer = audioContext.createBuffer(1, pcmData.length, this.options.sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Convert 16-bit PCM to float32 with attenuation
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = (pcmData[i] / 32768.0) * this.options.attenuationFactor;
      }

      return audioBuffer;
    } catch (error) {
      console.error('❌ Error converting PCM to audio buffer:', error);
      return null;
    }
  }

  /**
   * Play audio buffer with volume control
   */
  playAudioBuffer(audioBuffer: AudioBuffer, audioContext: AudioContext, volume: number): AudioBufferSourceNode | null {
    try {
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volume * this.options.volume;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      return source;
    } catch (error) {
      console.error('❌ Error playing audio buffer:', error);
      return null;
    }
  }

  /**
   * Calculate audio duration from sample count
   */
  calculateDuration(sampleCount: number): number {
    return sampleCount / this.options.sampleRate;
  }

  /**
   * Validate base64 audio data
   */
  validateBase64Audio(base64Audio: string): boolean {
    if (!base64Audio || typeof base64Audio !== 'string') {
      return false;
    }

    // Check if it looks like base64 (reasonable length and valid characters)
    if (base64Audio.length < 100) {
      return false;
    }

    // Basic base64 pattern check
    return /^[A-Za-z0-9+/]*={0,2}$/.test(base64Audio);
  }

  /**
   * Get audio chunk info
   */
  getAudioChunkInfo(base64Audio: string): { size: number; estimatedDuration: number; isValid: boolean } {
    const isValid = this.validateBase64Audio(base64Audio);
    const size = base64Audio.length;

    // Estimate duration: base64 -> bytes -> PCM samples -> seconds
    const bytesPerChar = 0.75; // Approximate
    const bytesToSamples = 0.5; // 2 bytes per 16-bit sample
    const estimatedSamples = size * bytesPerChar * bytesToSamples;
    const estimatedDuration = estimatedSamples / this.options.sampleRate;

    return { size, estimatedDuration, isValid };
  }
}