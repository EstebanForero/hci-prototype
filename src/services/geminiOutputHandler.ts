/**
 * Gemini Live Output Handler
 * Manages audio output and message processing
 */

import { extractAudioFromMessage } from '../utils/audioCapture';
import { AudioStreamManager } from '../utils/audioStreamManager';

export interface OutputCallbacks {
  onTextResponse: (text: string) => void;
  onTranscript: (text: string) => void;
  onToolCall: (toolCalls: any[]) => void;
  onTurnComplete: () => void;
}

export class GeminiOutputHandler {
  private audioStreamManager: AudioStreamManager | null = null;
  private callbacks: OutputCallbacks | null = null;

  constructor(audioContext: AudioContext) {
    this.audioStreamManager = new AudioStreamManager(audioContext);
  }

  /**
   * Set output callbacks
   */
  setCallbacks(callbacks: OutputCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Process incoming message from Gemini
   */
  processMessage(message: any): void {
    if (!this.callbacks) return;

    // Handle text transcription
    if (message.server_content?.output_transcription?.text) {
      const text = message.server_content.output_transcription.text;
      this.callbacks.onTranscript(text);
      this.callbacks.onTextResponse(text);
    }

    // Handle text responses directly from server content
    if (message.server_content?.parts) {
      for (const part of message.server_content.parts) {
        if (part.text) {
          console.log('📝 Found text response:', part.text);
          this.callbacks.onTextResponse(part.text);
        }
      }
    }

    // Handle tool calls
    if (message.function_calls?.length > 0) {
      console.log('🔧 Tool calls detected:', message.function_calls.length);
      this.callbacks.onToolCall(message.function_calls);
    }

    // Handle audio playback
    const audioChunks = extractAudioFromMessage(message);
    for (const audioData of audioChunks) {
      if (this.audioStreamManager) {
        this.audioStreamManager.playAudioChunk(audioData);
      }
    }

    // Handle turn complete
    if (message.server_content?.turn_complete) {
      console.log('🔄 Turn complete detected');
      this.callbacks.onTurnComplete();
    }
  }

  /**
   * Set audio output volume
   */
  setVolume(volume: number): void {
    if (this.audioStreamManager) {
      this.audioStreamManager.setVolume(volume);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.audioStreamManager) {
      this.audioStreamManager.cleanup();
      this.audioStreamManager = null;
    }
    this.callbacks = null;
  }
}