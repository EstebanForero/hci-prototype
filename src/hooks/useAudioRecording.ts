/**
 * Simple Audio Recording Hook for Gemini Live
 * Handles microphone capture and audio level visualization
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { resampleTo16kHz } from '../utils/audioCapture';

interface AudioRecordingState {
  isRecording: boolean;
  audioLevel: number;
  isProcessing: boolean;
}

interface AudioRecordingCallbacks {
  onAudioData: (base64Audio: string) => void;
  onAudioLevel: (level: number) => void;
}

export function useAudioRecording() {
  const [recordingState, setRecordingState] = useState<AudioRecordingState>({
    isRecording: false,
    audioLevel: 0,
    isProcessing: false
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const callbacksRef = useRef<AudioRecordingCallbacks | null>(null);

  const setAudioLevel = useCallback((level: number) => {
    setRecordingState(prev => ({ ...prev, audioLevel: level }));
  }, []);

  const setRecording = useCallback((isRecording: boolean) => {
    setRecordingState(prev => ({ ...prev, isRecording }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setRecordingState(prev => ({ ...prev, isProcessing }));
  }, []);

  // Setup audio recording with proper Gemini Live format
  const setupAudioRecording = useCallback(async (
    audioContext: AudioContext,
    callbacks: AudioRecordingCallbacks,
    debugLogsEnabled: boolean = false
  ): Promise<boolean> => {
    try {
      console.log('🎤 Setting up audio recording for Gemini Live...');
      console.log('🎤 Audio context state:', audioContext.state);
      console.log('🎤 Audio context sample rate:', audioContext.sampleRate);
      console.log('🎤 Target rate: 16kHz (16000 Hz) input to Gemini');

      if (!audioContext) {
        console.error('❌ Audio context not provided');
        return false;
      }

      if (audioContext.state === 'closed') {
        console.error('❌ Audio context is closed, a new one should be created');
        console.error('❌ Audio context object:', audioContext);
        return false;
      }

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        console.log('🔊 Resuming suspended audio context...');
        await audioContext.resume();
        console.log('🔊 Audio context resumed, new state:', audioContext.state);
      }

      // Store callbacks
      callbacksRef.current = callbacks;

      // Get microphone access with Gemini Live compatible settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000  // Gemini Live expects 16kHz
        }
      });

      console.log('🎤 Got microphone stream');
      mediaStreamRef.current = stream;

      // Create audio processing pipeline
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create script processor for real-time audio processing
      const bufferSize = 4096;  // 256ms of audio at 16kHz
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      let chunkCounter = 0;

      processor.onaudioprocess = (event) => {
        if (!callbacksRef.current) return;

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

        // Update audio level
        setAudioLevel(level);
        callbacksRef.current.onAudioLevel(level);

        // Debug logging for first few chunks
        if (debugLogsEnabled && chunkCounter < 3) {
          console.log(`🎤 Audio chunk #${chunkCounter}: level=${level.toFixed(1)}, max=${maxSample.toFixed(4)}`);
        }

        // Resample audio to 16kHz for Gemini Live
        const resampledData = resampleTo16kHz(inputData, audioContext.sampleRate);

        // Convert Float32Array to 16-bit PCM (required by Gemini Live)
        const pcmData = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32767));
        }

        // Convert PCM to base64
        const bytes = new Uint8Array(pcmData.buffer);
        const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(bytes)));

        // Send audio data via callback
        callbacksRef.current.onAudioData(base64Audio);

        chunkCounter++;
      };

      // Connect audio nodes: source -> processor -> destination
      // Note: We connect to destination to ensure the processor runs
      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log('🎤 Audio recording setup complete');
      console.log(`🎤 Sample rate: ${audioContext.sampleRate}Hz`);
      console.log(`🎤 Buffer size: ${bufferSize} samples`);
      console.log('🎤 Ready to capture audio');

      return true;

    } catch (error) {
      console.error('❌ Error setting up audio recording:', error);
      return false;
    }
  }, [setAudioLevel]);

  // Start recording
  const startListening = useCallback(async (
    audioContext: AudioContext,
    callbacks: AudioRecordingCallbacks,
    debugLogsEnabled: boolean = false
  ): Promise<boolean> => {
    if (recordingState.isRecording) {
      console.log('🎤 Already recording');
      return true;
    }

    console.log('🎤 Starting audio capture...');
    setProcessing(true);

    const success = await setupAudioRecording(audioContext, callbacks, debugLogsEnabled);

    if (success) {
      setRecording(true);
      console.log('🎤 ✅ Audio capture started');
    } else {
      setProcessing(false);
      console.error('❌ Failed to start audio capture');
    }

    setProcessing(false);
    return success;
  }, [recordingState.isRecording, setupAudioRecording, setRecording, setProcessing]);

  // Stop recording
  const stopListening = useCallback(() => {
    if (!recordingState.isRecording) {
      console.log('🎤 Not currently recording');
      return;
    }

    console.log('🛑 Stopping audio capture...');

    try {
      // Disconnect processor
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      // Disconnect source
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }

      console.log('🎤 ✅ Audio capture stopped');
    } catch (error) {
      console.error('❌ Error stopping audio capture:', error);
    }

    setRecording(false);
    setAudioLevel(0);
  }, [recordingState.isRecording, setRecording, setAudioLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    recordingState,
    startListening,
    stopListening,
    setAudioLevel
  };
}