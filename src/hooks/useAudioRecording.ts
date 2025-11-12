/**
 * Custom hook for managing audio recording functionality
 */

import { useState, useCallback, useRef } from 'react';
import { AudioStreamRef, AudioLevelCallback } from '../utils/audioUtils';

interface AudioRecordingState {
  isRecording: boolean;
  audioLevel: number;
  isProcessing: boolean;
}

export function useAudioRecording() {
  const [recordingState, setRecordingState] = useState<AudioRecordingState>({
    isRecording: false,
    audioLevel: 0,
    isProcessing: false
  });

  const audioStreamRef = useRef<AudioStreamRef>({
    buffer: [],
    isPlaying: false,
    scheduleTimeout: null,
    nextPlayTime: null,
    hasStarted: false
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | MediaRecorder | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  const setRecording = useCallback((isRecording: boolean) => {
    setRecordingState(prev => ({ ...prev, isRecording }));
  }, []);

  const setAudioLevel = useCallback((audioLevel: number) => {
    setRecordingState(prev => ({ ...prev, audioLevel }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setRecordingState(prev => ({ ...prev, isProcessing }));
  }, []);

  const setWebSocketRef = useCallback((websocket: WebSocket | null) => {
    websocketRef.current = websocket;
  }, []);

  const setupAudioRecording = useCallback(async (
    audioContext: AudioContext,
    onAudioLevel: AudioLevelCallback,
    debugLogsEnabled: boolean = false
  ): Promise<boolean> => {
    try {
      console.log('🎤 Setting up audio recording...');

      // Check if audio context is valid
      if (!audioContext || audioContext.state === 'closed') {
        console.log('🔊 Audio context not available for recording');
        return false;
      }

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        console.log('🔊 Resuming suspended audio context...');
        await audioContext.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      console.log('🎤 Got media stream:', stream.getAudioTracks().length, 'tracks');
      mediaStreamRef.current = stream;

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        console.log('🎤 Setting up direct PCM audio capture...');

        // Create a script processor for real-time PCM conversion
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        processorRef.current = processor;

        let audioChunkCounter = 0;
        let isListeningRef = false;

        // Create source from the microphone stream
        const source = audioContext.createMediaStreamSource(stream);

        processor.onaudioprocess = (event) => {
          // Get raw audio data
          const inputData = event.inputBuffer.getChannelData(0);

          // Calculate audio level for visualization
          let sum = 0;
          let maxSample = 0;
          for (let i = 0; i < inputData.length; i++) {
            const abs = Math.abs(inputData[i]);
            sum += abs;
            maxSample = Math.max(maxSample, abs);
          }
          const average = sum / inputData.length;
          const level = Math.min(100, average * 1000);
          setAudioLevel(level);
          onAudioLevel(level);

          // Only send to WebSocket if we're listening and connected
          if (!isListeningRef || websocketRef.current?.readyState !== WebSocket.OPEN) {
            return;
          }

          // Debug logging - only log occasionally to avoid spam
          if (debugLogsEnabled && (audioChunkCounter < 10 || audioChunkCounter % 100 === 0)) {
            console.log(`🎤 PCM chunk #${audioChunkCounter}: level=${level.toFixed(2)}, max=${maxSample.toFixed(4)}`);
          }

          // Convert float32 to 16-bit PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
          }

          // Convert to base64
          const uint8Array = new Uint8Array(pcmData.buffer);
          const base64Data = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

          // Send to Gemini
          const audioMessage = {
            realtime_input: {
              audio: {
                data: base64Data,
                mimeType: "audio/pcm;rate=48000"  // Use the actual sample rate
              }
            }
          };

          audioChunkCounter++;

          try {
            websocketRef.current.send(JSON.stringify(audioMessage));
            if (debugLogsEnabled && audioChunkCounter < 5) {
              console.log(`🎤 📤 Sent PCM chunk #${audioChunkCounter}: ${pcmData.length} samples`);
            }
          } catch (error) {
            console.error('🎤 Error sending PCM audio:', error);
          }
        };

        // Connect the audio nodes - CRITICAL: Connect to destination to make processor work
        source.connect(processor);
        processor.connect(audioContext.destination); // This forces the processor to run!

        console.log('🎤 Connected source -> processor -> destination');
        console.log('🎤 PCM capture setup complete');
        console.log('🎤 Audio context sample rate:', audioContext.sampleRate);
        console.log('🎤 Microphone is now capturing raw PCM audio...');
        console.log('🎤 WARNING: You may hear echo - this is normal and required for processing');

        // Store the isListening reference for the processor
        isListeningRef = true;
      }

      setRecording(true);
      return true;

    } catch (error) {
      console.error('Error setting up audio recording:', error);
      setRecording(false);
      return false;
    }
  }, [setAudioLevel, setRecording]);

  const stopAudioRecording = useCallback(() => {
    console.log('🛑 Stopping audio recording');

    if (processorRef.current) {
      // Handle both MediaRecorder and ScriptProcessorNode
      const processor = processorRef.current;
      if ('stop' in processor) {
        // MediaRecorder
        try {
          (processor as MediaRecorder).stop();
        } catch (e) {
          console.log('MediaRecorder already stopped');
        }
      } else if ('disconnect' in processor) {
        // ScriptProcessorNode
        try {
          (processor as ScriptProcessorNode).disconnect();
        } catch (e) {
          console.log('ScriptProcessor already disconnected');
        }
      }
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setRecording(false);
    setAudioLevel(0);
  }, [setRecording, setAudioLevel]);

  const startListening = useCallback(() => {
    setRecording(true);
  }, [setRecording]);

  const stopListening = useCallback(() => {
    setRecording(false);
    stopAudioRecording();
  }, [setRecording, stopAudioRecording]);

  const cleanup = useCallback(() => {
    stopAudioRecording();
    setRecordingState({
      isRecording: false,
      audioLevel: 0,
      isProcessing: false
    });
  }, [stopAudioRecording]);

  return {
    recordingState,
    audioStreamRef,
    mediaStreamRef,
    processorRef,
    setWebSocketRef,
    setupAudioRecording,
    startListening,
    stopListening,
    stopAudioRecording,
    setRecording,
    setAudioLevel,
    setProcessing,
    cleanup
  };
}