/**
 * Clean GeminiLive Component - Focused on UI coordination only
 * All technical implementation details moved to services
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, Settings, MessageCircle } from "lucide-react";

// Import types
import {
  GeminiLiveProps,
  ComponentMetrics,
  ChatMessage,
} from "../types/gemini";

// Import modular services
import { GeminiConnectionManager, ConnectionCallbacks } from "../services/geminiConnectionManager";
import { GeminiAudioService, AudioCallbacks } from "../services/geminiAudioService";

// Import modular UI components
import ChatMessages from "./gemini/ChatMessages";
import TextInput from "./gemini/TextInput";
import SettingsPanel from "./gemini/SettingsPanel";
import ControlButtons from "./gemini/ControlButtons";

const GeminiLive: React.FC<GeminiLiveProps> = ({
  parts,
  overallHealth,
  totalCycles,
  onStartWash,
  onStopWash,
  onGetConsumption,
  isActive,
  currentCycle,
  totalCyclesScheduled,
  timeRemaining,
}) => {

  // Wash configuration presets with costs
  const washPresets = [
    {
      name: "Quick Wash",
      emoji: "🟢",
      duration: 15,
      temperature: 30,
      spinSpeed: 800,
      waterLevel: "low" as const,
      electricityCost: 0.45,
      waterCost: 25,
      program: "quick"
    },
    {
      name: "Daily",
      emoji: "🔵",
      duration: 30,
      temperature: 40,
      spinSpeed: 1000,
      waterLevel: "medium" as const,
      electricityCost: 0.85,
      waterCost: 45,
      program: "daily"
    },
    {
      name: "Heavy",
      emoji: "🟡",
      duration: 90,
      temperature: 60,
      spinSpeed: 1200,
      waterLevel: "high" as const,
      electricityCost: 2.20,
      waterCost: 80,
      program: "heavy"
    },
    {
      name: "Delicate",
      emoji: "🔴",
      duration: 45,
      temperature: 20,
      spinSpeed: 600,
      waterLevel: "medium" as const,
      electricityCost: 0.65,
      waterCost: 40,
      program: "delicate"
    }
  ];
  // UI State only
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responses, setResponses] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState(0.8);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Services
  const connectionManagerRef = useRef<GeminiConnectionManager | null>(null);
  const audioServiceRef = useRef<GeminiAudioService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responses]);

  // Add response to chat
  const addResponse = useCallback((text: string, type: 'user' | 'assistant') => {
    setResponses(prev => [...prev, {
      text,
      timestamp: new Date(),
      type
    }]);
  }, []);

  // Clear responses
  const clearResponses = useCallback(() => {
    setResponses([]);
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  // Initialize services (only once)
  const initializeServices = useCallback(() => {
    // Prevent multiple initializations
    if (connectionManagerRef.current && audioServiceRef.current) {
      console.log('🔧 Services already initialized');
      return;
    }

    console.log('🔧 Initializing Gemini services...');

    // Clean up any existing services first
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
      connectionManagerRef.current = null;
    }
    if (audioServiceRef.current) {
      audioServiceRef.current.cleanup();
      audioServiceRef.current = null;
    }

    // Initialize audio service
    audioServiceRef.current = new GeminiAudioService(false); // Disable debug logs for now

    // Initialize connection manager with callbacks
    const connectionCallbacks: ConnectionCallbacks = {
      onReady: () => {
        console.log('✅ Gemini connection ready');
        setIsSDKReady(true);
        setError(null);
      },
      onError: (errorMessage: string) => {
        console.error('❌ Connection error:', errorMessage);
        setError(errorMessage);
        setIsSDKReady(false);
      },
      onMessage: (message: any) => {
        if (message.text) {
          addResponse(message.text, message.type || 'assistant');
        }
      },
      onTranscription: (text: string) => {
        setTranscript(text);
      },
      onToolCall: async (toolCalls: any[]) => {
        console.log('🛠️ Received tool calls:', toolCalls);
        if (connectionManagerRef.current) {
          try {
            const toolManager = connectionManagerRef.current.getToolManager();
            if (toolManager) {
              console.log('🔨 Executing tool calls...');
              const toolResponses = await toolManager.executeToolCalls(toolCalls);
              console.log('✅ Tool responses:', toolResponses);
              // The toolResponses should already be in the correct format (id, name, response)
              connectionManagerRef.current.sendToolResponse(toolResponses);
            }
          } catch (error) {
            console.error('❌ Tool call execution error:', error);
          }
        }
      },
      onAudioChunk: (audioData: string, isFirstChunk: boolean) => {
        // Play audio chunk immediately with current volume
        connectionManagerRef.current?.playAudioChunk(audioData, isFirstChunk, volume);

        // Set speaking state for first chunk
        if (isFirstChunk) {
          setIsSpeaking(true);
        }
      },
      onTurnComplete: () => {
        console.log('🔄 Turn complete - stopping speech and clearing audio buffer');
        connectionManagerRef.current?.clearAudioBuffer(); // Clear any remaining audio chunks
        setTimeout(() => {
          setIsSpeaking(false);
        }, 500);
      }
    };

    connectionManagerRef.current = new GeminiConnectionManager(connectionCallbacks);
  }, [addResponse, volume]);

  // Connect to Gemini Live
  const connectToGemini = useCallback(async () => {
    if (!connectionManagerRef.current) {
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      setError('Please add your Gemini API key to .env file');
      return;
    }

    const systemStatus = {
      overallHealth,
      isActive,
      currentCycle,
      totalCyclesScheduled,
      timeRemaining,
      parts
    };

    const success = await connectionManagerRef.current.connect(apiKey, systemStatus, onStartWash, onStopWash, onGetConsumption);
  }, [overallHealth, isActive, currentCycle, totalCyclesScheduled, timeRemaining, parts, onStartWash, onStopWash, onGetConsumption]);

  // Initialize services on mount (only once)
  useEffect(() => {
    initializeServices();
  }, []); // Remove dependencies to prevent re-initialization

  // Connect to Gemini once services are ready
  useEffect(() => {
    if (connectionManagerRef.current && !isSDKReady) {
      connectToGemini();
    }
  }, [connectionManagerRef.current, isSDKReady, connectToGemini]);

  // Handle voice input toggle
  const handleVoiceInput = useCallback(async () => {
    if (!connectionManagerRef.current || !isSDKReady) {
      setError('Please connect to Gemini Live first');
      return;
    }

    if (!audioServiceRef.current) {
      setError('Audio service not initialized');
      return;
    }

    try {
      if (isListening) {
        console.log('🛑 Stopping voice input...');

        // Stop recording
        audioServiceRef.current.stopRecording();
        setIsListening(false);

        // Send audio stream end signal
        connectionManagerRef.current.sendAudioStreamEnd();

        // Clear transcript
        clearTranscript();

        // Voice input stopped
      } else {

        // Setup audio callbacks
        const audioCallbacks: AudioCallbacks = {
          onAudioData: (base64Audio: string) => {
            // Send audio to Gemini in real-time
            connectionManagerRef.current?.sendAudio(base64Audio);
          },
          onAudioLevel: (level: number) => {
            setAudioLevel(level);
          },
          onError: (errorMessage: string) => {
            setError(errorMessage);
          }
        };

        // Start recording
        const success = await audioServiceRef.current.startRecording(audioCallbacks);
        if (success) {
          setIsListening(true);
          clearTranscript();
        } else {
          setError('Failed to start voice input');
        }
      }
    } catch (error) {
      console.error('Voice input error:', error);
      setError('Voice input error: ' + (error as Error).message);
    }
  }, [isListening, isSDKReady, clearTranscript]);

  // Handle text input
  const handleTextInput = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !connectionManagerRef.current) return;

    const command = textInput.trim();
    setTextInput('');
    setError(null);

    // Add user message to chat
    addResponse(command, 'user');

    // Send text to Gemini
    connectionManagerRef.current.sendText(command);
  }, [textInput, addResponse]);

  // Handle text input from TextInput component
  const handleTextInputSubmit = useCallback((text: string) => {
    if (!connectionManagerRef.current) return;

    addResponse(text, 'user');
    connectionManagerRef.current.sendText(text);
  }, [addResponse]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
  }, []);

  // Toggle input mode
  const toggleInputMode = useCallback(() => {
    setUseTextInput(!useTextInput);
    setError(null);
    if (isListening) {
      handleVoiceInput();
    }
  }, [useTextInput, isListening, handleVoiceInput]);

  // Toggle settings
  const toggleSettings = useCallback(() => {
    setIsSettingsOpen(!isSettingsOpen);
  }, [isSettingsOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionManagerRef.current?.disconnect();
      audioServiceRef.current?.cleanup();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-4 right-4 w-96 bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden z-[60]"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              isSDKReady
                ? (isListening ? 'bg-red-400 animate-pulse' : 'bg-green-400')
                : 'bg-yellow-400 animate-pulse'
            }`}></div>
            <h3 className="text-white font-semibold">SmartWash AI</h3>
          </div>
          <button
            onClick={toggleSettings}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
        >
          <p className="text-xs text-red-400">{error}</p>
        </motion.div>
      )}

      
      {/* Chat Messages */}
      <div className={`${!isActive && isSDKReady ? 'h-48' : 'h-64'} overflow-y-auto p-4 space-y-2`}>
        <ChatMessages
          responses={responses}
          transcript={transcript}
          isSDKReady={isSDKReady}
          messagesEndRef={messagesEndRef}
        />
      </div>

  
      {/* Voice Level Indicator */}
      {isListening && (
        <div className="px-4 py-2">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-blue-400" />
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, audioLevel))}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-400 w-8">
              {Math.round(Math.max(0, Math.min(100, audioLevel)))}%
            </span>
          </div>
        </div>
      )}

      {/* Text Input Mode */}
      {useTextInput ? (
        <TextInput
          textInput={textInput}
          setTextInput={setTextInput}
          onSubmit={handleTextInputSubmit}
          onToggleMode={toggleInputMode}
        />
      ) : (
        /* Control Buttons */
        <ControlButtons
          isListening={isListening}
          isSpeaking={isSpeaking}
          isSDKReady={isSDKReady}
          volume={volume}
          setVolume={setVolume}
          onVoiceInput={handleVoiceInput}
          onStopSpeaking={stopSpeaking}
          onClearChat={clearResponses}
          onToggleInputMode={toggleInputMode}
        />
      )}

      {/* Settings Panel */}
      {isSettingsOpen && (
        <SettingsPanel
          wakeWordEnabled={wakeWordEnabled}
          setWakeWordEnabled={setWakeWordEnabled}
          autoStartEnabled={autoStartEnabled}
          setAutoStartEnabled={setAutoStartEnabled}
        />
      )}
    </motion.div>
  );
};

export default GeminiLive;