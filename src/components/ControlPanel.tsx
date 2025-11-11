import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Settings, Pause, RotateCcw, Power } from 'lucide-react';

interface ControlPanelProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onSettings: () => void;
  onQuickWash: (program: string) => void;
  currentCycle?: number;
  totalCycles?: number;
  timeRemaining?: string;
}

export default function ControlPanel({
  isActive,
  onStart,
  onStop,
  onSettings,
  onQuickWash,
  currentCycle = 0,
  totalCycles = 1,
  timeRemaining = '0:00'
}: ControlPanelProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-xl border-t border-gray-700/50 p-6 z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-7xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Progress</span>
            <span>Cycle {currentCycle} of {totalCycles}</span>
          </div>
          <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              initial={{ width: '0%' }}
              animate={{ width: `${(currentCycle / totalCycles) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Time Display */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Time Remaining</p>
              <p className="text-2xl font-bold text-white tabular-nums">{timeRemaining}</p>
            </div>

            {isActive && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium">Running</span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSettings}
              className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 group"
            >
              <Settings className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStop}
              className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 hover:bg-red-500/30 transition-all duration-200 group"
            >
              <Power className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(34, 197, 94, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={isActive ? onStop : onStart}
              className={`px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 flex items-center space-x-3 ${
                isActive
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-5 h-5" />
                  <span>Stop Wash</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Start Wash</span>
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Quick Actions with Smooth Animation */}
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isHovered ? "auto" : 0,
            opacity: isHovered ? 1 : 0,
            marginBottom: isHovered ? 0 : -20
          }}
          transition={{
            height: { duration: 0.3, ease: "easeInOut" },
            opacity: { duration: 0.2, delay: isHovered ? 0.1 : 0 },
            marginBottom: { duration: 0.3 }
          }}
          className="overflow-hidden"
        >
          <div className="pt-4 border-t border-gray-700/30">
            <div className="flex justify-center space-x-3">
              {[
                { name: 'Quick Wash', icon: '⚡', color: 'blue' },
                { name: 'Delicate', icon: '🌸', color: 'pink' },
                { name: 'Heavy Duty', icon: '🛡️', color: 'orange' },
                { name: 'Eco Mode', icon: '🌱', color: 'green' }
              ].map((program, index) => (
                <motion.button
                  key={program.name}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: isHovered ? 1 : 0.8,
                    opacity: isHovered ? 1 : 0
                  }}
                  transition={{
                    scale: { duration: 0.2, delay: isHovered ? index * 0.05 : 0 },
                    opacity: { duration: 0.2, delay: isHovered ? index * 0.05 : 0 }
                  }}
                  onClick={() => onQuickWash(program.name)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-3 bg-gray-800/50 rounded-xl text-sm font-medium transition-all duration-200 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 group
                    ${program.color === 'blue' ? 'hover:bg-blue-500/20 hover:border-blue-500/30' : ''}
                    ${program.color === 'pink' ? 'hover:bg-pink-500/20 hover:border-pink-500/30' : ''}
                    ${program.color === 'orange' ? 'hover:bg-orange-500/20 hover:border-orange-500/30' : ''}
                    ${program.color === 'green' ? 'hover:bg-green-500/20 hover:border-green-500/30' : ''}
                  `}
                >
                  <span className="flex items-center space-x-2">
                    <span className="text-lg">{program.icon}</span>
                    <span className="text-gray-400 group-hover:text-white transition-colors">
                      {program.name}
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}