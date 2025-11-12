/**
 * ControlButtons Component for Gemini Live
 * Handles main control buttons for voice input and chat controls
 */

import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, Activity } from 'lucide-react';

interface ControlButtonsProps {
  isListening: boolean;
  isSpeaking: boolean;
  isSDKReady: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  onVoiceInput: () => void;
  onStopSpeaking: () => void;
  onClearChat: () => void;
  onToggleInputMode: () => void;
}

export default function ControlButtons({
  isListening,
  isSpeaking,
  isSDKReady,
  volume,
  setVolume,
  onVoiceInput,
  onStopSpeaking,
  onClearChat,
  onToggleInputMode
}: ControlButtonsProps) {
  // Handle main action button click
  const handleMainAction = () => {
    if (isListening) {
      onVoiceInput(); // Stop listening
    } else if (isSpeaking) {
      onStopSpeaking(); // Stop speaking
    } else {
      onVoiceInput(); // Start listening
    }
  };

  return (
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
            onClick={onClearChat}
            className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
          >
            <Activity className="w-4 h-4 text-gray-400" />
          </button>

          {/* Toggle Input Mode */}
          <button
            onClick={onToggleInputMode}
            className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
            title="Switch to text input"
          >
            <MessageCircle className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Main Action Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleMainAction}
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
      </div>
    </div>
  );
}