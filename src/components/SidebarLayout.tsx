/**
 * Modern Sidebar Layout for SmartWash AI
 * Compact, expandible sidebar with vertical progress indicators
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Activity,
  TrendingUp
} from 'lucide-react';

interface SidebarLayoutProps {
  children: React.ReactNode;
  isActive: boolean;
  health: number;
  cyclesRemaining: number;
  timeRemaining: string;
  onStartWash: () => void;
  onStopWash: () => void;
  washConfig?: any;
}

export default function SidebarLayout({
  children,
  isActive,
  health,
  cyclesRemaining,
  timeRemaining,
  onStartWash,
  onStopWash,
  washConfig
}: SidebarLayoutProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate progress based on time remaining (assuming 60 min cycles)
  const totalMinutes = 60;
  const [minutes, seconds] = timeRemaining.split(':').map(Number);
  const currentMinutes = minutes + seconds / 60;
  const progress = Math.max(0, Math.min(100, ((totalMinutes - currentMinutes) / totalMinutes) * 100));

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <motion.aside
        className="relative bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl cursor-pointer"
        initial={{ width: isExpanded ? 320 : 80 }}
        animate={{ width: isExpanded ? 320 : 80 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="h-full flex flex-col p-4">
          {/* Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-white" />
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="overflow-hidden"
                  >
                    <h1 className="text-xl font-bold text-white">SmartWash</h1>
                    <p className="text-xs text-slate-400">AI Assistant</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Vertical Progress Bar */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">Cycle Progress</span>
                    <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Vertical Progress Container */}
            <div className="flex justify-center">
              <div className="relative w-8 h-48 bg-slate-700/30 rounded-full overflow-hidden">
                <motion.div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full"
                  initial={{ height: 0 }}
                  animate={{ height: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {/* Progress indicator */}
                <motion.div
                  className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg"
                  initial={{ bottom: 0 }}
                  animate={{ bottom: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mt-3"
                >
                  <div className="text-center mb-2">
                    <div className="text-lg font-mono text-white">{timeRemaining}</div>
                    <div className="text-xs text-slate-400">remaining</div>
                  </div>

                  {/* Stage Indicators */}
                  <div className="space-y-1 text-xs">
                    <div className={`flex items-center space-x-2 ${progress > 15 ? 'text-blue-400' : 'text-slate-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${progress > 15 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                      <span>Filling</span>
                    </div>
                    <div className={`flex items-center space-x-2 ${progress > 30 ? 'text-blue-400' : 'text-slate-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${progress > 30 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                      <span>Washing</span>
                    </div>
                    <div className={`flex items-center space-x-2 ${progress > 60 ? 'text-blue-400' : 'text-slate-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${progress > 60 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                      <span>Rinsing</span>
                    </div>
                    <div className={`flex items-center space-x-2 ${progress > 85 ? 'text-blue-400' : 'text-slate-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${progress > 85 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                      <span>Spinning</span>
                    </div>
                    <div className={`flex items-center space-x-2 ${progress >= 100 ? 'text-green-400' : 'text-slate-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${progress >= 100 ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <span>Complete</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Status Cards */}
          <motion.div
            className="space-y-4 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* Health Status */}
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  health > 70 ? 'bg-green-400' : health > 40 ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1"
                    >
                      <div className="text-sm text-slate-300">Machine Health</div>
                      <div className="text-xs text-slate-400">{health}% optimal</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "100%" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="mt-2"
                  >
                    <div className="w-full bg-slate-600/30 rounded-full h-1.5">
                      <motion.div
                        className={`h-full rounded-full ${
                          health > 70 ? 'bg-green-400' : health > 40 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${health}%` }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cycles Status */}
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="flex items-center space-x-3">
                <TrendingUp size={16} className="text-blue-400" />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1"
                    >
                      <div className="text-sm text-slate-300">Cycles Left</div>
                      <div className="text-xs text-slate-400">{cyclesRemaining} remaining</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Wash Status */}
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1"
                    >
                      <div className="text-sm text-slate-300">
                        {isActive ? 'Washing' : 'Idle'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {washConfig ? `${washConfig.cycle} cycle` : 'Ready to start'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Control Buttons */}
          <motion.div
            className="mt-auto space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                isActive ? onStopWash() : onStartWash();
              }}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                isActive
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isActive ? <Pause size={18} /> : <Play size={18} />}
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    {isActive ? 'Stop Wash' : 'Start Wash'}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            </motion.div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}