/**
 * SettingsPanel Component for Gemini Live
 * Handles configuration settings for the AI assistant
 */

import { motion } from 'framer-motion';

interface SettingsPanelProps {
  wakeWordEnabled: boolean;
  autoStartEnabled: boolean;
  onWakeWordToggle: () => void;
  onAutoStartToggle: () => void;
  className?: string;
}

export default function SettingsPanel({
  wakeWordEnabled,
  autoStartEnabled,
  onWakeWordToggle,
  onAutoStartToggle,
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