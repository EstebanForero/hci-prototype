/**
 * SettingsPanel Component for Gemini Live
 * Handles configuration settings for the AI assistant
 */

import { motion } from 'framer-motion';
import { VoiceProvider } from '../../types/voice';

interface SettingsPanelProps {
  wakeWordEnabled: boolean;
  autoStartEnabled: boolean;
  provider: VoiceProvider;
  onWakeWordToggle: () => void;
  onAutoStartToggle: () => void;
  onProviderChange: (provider: VoiceProvider) => void;
  className?: string;
}

export default function SettingsPanel({
  wakeWordEnabled,
  autoStartEnabled,
  provider,
  onWakeWordToggle,
  onAutoStartToggle,
  onProviderChange,
  className = ''
}: SettingsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`p-4 border-t border-gray-700/50 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Wake Word Detection</span>
        <button
          onClick={onWakeWordToggle}
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
        <span className="text-sm text-gray-400">Voice Provider</span>
        <div className="flex space-x-2">
          {(['gemini', 'openai', 'openai-webrtc'] as VoiceProvider[]).map((option) => (
            <button
              key={option}
              onClick={() => onProviderChange(option)}
              className={`px-2 py-1 rounded-md text-xs ${
                provider === option ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {option === 'gemini'
                ? 'Gemini'
                : option === 'openai'
                ? 'OpenAI (WS)'
                : 'OpenAI (WebRTC)'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Auto-start Commands</span>
        <button
          onClick={onAutoStartToggle}
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
  );
}
