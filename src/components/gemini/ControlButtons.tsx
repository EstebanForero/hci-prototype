/**
 * ControlButtons Component for Gemini Live
 * Handles main control buttons and audio level indicator
 */

import { motion } from 'framer-motion';
import { Mic, MicOff, VolumeX, Volume2, Activity, Settings } from 'lucide-react';

interface ControlButtonsProps {
  volume: number;
  onVolumeToggle: () => void;
  onClearChat: () => void;
  onDebugLogsToggle: () => void;
  debugLogsEnabled: boolean;
  onToggleInputMode: () => void;
  useTextInput: boolean;
  isListening: boolean;
  audioLevel: number;
  isSDKReady: boolean;
  isSpeaking: boolean;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
  className?: string;
}

export default function ControlButtons({
  volume,
  onVolumeToggle,
  onClearChat,
  onDebugLogsToggle,
  debugLogsEnabled,
  onToggleInputMode,
  useTextInput,
  isListening,
  audioLevel,
  isSDKReady,
  isSpeaking,
  onToggleListening,
  onStopSpeaking,
  className = ''
}: ControlButtonsProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-2">
        {/* Volume Control */}
        <button
          onClick={onVolumeToggle}
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

        {/* Debug Logs Toggle */}
        <button
          onClick={onDebugLogsToggle}
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
          onClick={onToggleInputMode}
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
          onClick={isListening ? onToggleListening : (isSpeaking ? onStopSpeaking : onToggleListening)}
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
  );
}