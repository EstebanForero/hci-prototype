import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Droplets, Thermometer, Clock, Zap, Settings, Check } from 'lucide-react';

interface WashConfigProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: WashConfiguration) => void;
}

interface WashConfiguration {
  program: string;
  temperature: number;
  spinSpeed: number;
  duration: number;
  waterLevel: 'low' | 'medium' | 'high';
  extraRinse: boolean;
  preWash: boolean;
}

const programs = [
  { id: 'quick', name: 'Quick Wash', duration: 30, icon: '⚡', temp: 40 },
  { id: 'delicate', name: 'Delicate', duration: 60, icon: '🌸', temp: 30 },
  { id: 'normal', name: 'Normal', duration: 90, icon: '👕', temp: 60 },
  { id: 'heavy', name: 'Heavy Duty', duration: 120, icon: '🛡️', temp: 90 },
  { id: 'eco', name: 'Eco Mode', duration: 150, icon: '🌱', temp: 40 },
];

export default function WashConfig({ isOpen, onClose, onStart }: WashConfigProps) {
  const [selectedProgram, setSelectedProgram] = useState(programs[2]);
  const [temperature, setTemperature] = useState(60);
  const [spinSpeed, setSpinSpeed] = useState(1200);
  const [waterLevel, setWaterLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [extraRinse, setExtraRinse] = useState(false);
  const [preWash, setPreWash] = useState(false);

  const handleStart = () => {
    const config: WashConfiguration = {
      program: selectedProgram.id,
      temperature,
      spinSpeed,
      duration: selectedProgram.duration,
      waterLevel,
      extraRinse,
      preWash,
    };
    onStart(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl border border-gray-700/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <Settings className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Wash Configuration</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Program Selection */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Select Program</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {programs.map((program) => (
                  <motion.button
                    key={program.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedProgram(program);
                      setTemperature(program.temp);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedProgram.id === program.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700/50 hover:border-gray-600/50'
                    }`}
                  >
                    <div className="text-2xl mb-2">{program.icon}</div>
                    <p className="text-white font-medium text-sm">{program.name}</p>
                    <p className="text-gray-400 text-xs mt-1">{program.duration} min</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Temperature */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center space-x-2">
                  <Thermometer className="w-4 h-4 text-orange-400" />
                  <span>Temperature</span>
                </h4>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-white">{temperature}°C</span>
                    <span className="text-gray-400 text-sm">
                      {temperature < 40 ? 'Cold' : temperature < 60 ? 'Warm' : 'Hot'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="10"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>20°C</span>
                    <span>90°C</span>
                  </div>
                </div>
              </div>

              {/* Spin Speed */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Spin Speed</span>
                </h4>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-white">{spinSpeed}</span>
                    <span className="text-gray-400 text-sm">RPM</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[800, 1000, 1200, 1400].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setSpinSpeed(speed)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                          spinSpeed === speed
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Water Level */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center space-x-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  <span>Water Level</span>
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setWaterLevel(level)}
                      className={`py-3 px-4 rounded-xl border-2 font-medium transition-all duration-200 capitalize ${
                        waterLevel === level
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-gray-700/50 text-gray-400 hover:border-gray-600/50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Options */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span>Additional Options</span>
                </h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 cursor-pointer hover:bg-gray-800/70 transition-colors">
                    <span className="text-gray-300">Extra Rinse</span>
                    <input
                      type="checkbox"
                      checked={extraRinse}
                      onChange={(e) => setExtraRinse(e.target.checked)}
                      className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 cursor-pointer hover:bg-gray-800/70 transition-colors">
                    <span className="text-gray-300">Pre-Wash</span>
                    <input
                      type="checkbox"
                      checked={preWash}
                      onChange={(e) => setPreWash(e.target.checked)}
                      className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/30">
              <h4 className="text-white font-medium mb-3">Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Program:</span>
                  <span className="ml-2 text-white font-medium">{selectedProgram.name}</span>
                </div>
                <div>
                  <span className="text-gray-400">Duration:</span>
                  <span className="ml-2 text-white font-medium">{selectedProgram.duration} min</span>
                </div>
                <div>
                  <span className="text-gray-400">Temperature:</span>
                  <span className="ml-2 text-white font-medium">{temperature}°C</span>
                </div>
                <div>
                  <span className="text-gray-400">Spin:</span>
                  <span className="ml-2 text-white font-medium">{spinSpeed} RPM</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-800/50 rounded-xl border border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-800/70 transition-all duration-200"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold text-white hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Start Wash</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}