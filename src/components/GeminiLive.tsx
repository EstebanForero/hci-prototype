import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Bot, Volume2, VolumeX, Settings, Activity, AlertCircle } from 'lucide-react';

interface ComponentMetrics {
  name: string;
  health: number;
  status: 'optimal' | 'warning' | 'critical';
  cyclesRemaining: number;
}

interface GeminiLiveProps {
  parts: ComponentMetrics[];
  overallHealth: number;
  totalCycles: number;
  onStartWash: (config: any) => void;
  isActive: boolean;
  currentCycle: number;
  totalCyclesScheduled: number;
  timeRemaining: string;
}

interface GeminiResponse {
  text: string;
  action?: {
    type: 'start_wash' | 'stop_wash' | 'get_metrics' | 'configure_wash';
    config?: any;
  };
  confidence: number;
}

export default function GeminiLive({
  parts,
  overallHealth,
  totalCycles,
  onStartWash,
  isActive,
  currentCycle,
  totalCyclesScheduled,
  timeRemaining
}: GeminiLiveProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responses, setResponses] = useState<Array<{text: string, timestamp: Date, type: 'user' | 'assistant'}>>([]);
  const [volume, setVolume] = useState(0.8);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioTesting, setIsAudioTesting] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [debugLogsEnabled, setDebugLogsEnabled] = useState(false);

  // Gemini Live WebSocket and audio refs
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioBufferRef = useRef<ArrayBuffer | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [responses]);

  // Initialize Gemini Live WebSocket connection
  const initGeminiLive = useCallback(async () => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        setError('Please add your Gemini API key to the .env file');
        setIsSDKReady(false);
        return;
      }

      // Initialize Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🔊 Audio context created, state:', audioContextRef.current.state, 'sampleRate:', audioContextRef.current.sampleRate);

      // Resume audio context if it's suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('🔊 Audio context resumed');
      }

      // Generate session ID
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Connect to Gemini Live API WebSocket
      // Using the correct endpoint format for Gemini Live API
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onopen = () => {
        console.log('✅ Gemini Live WebSocket connected');

        // Send session configuration with proper VAD settings
        const setupMessage = {
          setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
            generation_config: {
              response_modalities: ["AUDIO"],
              speech_config: {
                voice_config: {
                  prebuilt_voice_config: {
                    voice_name: "Kore"
                  }
                }
              }
            },
            system_instruction: {
              parts: [{
                text: `You are SmartWash Pro AI Assistant. Current system status: ${overallHealth}% health, ${isActive ? 'running' : 'idle'}, cycle ${currentCycle}/${totalCyclesScheduled}, ${timeRemaining} remaining. Components: ${parts.map(p => `${p.name} (${p.health}% health)`).join(', ')}. Please respond briefly and helpfully.`
              }]
            }
          }
        };

        console.log('📤 Sending setup message:', JSON.stringify(setupMessage, null, 2));
        websocketRef.current.send(JSON.stringify(setupMessage));
        console.log('✅ Setting isSDKReady to true');
        setIsSDKReady(true);
        setError(null);
      };

      websocketRef.current.onmessage = async (event) => {
        try {
          console.log('📨 Received WebSocket message, type:', typeof event.data);

          // Handle both text and binary messages
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            console.log('🔍 Gemini Live Response (text):', JSON.stringify(data, null, 2));
            handleGeminiResponse(data);
          } else if (event.data instanceof Blob) {
            console.log('🔊 Received binary blob, size:', event.data.size, 'type:', event.data.type);

            // Try to decode blob as text first (might be JSON)
            try {
              const text = await event.data.text();
              console.log('🔍 Blob as text (length:', text.length, '):', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
              const data = JSON.parse(text);
              console.log('🔍 Gemini Live Response (blob->text):', JSON.stringify(data, null, 2));
              handleGeminiResponse(data);
            } catch (textError) {
              console.log('🔍 Not text, trying as binary audio...', textError.message);
              handleBinaryAudio(event.data);
            }
          } else if (event.data instanceof ArrayBuffer) {
            console.log('🔊 Received ArrayBuffer, size:', event.data.byteLength);

            // Try to decode ArrayBuffer as text
            try {
              const text = new TextDecoder().decode(event.data);
              console.log('🔍 ArrayBuffer as text (length:', text.length, '):', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
              const data = JSON.parse(text);
              console.log('🔍 Gemini Live Response (arraybuffer->text):', JSON.stringify(data, null, 2));
              handleGeminiResponse(data);
            } catch (textError) {
              console.log('🔍 Not text, trying as binary audio...', textError.message);
              const blob = new Blob([event.data], { type: 'application/octet-stream' });
              handleBinaryAudio(blob);
            }
          } else {
            console.log('🔍 Unknown message type:', typeof event.data, event.data);
          }
        } catch (err) {
          console.error('Error parsing Gemini response:', err);
        }
      };

      websocketRef.current.onerror = (error) => {
        console.error('Gemini Live WebSocket error:', error);
        setError('Failed to connect to Gemini Live API. Will retry...');
        setIsSDKReady(false);
      };

      websocketRef.current.onclose = (event) => {
        console.log('Gemini Live WebSocket closed:', event.code, event.reason);
        setIsSDKReady(false);

        // Check for quota exceeded error
        if (event.code === 1011 || event.reason.includes('quota')) {
          setError('API quota exceeded. Please check your billing at https://aistudio.google.com/');
          // Don't auto-reconnect for quota errors
          return;
        }

        // Auto-reconnect if not intentionally closed
        if (event.code !== 1000) {
          scheduleReconnect();
        }
      };

    } catch (err) {
      console.error('Failed to initialize Gemini Live:', err);
      setError('Failed to initialize Gemini Live. Please check your API key.');
      setIsSDKReady(false);
    }
  }, [overallHealth, isActive, currentCycle, totalCyclesScheduled, timeRemaining, parts]);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('🔄 Reconnecting to Gemini Live...');
      initGeminiLive();
    }, 5000);
  }, [initGeminiLive]);

  // Parse commands from AI response and execute them
  const parseAndExecuteCommands = useCallback((response: string) => {
    const lowerResponse = response.toLowerCase();

    // Check for wash start commands
    if (lowerResponse.includes('starting wash') || lowerResponse.includes('wash cycle') || lowerResponse.includes('start wash')) {
      if (!isActive) {
        let washConfig = {
          program: 'normal',
          temperature: 40,
          spinSpeed: 1200,
          duration: 60,
          waterLevel: 'medium' as const,
          extraRinse: false,
          preWash: false,
        };

        // Parse wash type from response
        if (lowerResponse.includes('quick') || lowerResponse.includes('fast')) {
          washConfig.program = 'quick';
          washConfig.duration = 30;
        } else if (lowerResponse.includes('delicate') || lowerResponse.includes('gentle')) {
          washConfig.program = 'delicate';
          washConfig.temperature = 30;
          washConfig.spinSpeed = 800;
          washConfig.duration = 60;
        } else if (lowerResponse.includes('heavy') || lowerResponse.includes('tough')) {
          washConfig.program = 'heavy';
          washConfig.temperature = 90;
          washConfig.spinSpeed = 1400;
          washConfig.duration = 120;
          washConfig.extraRinse = true;
        } else if (lowerResponse.includes('eco')) {
          washConfig.program = 'eco';
          washConfig.temperature = 40;
          washConfig.spinSpeed = 1000;
          washConfig.duration = 150;
        }

        onStartWash(washConfig);
      }
    }
  }, [onStartWash, isActive]);

  // Speak function (fallback)
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window && volume > 0) {
      window.speechSynthesis.cancel();

      synthesisRef.current = new SpeechSynthesisUtterance(text);
      synthesisRef.current.volume = volume;
      synthesisRef.current.rate = 1.0;
      synthesisRef.current.pitch = 1.0;

      synthesisRef.current.onstart = () => setIsSpeaking(true);
      synthesisRef.current.onend = () => setIsSpeaking(false);
      synthesisRef.current.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(synthesisRef.current);
    }
  }, [volume]);

  // Handle Gemini Live responses
  const handleGeminiResponse = useCallback((data: any) => {
    console.log('🔍 Processing Gemini response:', JSON.stringify(data, null, 2));

    // Handle setup completion
    if (data.setup_complete || data.setupComplete) {
      console.log('✅ Setup complete');
      setTestResults(prev => [...prev, '✅ Gemini setup complete']);
      return;
    }

    // Check for any error responses
    if (data.error) {
      console.error('❌ Gemini returned error:', data.error);
      setTestResults(prev => [...prev, `❌ Gemini error: ${data.error.message || data.error}`]);
      return;
    }

    let foundAudio = false;
    let foundText = false;

    // Enhanced audio content detection using recursive search (from successful test)
    const extractContentFromMessage = (msg: any): { textParts: string[], audioParts: string[] } => {
      const textParts: string[] = [];
      const audioParts: string[] = [];

      // Helper function to search recursively for content
      const searchRecursively = (obj: any, path: string = '') => {
        if (obj === null || obj === undefined) return;

        // Check for text content
        if (obj.text && typeof obj.text === 'string' && obj.text.trim()) {
          textParts.push(obj.text);
          if (debugLogsEnabled) {
            console.log(`💬 Found text at ${path}: ${obj.text.substring(0, 50)}...`);
          }
        }

        // Check for common audio data fields
        const audioFields = ['data', 'audio_data', 'audio', 'inline_data', 'inlineData'];
        for (const field of audioFields) {
          if (obj[field] && typeof obj[field] === 'string' && obj[field].length > 100) {
            audioParts.push(obj[field]);
            if (debugLogsEnabled) {
              console.log(`🎵 Found audio at ${path}.${field}: ${obj[field].length} chars`);
            }
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

      searchRecursively(msg);
      return { textParts, audioParts };
    };

    // Extract all content from the message
    const { textParts, audioParts } = extractContentFromMessage(data);

    // Handle text responses
    if (textParts.length > 0) {
      const combinedText = textParts.join(' ');
      if (combinedText.trim()) {
        console.log('💬 Received text response:', combinedText.substring(0, 100) + '...');
        setTestResults(prev => [...prev, `💬 Text: "${combinedText.substring(0, 100)}${combinedText.length > 100 ? '...' : ''}"`]);
        setResponses(prev => [...prev, {
          text: combinedText,
          timestamp: new Date(),
          type: 'assistant'
        }]);
        foundText = true;

        // Parse for wash commands and execute actions
        parseAndExecuteCommands(combinedText);

        // Convert text to speech as fallback
        if (volume > 0) {
          speak(combinedText);
        }
      }
    }

    // Handle audio responses - REAL-TIME STREAMING
    if (audioParts.length > 0) {
      audioParts.forEach((audioData, index) => {
        foundAudio = true;
        console.log(`🔊 🎵 REAL-TIME AUDIO CHUNK ${index + 1}: ${audioData.length} chars`);
        setTestResults(prev => [...prev, `🎵 Audio chunk ${index + 1}: ${audioData.length} characters`]);

        // Play immediately - NO BUFFERING!
        try {
          playAudioChunk(audioData, !isSpeaking); // isFirstChunk = !isSpeaking
        } catch (error) {
          console.error('❌ Error playing real-time audio:', error);
        }
      });
    }

    if (!foundAudio && !foundText) {
      setTestResults(prev => [...prev, '⚠️ No audio or text content found in any response path']);

      // Log all available keys for debugging
      console.log('🔍 Available response keys:', Object.keys(data));

      // Look for any base64-like strings anywhere in the response
      const dataStr = JSON.stringify(data);
      const base64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/g;
      const matches = dataStr.match(base64Pattern);
      if (matches && matches.length > 0) {
        console.log('🔍 Found potential base64 data:', matches.length, 'matches');
        setTestResults(prev => [...prev, `🔍 Found ${matches.length} potential base64 strings in response`]);

        // Try to play the first match as audio
        try {
          console.log('🔊 Attempting to play first base64 match as audio...');
          playAudioChunk(matches[0], true); // isFirstChunk = true
        } catch (error) {
          console.log('🔊 Base64 match failed as audio:', error.message);
        }
      }
    }

    // Handle transcription if available
    if (data.server_content?.output_transcription?.text) {
      console.log('📝 Transcription:', data.server_content.output_transcription.text);
      setTestResults(prev => [...prev, `📝 Transcription: "${data.server_content.output_transcription.text}"`]);
    }

    // Handle turn completion
    if (data.server_content?.turn_complete) {
      console.log('🔄 Turn complete - stopping speech');
      setTestResults(prev => [...prev, '🔄 Turn complete - stopping speech']);

      // Stop speaking when turn is complete
      if (isSpeaking) {
        setTimeout(() => {
          setIsSpeaking(false);
          audioStreamRef.current.isPlaying = false;
          audioStreamRef.current.nextPlayTime = null;
          audioStreamRef.current.hasStarted = false; // Reset for next interaction
          audioStreamRef.current.buffer = []; // Clear any remaining buffer
          if (debugLogsEnabled) {
            console.log('🔊 🛑 Stopped speaking and reset stream state');
          }
        }, 500); // Small delay to allow final audio chunks to finish
      }
    }
  }, [volume, onStartWash, isActive, currentCycle, totalCyclesScheduled, parseAndExecuteCommands, speak, isSpeaking, debugLogsEnabled]);

  // Simple audio buffer playback function
  const playAudioBufferDirectly = useCallback((audioBuffer: AudioBuffer) => {
    if (!audioContextRef.current) return;

    try {
      console.log('🔊 Playing decoded audio buffer');

      // Stop any currently playing audio
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      }

      // Create gain node for volume control
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = volume;

      // Create and connect source
      audioSourceRef.current = audioContextRef.current.createBufferSource();
      audioSourceRef.current.buffer = audioBuffer;
      audioSourceRef.current.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Handle playback end
      audioSourceRef.current.onended = () => {
        console.log('🔊 Audio playback finished');
        setIsSpeaking(false);
        audioSourceRef.current = null;
      };

      // Start playback
      audioSourceRef.current.start(0);
      setIsSpeaking(true);
      console.log('🔊 Started playing decoded audio');

    } catch (error) {
      console.error('Error playing audio buffer:', error);
    }
  }, [volume]);

  
  
  // Real-time audio streaming - play chunks as they arrive
  const audioStreamRef = useRef<{
    buffer: Array<{ base64Audio: string; isFirstChunk: boolean }>;
    isPlaying: boolean;
    scheduleTimeout: number | null;
    nextPlayTime: number | null;
    hasStarted: boolean;
  }>({ buffer: [], isPlaying: false, scheduleTimeout: null, nextPlayTime: null, hasStarted: false });

  // Helper function to play a single audio chunk immediately (must be defined first)
  const playAudioChunkImmediate = useCallback((base64Audio: string, isFirstChunk: boolean, scheduledTime?: number) => {
    if (!audioContextRef.current) return;

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
      const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
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
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = volume * 0.5; // Moderate volume

      // Create buffer source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Start at scheduled time or immediately
      if (scheduledTime !== undefined) {
        source.start(scheduledTime);
      } else {
        const currentTime = audioContextRef.current.currentTime;
        const startTime = Math.max(currentTime + 0.005, audioStreamRef.current.nextPlayTime || currentTime);
        source.start(startTime);
        audioStreamRef.current.nextPlayTime = startTime + (audioBuffer.length / 24000);
      }

      if (debugLogsEnabled) {
        const duration = pcmData.length / 24000;
        console.log(`🔊 🎵 Playing chunk: ${pcmData.length} samples, ${duration.toFixed(3)}s duration`);
      }
    } catch (error) {
      console.error('❌ Error in immediate audio playback:', error);
    }
  }, [volume, debugLogsEnabled]);

  // Helper function to start playback with buffered chunks (defined after playAudioChunkImmediate)
  const startBufferedPlayback = useCallback(() => {
    if (!audioContextRef.current || audioStreamRef.current.buffer.length === 0) return;

    try {
      setIsSpeaking(true);
      audioStreamRef.current.isPlaying = true;

      const currentTime = audioContextRef.current.currentTime;
      let nextStartTime = currentTime + 0.02; // Small initial delay

      const chunkCount = audioStreamRef.current.buffer.length;

      // Play all buffered chunks in sequence
      audioStreamRef.current.buffer.forEach((chunk, index) => {
        playAudioChunkImmediate(chunk.base64Audio, index === 0, nextStartTime);
        const duration = (chunk.base64Audio.length * 3/4) / 24000; // Approximate duration
        nextStartTime += duration + 0.005; // Small gap between chunks
      });

      // Clear buffer after scheduling
      audioStreamRef.current.buffer = [];
      audioStreamRef.current.nextPlayTime = nextStartTime;

      if (debugLogsEnabled) {
        console.log(`🔊 ✅ Started buffered playback with ${chunkCount} chunks`);
      }

    } catch (error) {
      console.error('❌ Error starting buffered playback:', error);
    }
  }, [playAudioChunkImmediate]);

  // Enhanced real-time audio streaming with smart buffering to prevent initial distortion
  const playAudioChunk = useCallback((base64Audio: string, isFirstChunk: boolean = false) => {
    if (!audioContextRef.current) return;

    try {
      // For the very first chunk, buffer it briefly to collect a few chunks
      if (isFirstChunk && !audioStreamRef.current.hasStarted) {
        audioStreamRef.current.buffer = [{ base64Audio, isFirstChunk: true }];
        audioStreamRef.current.hasStarted = true;

        // Wait a moment to collect 2-3 chunks before starting playback
        setTimeout(() => {
          if (audioStreamRef.current.buffer.length > 0 && !audioStreamRef.current.isPlaying) {
            startBufferedPlayback();
          }
        }, 150); // 150ms buffer to collect initial chunks

        if (debugLogsEnabled) {
          console.log('🔊 Buffering first chunk, waiting for more...');
        }
        return;
      }

      // Add to buffer if we're still in the initial buffering phase
      if (!audioStreamRef.current.isPlaying && audioStreamRef.current.hasStarted) {
        audioStreamRef.current.buffer.push({ base64Audio, isFirstChunk: false });
        if (debugLogsEnabled) {
          console.log(`🔊 Added to buffer (${audioStreamRef.current.buffer.length} chunks)`);
        }
        return;
      }

      // If we're already playing, use the immediate playback logic
      if (audioStreamRef.current.isPlaying) {
        playAudioChunkImmediate(base64Audio, false);
      }

    } catch (error) {
      console.error('❌ Error in audio chunk buffering:', error);
    }
  }, [debugLogsEnabled, startBufferedPlayback, playAudioChunkImmediate]);

  // Simple wrapper that plays immediately (real-time streaming)
  const playGeminiAudio = useCallback((base64Audio: string, isFirstChunk: boolean = false) => {
    playAudioChunk(base64Audio, isFirstChunk);
  }, [playAudioChunk]);

  // Helper function to play audio buffer
  const playAudioBuffer = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;

    try {
      console.log('🔊 Playing audio buffer, size:', arrayBuffer.byteLength);

      // Try different decoding approaches
      let audioBuffer;

      try {
        // Method 1: Direct decodeAudioData (for standard formats like WAV, MP3, etc.)
        audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0)); // Create a copy
      } catch (directError) {
        console.log('🔍 Direct decode failed, trying as WAV...');

        // Method 2: Try to manually parse as PCM WAV
        try {
          audioBuffer = await parsePCMWav(arrayBuffer, audioContextRef.current!);
        } catch (wavError) {
          console.log('🔍 WAV parse failed, trying as raw PCM...');

          // Method 3: Try as raw PCM data
          try {
            audioBuffer = await parseRawPCM(arrayBuffer, audioContextRef.current!);
          } catch (pcmError) {
            throw new Error(`All decode methods failed: ${directError.message}, ${wavError.message}, ${pcmError.message}`);
          }
        }
      }

      // Create gain node for volume control
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = volume;

      // Play the audio
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start();

      setIsSpeaking(true);
      source.onended = () => setIsSpeaking(false);

      console.log('🔊 Playing audio buffer successfully');
    } catch (error) {
      console.error('Error playing audio buffer:', error);

      // Fallback: Create a simple tone to indicate audio was received
      try {
        const fallbackBuffer = audioContextRef.current!.createBuffer(1, 1000, 24000);
        const channelData = fallbackBuffer.getChannelData(0);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
        }

        const source = audioContextRef.current!.createBufferSource();
        source.buffer = fallbackBuffer;
        source.connect(audioContextRef.current.destination);
        source.start();

        console.log('🔊 Playing fallback tone');
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  }, [volume]);

  // Handle binary audio from WebSocket
  const handleBinaryAudio = useCallback(async (audioBlob: Blob) => {
    if (!audioContextRef.current) return;

    try {
      console.log('🔍 Audio blob details:', {
        size: audioBlob.size,
        type: audioBlob.type,
        isClosed: audioBlob.isClosed
      });

      // Try to get first few bytes to understand format
      const arrayBuffer = await audioBlob.arrayBuffer();
      const dataView = new DataView(arrayBuffer);
      console.log('🔍 First 16 bytes:', Array.from(new Uint8Array(arrayBuffer.slice(0, 16))));

      // Play the audio buffer using our helper function
      await playAudioBuffer(arrayBuffer);
    } catch (error) {
      console.error('Error handling binary audio:', error);
    }
  }, [playAudioBuffer]);

  // Parse PCM WAV format
  const parsePCMWav = useCallback(async (arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> => {
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
  }, []);

  // Parse raw PCM data
  const parseRawPCM = useCallback(async (arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> => {
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
  }, []);

  // ========== AUDIO TESTING MODULES ==========

  // Test function: Record audio → Convert to PCM → Simulate Gemini response → Play back
  const testAudioPipeline = useCallback(async () => {
    try {
      console.log('🧪 Starting audio pipeline test...');
      setTestResults(prev => [...prev, '🧪 Starting audio pipeline test...']);
      setIsAudioTesting(true);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      }

      // Step 1: Record a short audio sample (3 seconds)
      setTestResults(prev => [...prev, '📢 Recording 3-second audio sample...']);
      const recordingStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.start();
      setTestResults(prev => [...prev, '🎙️ Recording... Speak now!']);

      // Record for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));

      mediaRecorder.stop();
      setTestResults(prev => [...prev, '✅ Recording complete']);

      // Wait for recording to finish
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => {
          recordingStream.getTracks().forEach(track => track.stop());
          resolve();
        };
      });

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
      setTestResults(prev => [...prev, `📊 Recorded audio size: ${audioBlob.size} bytes`]);

      // Step 2: Convert to PCM using our Gemini-style conversion
      setTestResults(prev => [...prev, '🔄 Converting to 16kHz 16-bit PCM...']);
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

      // Analyze original audio levels
      const originalData = audioBuffer.getChannelData(0);
      let maxOriginalValue = 0;
      let avgOriginalValue = 0;
      for (let i = 0; i < originalData.length; i++) {
        const abs = Math.abs(originalData[i]);
        maxOriginalValue = Math.max(maxOriginalValue, abs);
        avgOriginalValue += abs;
      }
      avgOriginalValue /= originalData.length;

      setTestResults(prev => [...prev, `📊 Original audio - Max: ${maxOriginalValue.toFixed(4)}, Avg: ${avgOriginalValue.toFixed(4)}`]);

      // Apply normalization to prevent clipping
      const targetMax = 0.7; // Target max amplitude (70% of full scale)
      const normalizationFactor = maxOriginalValue > targetMax ? targetMax / maxOriginalValue : 1.0;

      setTestResults(prev => [...prev, `🔧 Normalization factor: ${normalizationFactor.toFixed(4)}`]);

      // Resample to 16kHz if needed with proper normalization
      const targetSampleRate = 16000;
      let pcmData: Int16Array;

      if (audioBuffer.sampleRate !== targetSampleRate) {
        // Simple resampling with normalization
        const ratio = targetSampleRate / audioBuffer.sampleRate;
        const newLength = Math.floor(audioBuffer.length * ratio);
        pcmData = new Int16Array(newLength);

        for (let i = 0; i < newLength; i++) {
          const sourceIndex = Math.floor(i / ratio);
          const normalizedValue = audioBuffer.getChannelData(0)[sourceIndex] * normalizationFactor;
          const value = normalizedValue * 32767;
          pcmData[i] = Math.max(-32768, Math.min(32767, value));
        }
      } else {
        pcmData = new Int16Array(audioBuffer.length);
        for (let i = 0; i < audioBuffer.length; i++) {
          const normalizedValue = audioBuffer.getChannelData(0)[i] * normalizationFactor;
          pcmData[i] = Math.max(-32768, Math.min(32767, normalizedValue * 32767));
        }
      }

      // Check PCM levels after conversion
      let maxPcmValue = 0;
      for (let i = 0; i < pcmData.length; i++) {
        maxPcmValue = Math.max(maxPcmValue, Math.abs(pcmData[i]));
      }
      const maxPcmPercent = (maxPcmValue / 32768) * 100;
      setTestResults(prev => [...prev, `📊 PCM levels - Max: ${maxPcmValue}, ${maxPcmPercent.toFixed(1)}% of full scale`]);

      setTestResults(prev => [...prev, `✅ PCM data created: ${pcmData.length} samples at ${targetSampleRate}Hz`]);

      // Step 3: Convert to base64 (simulating what we'd send to Gemini)
      const uint8Array = new Uint8Array(pcmData.buffer);
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

      setTestResults(prev => [...prev, `📦 Base64 encoded: ${base64Data.length} characters`]);

      // Step 4: Simulate Gemini response by converting to 24kHz (as Gemini would do)
      setTestResults(prev => [...prev, '🎭 Simulating Gemini response (16kHz → 24kHz)...']);
      const outputSampleRate = 24000;
      const resampleRatio = outputSampleRate / targetSampleRate;
      const outputLength = Math.floor(pcmData.length * resampleRatio);
      const geminiPcmData = new Int16Array(outputLength);

      // Simple linear interpolation for resampling
      for (let i = 0; i < outputLength; i++) {
        const sourceIndex = i / resampleRatio;
        const index1 = Math.floor(sourceIndex);
        const index2 = Math.min(index1 + 1, pcmData.length - 1);
        const fraction = sourceIndex - index1;

        geminiPcmData[i] = Math.floor(
          pcmData[index1] * (1 - fraction) + pcmData[index2] * fraction
        );
      }

      setTestResults(prev => [...prev, `🎯 Gemini-style PCM: ${geminiPcmData.length} samples at ${outputSampleRate}Hz`]);

      // Step 5: Play back using our existing audio playback function
      setTestResults(prev => [...prev, '🔊 Playing back simulated Gemini response...']);
      await playSimulatedGeminiAudio(geminiPcmData, outputSampleRate);

      setTestResults(prev => [...prev, '✅ Audio pipeline test complete!']);

    } catch (error) {
      console.error('❌ Audio pipeline test failed:', error);
      setTestResults(prev => [...prev, `❌ Test failed: ${error.message}`]);
    } finally {
      setIsAudioTesting(false);
    }
  }, []);

  // Helper function to play simulated Gemini audio
  const playSimulatedGeminiAudio = useCallback(async (pcmData: Int16Array, sampleRate: number) => {
    if (!audioContextRef.current) return;

    try {
      // Create audio buffer from PCM data
      const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Convert 16-bit PCM to float32 (-1.0 to 1.0)
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      // Check if we have meaningful audio data
      const maxValue = Math.max(...channelData.map(Math.abs));
      setTestResults(prev => [...prev, `📊 Max audio amplitude: ${maxValue.toFixed(4)}`]);

      if (maxValue > 0.001) {
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = volume;

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        source.onended = () => {
          console.log('🔊 Simulated Gemini audio playback finished');
          setTestResults(prev => [...prev, '🔊 Playback finished']);
        };

        source.start(0);
        setIsSpeaking(true);
        setTestResults(prev => [...prev, '🔊 Playing simulated Gemini response...']);

        // Wait for playback to finish
        await new Promise(resolve => {
          source.onended = resolve as any;
        });

        setIsSpeaking(false);
      } else {
        setTestResults(prev => [...prev, '⚠️ Audio data too quiet to play']);
      }
    } catch (error) {
      console.error('Error playing simulated audio:', error);
      setTestResults(prev => [...prev, `❌ Playback error: ${error.message}`]);
    }
  }, [volume]);

  // Test function: Play a test tone to verify audio system works
  const playTestTone = useCallback(() => {
    if (!audioContextRef.current) return;

    try {
      setTestResults(prev => [...prev, '🔔 Playing 440Hz test tone...']);

      const testBuffer = audioContextRef.current.createBuffer(1, audioContextRef.current.sampleRate * 1, audioContextRef.current.sampleRate);
      const channelData = testBuffer.getChannelData(0);

      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / audioContextRef.current.sampleRate) * 0.3;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = testBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();

      setTestResults(prev => [...prev, '✅ Test tone played successfully']);

    } catch (error) {
      console.error('Error playing test tone:', error);
      setTestResults(prev => [...prev, `❌ Test tone error: ${error.message}`]);
    }
  }, []);

  // Test function: Create and play a test PCM tone using the same Gemini audio playback path
  const testGeminiPlayback = useCallback(() => {
    if (!audioContextRef.current) return;

    try {
      setTestResults(prev => [...prev, '🧪 Testing Gemini playback with synthetic PCM...']);

      // Create a 440Hz tone at 24kHz for 1 second
      const sampleRate = 24000;
      const duration = 1; // 1 second
      const frequency = 440; // 440Hz
      const samples = sampleRate * duration;

      // Create 16-bit PCM data
      const pcmData = new Int16Array(samples);
      for (let i = 0; i < samples; i++) {
        pcmData[i] = Math.floor(Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5 * 32767);
      }

      // Convert to base64 (same as Gemini would send)
      const uint8Array = new Uint8Array(pcmData.buffer);
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

      setTestResults(prev => [...prev, `🔊 Created test PCM: ${samples} samples at ${sampleRate}Hz`]);
      setTestResults(prev => [...prev, `📦 Base64 length: ${base64Data.length}`]);

      // Test the exact same playback function we use for Gemini
      console.log('🧪 Testing playAudioChunk function with synthetic data...');
      playAudioChunk(base64Data, true); // isFirstChunk = true

    } catch (error) {
      console.error('Error testing Gemini playback:', error);
      setTestResults(prev => [...prev, `❌ Playback test error: ${error.message}`]);
    }
  }, [playAudioChunk]);

  // Setup audio recording for Gemini Live using proper PCM format (16-bit, 16kHz, mono)
  const setupAudioRecording = useCallback(async () => {
    try {
      console.log('🎤 Setting up audio recording...');

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

        // Create a direct PCM capture using AudioContext and ScriptProcessorNode
        // But this time we'll make it work by ensuring proper audio context setup
        const audioContext = audioContextRef.current;

        // Create a script processor for real-time PCM conversion
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        processorRef.current = processor;

        let audioChunkCounter = 0;

        // Create source from the microphone stream
        const source = audioContext.createMediaStreamSource(stream);

        processor.onaudioprocess = (event) => {
          // Get raw audio data
          const inputData = event.inputBuffer.getChannelData(0);

          // Calculate audio level for visualization (always do this for UI feedback)
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

          // Only send to WebSocket if we're listening and connected
          if (!isListeningRef.current || websocketRef.current?.readyState !== WebSocket.OPEN) {
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
      }

      return true;

    } catch (error) {
      console.error('Error setting up audio recording:', error);
      setError('Failed to access microphone. Please check permissions.');
      return false;
    }
  }, []);

  // Test function: Send simple text to test connection
  const testTextConnection = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const testTextMessage = "Hello! Can you hear me? Please respond with a simple greeting.";
      console.log('🧪 Testing connection with text message:', testTextMessage);

      const textMessage = {
        realtime_input: {
          text: testTextMessage
        }
      };

      try {
        websocketRef.current.send(JSON.stringify(textMessage));
        setTestResults(prev => [...prev, '📤 Text message sent to Gemini']);
      } catch (error) {
        setTestResults(prev => [...prev, `❌ Failed to send text: ${error.message}`]);
      }
    } else {
      setTestResults(prev => [...prev, `❌ WebSocket not connected (state: ${websocketRef.current?.readyState})`]);
    }
  }, []);

  // Text input fallback
  const handleTextInput = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const command = textInput.trim();
    setTextInput('');
    setError(null);

    // Send text as audio-like input to Gemini Live
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const textMessage = {
        realtime_input: {
          text: command
        }
      };

      websocketRef.current.send(JSON.stringify(textMessage));
    }
  }, [textInput]);

  // Toggle listening
  const toggleListening = async () => {
    console.log('🎙️ toggleListening called. isSDKReady:', isSDKReady, 'websocket state:', websocketRef.current?.readyState, 'isListening:', isListening);

    // Resume audio context on user interaction (required by browsers)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
      console.log('🔊 Audio context resumed due to user interaction');
    }

    if (!isSDKReady) {
      setError('Gemini Live is not connected. Retrying...');
      scheduleReconnect();
      return;
    }

    if (isListening) {
      // Stop listening
      console.log('🛑 Stopping listening');
      setIsListening(false);
      isListeningRef.current = false;
      setTranscript('');

      // Send audioStreamEnd to let Gemini know we're done speaking
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const audioStreamEndMessage = {
          realtime_input: {
            audio_stream_end: true
          }
        };
        console.log('📤 Sending audioStreamEnd');
        websocketRef.current.send(JSON.stringify(audioStreamEndMessage));
      }

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

      setAudioLevel(0);
    } else {
      // Start listening
      console.log('🎤 Starting listening...');
      try {
        const audioSetupSuccess = await setupAudioRecording();
        console.log('🎤 Audio setup success:', audioSetupSuccess);
        if (!audioSetupSuccess) {
          console.log('❌ Audio setup failed, returning early');
          return;
        }

        console.log('✅ Setting isListening to true');
        setIsListening(true);
        isListeningRef.current = true;
        setTranscript('');
        setError(null);

        console.log('🎤 Microphone is now active - Speak clearly and the AI will respond');
        console.log('🎤 Tip: Speak clearly into your microphone at a normal volume');
      } catch (error) {
        console.error('❌ Error starting audio recording:', error);
        setError('Failed to start audio recording. Please check microphone permissions.');
      }
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Clear chat
  const clearChat = () => {
    setResponses([]);
    setError(null);
  };

  // Toggle input mode
  const toggleInputMode = () => {
    setUseTextInput(!useTextInput);
    setError(null);
    if (isListening) {
      toggleListening();
    }
  };

  // Cleanup
  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    if (processorRef.current) {
      // Handle both MediaRecorder and ScriptProcessorNode
      const processor = processorRef.current;
      if ('stop' in processor) {
        // MediaRecorder
        (processor as MediaRecorder).stop();
      } else if ('disconnect' in processor) {
        // ScriptProcessorNode
        (processor as ScriptProcessorNode).disconnect();
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  useEffect(() => {
    initGeminiLive();
    return () => {
      cleanup();
    };
  }, [initGeminiLive]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-24 right-6 w-96 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl z-40"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${
            isSDKReady
              ? (isListening ? 'bg-red-500/20 border-red-500/30' : 'bg-blue-500/20 border-blue-500/30')
              : 'bg-yellow-500/20 border-yellow-500/30'
          } border`}>
            <Bot className={`w-5 h-5 ${
              !isSDKReady ? 'text-yellow-400' :
              (isListening ? 'text-red-400' : 'text-blue-400')
            }`} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Gemini Live</h3>
            <p className="text-xs text-gray-400">
              {!isSDKReady ? 'Not Ready' :
               (isListening ? 'Listening...' :
                isSpeaking ? 'Speaking...' :
                'Ready')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </motion.button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2"
        >
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </motion.div>
      )}

      {/* SDK Status */}
      {!isSDKReady && (
        <div className="mx-4 mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-xs text-yellow-400">
            Connecting to Gemini Live API... (Auto-retrying every 5 seconds)
          </p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {responses.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">
              Click the mic button to start talking
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Ask me about system health, start wash cycles, or component status
            </p>
            {isSDKReady && (
              <p className="text-green-400 text-xs mt-2">
                ✅ Gemini Live API connected
              </p>
            )}
          </div>
        ) : (
          responses.map((response, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${response.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-3 rounded-xl ${
                response.type === 'user'
                  ? 'bg-blue-500/20 border border-blue-500/30 text-blue-100'
                  : 'bg-gray-800/50 border border-gray-700/30 text-gray-100'
              }`}>
                <p className="text-sm">{response.text}</p>
                <p className="text-xs opacity-60 mt-1">
                  {response.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))
        )}

        {/* Live transcript */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[80%] p-3 rounded-xl bg-gray-800/30 border border-gray-700/20 text-gray-300">
              <p className="text-sm italic">{transcript}</p>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />

        {/* Audio Testing Interface */}
        {(testResults.length > 0 || isAudioTesting) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-400">🧪 Audio Pipeline Test</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTestResults([])}
                className="p-1 bg-purple-500/20 rounded hover:bg-purple-500/30 transition-colors"
                title="Clear test results"
              >
                <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-xs text-purple-300 opacity-90">
                  {result}
                </div>
              ))}
              {isAudioTesting && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-purple-300">Testing in progress...</span>
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-2 border-t border-purple-500/20">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={playTestTone}
                disabled={isAudioTesting}
                className="px-3 py-1 bg-purple-500/20 rounded text-xs text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                🔔 Test Tone
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={testAudioPipeline}
                disabled={isAudioTesting}
                className="px-3 py-1 bg-purple-500/20 rounded text-xs text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                🎤 Record → Play
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Audio Testing Controls (Always Visible) */}
        <div className="flex flex-wrap gap-2 p-2 bg-gray-800/20 rounded-lg">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={playTestTone}
            className="px-3 py-1 bg-blue-500/20 rounded text-xs text-blue-400 hover:bg-blue-500/30 transition-colors"
            title="Test audio system with 440Hz tone"
          >
            🔔 Test Audio
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={testGeminiPlayback}
            className="px-3 py-1 bg-orange-500/20 rounded text-xs text-orange-400 hover:bg-orange-500/30 transition-colors"
            title="Test Gemini playback with synthetic PCM data"
          >
            🧪 Test PCM Path
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={testAudioPipeline}
            disabled={isAudioTesting}
            className="px-3 py-1 bg-green-500/20 rounded text-xs text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
            title="Record 3s → Convert to PCM → Play back"
          >
            🎤 Record Test
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={testTextConnection}
            disabled={!isSDKReady}
            className="px-3 py-1 bg-purple-500/20 rounded text-xs text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            title="Test Gemini connection with text message"
          >
            💬 Test Text to AI
          </motion.button>
        </div>

        {/* Text Input Mode */}
        {useTextInput && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleTextInput}
            className="flex items-center space-x-2 p-3 bg-gray-800/30 border border-gray-700/20 rounded-lg"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 text-sm"
              disabled={isProcessing}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleInputMode}
              type="button"
              className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/40 transition-colors"
            >
              <Mic className="w-4 h-4 text-gray-400" />
            </motion.button>
          </motion.form>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Volume Control */}
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              {volume > 0 ? (
                <Volume2 className="w-4 h-4 text-gray-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Clear Chat */}
            <button
              onClick={clearChat}
              className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <Activity className="w-4 h-4 text-gray-400" />
            </button>

            {/* Debug Logs Toggle */}
            <button
              onClick={() => setDebugLogsEnabled(!debugLogsEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                debugLogsEnabled
                  ? 'bg-green-600/50 hover:bg-green-500/50'
                  : 'bg-gray-800/50 hover:bg-gray-700/50'
              }`}
              title={debugLogsEnabled ? "Disable debug logs" : "Enable debug logs"}
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>

            {/* Toggle Input Mode */}
            <button
              onClick={toggleInputMode}
              className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
              title={useTextInput ? "Switch to voice input" : "Switch to text input"}
            >
              {useTextInput ? (
                <Mic className="w-4 h-4 text-gray-400" />
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              )}
            </button>
          </div>

          {/* Audio Level Indicator */}
          {isListening && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-100"
                  style={{ width: `${Math.max(0, Math.min(100, audioLevel || 0))}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-400 w-8">{Math.round(Math.max(0, Math.min(100, audioLevel || 0)))}%</span>
            </div>
          )}

          {/* Main Action Button */}
          {!useTextInput ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isListening ? toggleListening : (isSpeaking ? stopSpeaking : toggleListening)}
              disabled={!isSDKReady}
              className={`px-6 py-3 rounded-xl font-medium text-white transition-all duration-200 flex items-center space-x-2 ${
                !isSDKReady
                  ? 'bg-gray-600/50 cursor-not-allowed'
                  : isListening
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  : isSpeaking
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
              }`}
            >
              {!isSDKReady ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting</span>
                </>
              ) : isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : isSpeaking ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Stop Speaking</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Start Live</span>
                </>
              )}
            </motion.button>
          ) : (
            <div className="px-6 py-3 bg-blue-500/20 border border-blue-500/30 rounded-xl">
              <span className="text-blue-400 font-medium text-sm">Text Input Mode Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 border-t border-gray-700/50 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Wake Word Detection</span>
            <button
              onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${
                wakeWordEnabled ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                wakeWordEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Auto-start Commands</span>
            <button
              onClick={() => setAutoStartEnabled(!autoStartEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${
                autoStartEnabled ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                autoStartEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}