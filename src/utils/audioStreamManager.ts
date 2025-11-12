/**
 * Real-time Audio Stream Manager for Gemini Live
 * Plays audio chunks immediately as they arrive
 */

export class AudioStreamManager {
  private audioContext: AudioContext;
  private sampleRate: number = 24000; // Gemini's output rate
  private gainNode: GainNode | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 0.8;
    this.gainNode.connect(audioContext.destination);
  }

  /**
   * Play audio chunk immediately (real-time playback)
   */
  playAudioChunk(base64Audio: string): void {
    try {
      // Convert base64 to PCM data
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));
      const duration = pcmData.length / this.sampleRate;

      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, this.sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Convert Int16 to Float32
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      // Create and play source immediately
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode!);
      source.start();

      console.log(`🔊 Playing chunk: ${pcmData.length} samples, duration: ${duration.toFixed(3)}s`);
    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
    }
  }

  /**
   * Set volume for audio playback
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }
}