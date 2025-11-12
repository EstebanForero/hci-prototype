/**
 * AudioControls Component for Gemini Live
 * Handles audio testing and pipeline verification
 */

import { motion } from 'framer-motion';

interface AudioControlsProps {
  testResults: string[];
  isAudioTesting: boolean;
  onClearTestResults: () => void;
  onPlayTestTone: () => void;
  onTestAudioPipeline: () => void;
  onTestGeminiPlayback: () => void;
  onTestTextConnection: () => void;
  isSDKReady: boolean;
  className?: string;
}

export default function AudioControls({
  testResults,
  isAudioTesting,
  onClearTestResults,
  onPlayTestTone,
  onTestAudioPipeline,
  onTestGeminiPlayback,
  onTestTextConnection,
  isSDKReady
}: AudioControlsProps) {
  return (
    <>
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
              onClick={onClearTestResults}
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
              onClick={onPlayTestTone}
              disabled={isAudioTesting}
              className="px-3 py-1 bg-purple-500/20 rounded text-xs text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            >
              🔔 Test Tone
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onTestAudioPipeline}
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
          onClick={onPlayTestTone}
          className="px-3 py-1 bg-blue-500/20 rounded text-xs text-blue-400 hover:bg-blue-500/30 transition-colors"
          title="Test audio system with 440Hz tone"
        >
          🔔 Test Audio
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onTestGeminiPlayback}
          className="px-3 py-1 bg-orange-500/20 rounded text-xs text-orange-400 hover:bg-orange-500/30 transition-colors"
          title="Test Gemini playback with synthetic PCM data"
        >
          🧪 Test PCM Path
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onTestAudioPipeline}
          disabled={isAudioTesting}
          className="px-3 py-1 bg-green-500/20 rounded text-xs text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
          title="Record 3s → Convert to PCM → Play back"
        >
          🎤 Record Test
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onTestTextConnection}
          disabled={!isSDKReady}
          className="px-3 py-1 bg-purple-500/20 rounded text-xs text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          title="Test Gemini connection with text message"
        >
          💬 Test Text to AI
        </motion.button>
      </div>
    </>
  );
}