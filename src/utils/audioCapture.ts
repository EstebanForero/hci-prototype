/**
 * Audio Capture Utilities for Gemini Live
 * Helper functions for audio processing and conversion
 */

import { GeminiValidator } from './validation';

/**
 * Convert Float32Array to 16-bit PCM
 * Used for Gemini Live audio input
 */
export function float32ToPCM16(float32Array: Float32Array): Int16Array {
  const pcmData = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Convert float32 range [-1.0, 1.0] to int16 range [-32768, 32767]
    pcmData[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32767));
  }
  return pcmData;
}

/**
 * Convert PCM16 to base64 string
 * Used for WebSocket transmission to Gemini Live
 */
export function pcmToBase64(pcmData: Int16Array): string {
  const bytes = new Uint8Array(pcmData.buffer);
  return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
}

/**
 * Calculate audio level for visualization
 * Returns a percentage from 0-100
 */
export function calculateAudioLevel(audioData: Float32Array): number {
  let sum = 0;
  let maxSample = 0;

  for (let i = 0; i < audioData.length; i++) {
    const abs = Math.abs(audioData[i]);
    sum += abs;
    maxSample = Math.max(maxSample, abs);
  }

  const average = sum / audioData.length;
  // Scale the average to a 0-100 percentage
  return Math.min(100, average * 1000);
}

/**
 * Check if browser supports required audio features
 */
export function checkAudioSupport(): { supported: boolean; message: string } {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      supported: false,
      message: 'Browser does not support microphone access'
    };
  }

  if (!window.AudioContext && !(window as any).webkitAudioContext) {
    return {
      supported: false,
      message: 'Browser does not support Web Audio API'
    };
  }

  if (!window.ScriptProcessorNode && !(window.AudioContext as any).createScriptProcessor) {
    return {
      supported: false,
      message: 'Browser does not support ScriptProcessorNode'
    };
  }

  return {
    supported: true,
    message: 'All required audio features are supported'
  };
}

/**
 * Resample audio from input sample rate to 16kHz for Gemini Live input
 * Simple downsampling by taking every Nth sample
 */
export function resampleTo16kHz(audioData: Float32Array, inputSampleRate: number): Float32Array {
  // console.log(`🎵 Resampling audio: ${inputSampleRate}Hz → 16kHz (${audioData.length} samples)`);

  if (inputSampleRate === 16000) {
    // console.log('🎵 No resampling needed, already 16kHz');
    return audioData;
  }

  const ratio = inputSampleRate / 16000;
  const outputLength = Math.floor(audioData.length / ratio);
  const resampled = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = Math.floor(i * ratio);
    resampled[i] = audioData[sourceIndex];
  }

  // console.log(`🎵 Resampled to ${outputLength} samples (ratio: ${ratio.toFixed(2)})`);
  return resampled;
}

/**
 * Extract audio data from Gemini WebSocket message
 * Based on Rust implementation pattern
 */
export function extractAudioFromMessage(message: any): string[] {
  const foundAudio: string[] = [];

  // Validate message structure first
  const validation = GeminiValidator.validateWebSocketMessage(message);
  if (!validation.isValid) {
    console.error('❌ Invalid message for audio extraction:', validation.error);
    return foundAudio;
  }

  // Look for audio in server_content.model_turn.parts (like Rust code)
  if (message.server_content?.model_turn?.parts) {
    for (let i = 0; i < message.server_content.model_turn.parts.length; i++) {
      const part = message.server_content.model_turn.parts[i];

      // Check for inline_data with audio MIME type (like Rust implementation)
      if (part.inline_data) {
        const mimeType = part.inline_data.mime_type || '';

        // Check if it's audio with PCM at 24kHz (matching Rust logic)
        if (mimeType.includes('audio/') &&
            mimeType.includes('pcm') &&
            mimeType.includes('rate=24000')) {

          if (part.inline_data.data && typeof part.inline_data.data === 'string') {
            // Validate the audio data before adding
            if (GeminiValidator.validateBase64Audio(part.inline_data.data).isValid) {
              foundAudio.push(part.inline_data.data);
              console.log(`🎵 Found validated audio at model_turn.parts[${i}].inline_data.data: ${part.inline_data.data.length} chars`);
            } else {
              console.error(`❌ Invalid audio data at model_turn.parts[${i}], skipping`);
            }
          }
        }
      }
    }
  }

  // Fallback: Look for text responses
  if (message.server_content?.model_turn?.parts) {
    for (const part of message.server_content.model_turn.parts) {
      if (part.text) {
        console.log('📝 Found text response:', part.text);
      }
    }
  }

  // Handle transcription
  if (message.server_content?.output_transcription?.text) {
    console.log('📝 Transcription:', message.server_content.output_transcription.text);
  }

  if (foundAudio.length > 0) {
    console.log(`🎵 Found ${foundAudio.length} audio chunk(s) from Gemini`);
  }

  return foundAudio;
}

/**
 * Play Gemini audio response using Web Audio API
 */
export function playGeminiAudio(base64Audio: string, audioContext: AudioContext): void {
  try {
    console.log(`🔊 Processing Gemini audio: ${base64Audio.length} chars`);

    // Convert base64 to binary string
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert bytes to 16-bit PCM (Int16Array)
    const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));

    // Convert Int16Array to Float32Array for Web Audio API
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0; // Convert to -1.0 to 1.0 range
    }

    // Create audio buffer with 24kHz sample rate (Gemini's output rate)
    const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(float32Data);

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.8; // Set volume to 80%

    // Create and connect audio source
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Start playback
    source.start();

    const duration = pcmData.length / 24000;
    console.log(`🔊 Playing Gemini audio: ${pcmData.length} samples at 24kHz (${duration.toFixed(2)}s)`);
  } catch (error) {
    console.error('❌ Error playing Gemini audio:', error);
  }
}

/**
 * Get optimal audio settings for Gemini Live
 */
export function getAudioSettings() {
  return {
    sampleRate: 16000,        // Gemini Live expects 16kHz
    bufferSize: 4096,       // 256ms of audio at 16kHz
    channels: 1,             // Mono audio
    constraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000
    }
  };
}