/**
 * Audio Utilities for Gemini Live Integration
 * Handles PCM conversion, audio playback, and recording functionality
 */

export interface AudioStreamRef {
  buffer: Array<{ base64Audio: string; isFirstChunk: boolean }>;
  isPlaying: boolean;
  scheduleTimeout: number | null;
  nextPlayTime: number | null;
  hasStarted: boolean;
}

export interface AudioLevelCallback {
  (level: number): void;
}

/**
 * Parse PCM WAV format
 */
export async function parsePCMWav(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  // Check if it's a WAV file
  const view = new DataView(arrayBuffer);
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
    throw new Error('Not a valid WAV file');
  }

  // Simple WAV parser for 16-bit PCM
  const sampleRate = view.getUint32(24, true);
  const channels = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);

  if (bitsPerSample !== 16) {
    throw new Error('Only 16-bit PCM supported');
  }

  const dataOffset = view.getUint32(16, true) + 8;
  const data = new Int16Array(arrayBuffer, dataOffset);
  const samples = data.length / channels;

  const audioBuffer = audioContext.createBuffer(channels, samples, sampleRate);
  for (let channel = 0; channel < channels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < samples; i++) {
      channelData[i] = data[i * channels + channel] / 32768;
    }
  }

  return audioBuffer;
}

/**
 * Parse raw PCM data
 */
export async function parseRawPCM(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  // Assume 16-bit PCM, mono, 24kHz
  const data = new Int16Array(arrayBuffer);
  const sampleRate = 24000;
  const channels = 1;
  const samples = data.length / channels;

  const audioBuffer = audioContext.createBuffer(channels, samples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    channelData[i] = data[i] / 32768;
  }

  return audioBuffer;
}

/**
 * Convert base64 audio data to PCM and create audio buffer
 */
export function createAudioBufferFromBase64(
  base64Audio: string,
  sampleRate: number = 24000
): AudioBuffer | null {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create Int16Array from bytes
    const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));

    // Create audio buffer using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = audioContext.createBuffer(1, pcmData.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // Convert 16-bit PCM to float32
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }

    return audioBuffer;
  } catch (error) {
    console.error('Error creating audio buffer from base64:', error);
    return null;
  }
}

/**
 * Apply gentle fade-in to audio buffer
 */
export function applyFadeIn(audioBuffer: AudioBuffer, fadeLength: number = 100): void {
  if (audioBuffer.length > fadeLength) {
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < fadeLength; i++) {
      const fadeGain = i / fadeLength;
      channelData[i] *= fadeGain;
    }
  }
}

/**
 * Play a single audio chunk immediately
 */
export function playAudioChunkImmediate(
  base64Audio: string,
  isFirstChunk: boolean,
  audioContext: AudioContext,
  volume: number,
  audioStreamRef: AudioStreamRef,
  debugLogsEnabled: boolean = false
): void {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create Int16Array from bytes
    const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));

    // Create audio buffer at correct sample rate (24kHz for Gemini audio)
    const audioBuffer = audioContext.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);

    // Convert 16-bit PCM to float32
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

    // Create gain node
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume * 0.5; // Moderate volume

    // Create buffer source
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Start at scheduled time or immediately
    const currentTime = audioContext.currentTime;
    const startTime = Math.max(currentTime + 0.005, audioStreamRef.nextPlayTime || currentTime);
    source.start(startTime);
    audioStreamRef.nextPlayTime = startTime + (audioBuffer.length / 24000);

    if (debugLogsEnabled) {
      const duration = pcmData.length / 24000;
      console.log(`🔊 🎵 Playing chunk: ${pcmData.length} samples, ${duration.toFixed(3)}s duration`);
    }
  } catch (error) {
    console.error('❌ Error in immediate audio playback:', error);
  }
}

/**
 * Start buffered playback of collected audio chunks
 */
export function startBufferedPlayback(
  audioContext: AudioContext,
  volume: number,
  audioStreamRef: AudioStreamRef,
  debugLogsEnabled: boolean = false
): void {
  if (!audioContext || audioStreamRef.buffer.length === 0) return;

  try {
    const currentTime = audioContext.currentTime;
    let nextStartTime = currentTime + 0.02; // Small initial delay

    const chunkCount = audioStreamRef.buffer.length;

    // Play all buffered chunks in sequence
    audioStreamRef.buffer.forEach((chunk, index) => {
      playAudioChunkImmediate(
        chunk.base64Audio,
        index === 0,
        audioContext,
        volume,
        audioStreamRef,
        debugLogsEnabled
      );
      const duration = (chunk.base64Audio.length * 3/4) / 24000; // Approximate duration
      nextStartTime += duration + 0.005; // Small gap between chunks
    });

    // Clear buffer after scheduling
    audioStreamRef.buffer = [];
    audioStreamRef.nextPlayTime = nextStartTime;

    if (debugLogsEnabled) {
      console.log(`🔊 ✅ Started buffered playback with ${chunkCount} chunks`);
    }

  } catch (error) {
    console.error('❌ Error starting buffered playback:', error);
  }
}

/**
 * Enhanced real-time audio streaming with smart buffering
 */
export function playAudioChunk(
  base64Audio: string,
  isFirstChunk: boolean = false,
  audioContext: AudioContext,
  volume: number,
  audioStreamRef: AudioStreamRef,
  debugLogsEnabled: boolean = false,
  onPlaybackStart?: () => void
): void {
  if (!audioContext) return;

  try {
    // For the very first chunk, buffer it briefly to collect a few chunks
    if (isFirstChunk && !audioStreamRef.hasStarted) {
      audioStreamRef.buffer = [{ base64Audio, isFirstChunk: true }];
      audioStreamRef.hasStarted = true;

      // Wait a moment to collect 2-3 chunks before starting playback
      setTimeout(() => {
        if (audioStreamRef.buffer.length > 0 && !audioStreamRef.isPlaying) {
          startBufferedPlayback(audioContext, volume, audioStreamRef, debugLogsEnabled);
          onPlaybackStart?.();
        }
      }, 150); // 150ms buffer to collect initial chunks

      if (debugLogsEnabled) {
        console.log('🔊 Buffering first chunk, waiting for more...');
      }
      return;
    }

    // Add to buffer if we're still in the initial buffering phase
    if (!audioStreamRef.isPlaying && audioStreamRef.hasStarted) {
      audioStreamRef.buffer.push({ base64Audio, isFirstChunk: false });
      if (debugLogsEnabled) {
        console.log(`🔊 Added to buffer (${audioStreamRef.buffer.length} chunks)`);
      }
      return;
    }

    // If we're already playing, use the immediate playback logic
    if (audioStreamRef.isPlaying) {
      playAudioChunkImmediate(base64Audio, false, audioContext, volume, audioStreamRef, debugLogsEnabled);
    }

  } catch (error) {
    console.error('❌ Error in audio chunk buffering:', error);
  }
}

/**
 * Create and play a test tone
 */
export function playTestTone(audioContext: AudioContext, volume: number = 0.3): void {
  try {
    const testBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 1, audioContext.sampleRate);
    const channelData = testBuffer.getChannelData(0);

    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = Math.sin(2 * Math.PI * 440 * i / audioContext.sampleRate) * volume;
    }

    const source = audioContext.createBufferSource();
    source.buffer = testBuffer;
    source.connect(audioContext.destination);
    source.start();

    console.log('✅ Test tone played successfully');
  } catch (error) {
    console.error('Error playing test tone:', error);
  }
}

/**
 * Create synthetic PCM data for testing
 */
export function createTestPCMData(
  frequency: number = 440,
  duration: number = 1,
  sampleRate: number = 24000
): Int16Array {
  const samples = sampleRate * duration;
  const pcmData = new Int16Array(samples);

  for (let i = 0; i < samples; i++) {
    pcmData[i] = Math.floor(Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5 * 32767);
  }

  return pcmData;
}

/**
 * Convert audio buffer to base64 string
 */
export function audioBufferToBase64(audioBuffer: AudioBuffer): string {
  const pcmData = new Int16Array(audioBuffer.length);
  const channelData = audioBuffer.getChannelData(0);

  // Convert float32 to 16-bit PCM
  for (let i = 0; i < audioBuffer.length; i++) {
    pcmData[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32767));
  }

  const uint8Array = new Uint8Array(pcmData.buffer);
  return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
}

/**
 * Normalize audio data to prevent clipping
 */
export function normalizeAudioData(audioData: Float32Array, targetMax: number = 0.7): Float32Array {
  let maxOriginalValue = 0;
  for (let i = 0; i < audioData.length; i++) {
    const abs = Math.abs(audioData[i]);
    maxOriginalValue = Math.max(maxOriginalValue, abs);
  }

  const normalizationFactor = maxOriginalValue > targetMax ? targetMax / maxOriginalValue : 1.0;
  const normalizedData = new Float32Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
    normalizedData[i] = audioData[i] * normalizationFactor;
  }

  return normalizedData;
}

/**
 * Resample audio data to target sample rate
 */
export function resampleAudio(
  originalData: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number
): Float32Array {
  const ratio = targetSampleRate / originalSampleRate;
  const newLength = Math.floor(originalData.length * ratio);
  const resampledData = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const sourceIndex = Math.floor(i / ratio);
    resampledData[i] = originalData[sourceIndex];
  }

  return resampledData;
}