/**
 * TextInput Component for Gemini Live
 * Handles text input fallback mode
 */

import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

interface TextInputProps {
  textInput: string;
  onTextInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onToggleInputMode: () => void;
  isProcessing: boolean;
  className?: string;
}

export default function TextInput({
  textInput,
  onTextInputChange,
  onSubmit,
  onToggleInputMode,
  isProcessing,
  className = ''
}: TextInputProps) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={onSubmit}
      className={`flex items-center space-x-2 p-3 bg-gray-800/30 border border-gray-700/20 rounded-lg ${className}`}
    >
      <input
        type="text"
        value={textInput}
        onChange={(e) => onTextInputChange(e.target.value)}
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
        onClick={onToggleInputMode}
        type="button"
        className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/40 transition-colors"
      >
        <Mic className="w-4 h-4 text-gray-400" />
      </motion.button>
    </motion.form>
  );
}