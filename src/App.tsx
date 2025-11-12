import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import WashingMachine3D from "./components/WashingMachine3D";
import StatsDisplay from "./components/StatsDisplay";
import ControlPanel from "./components/ControlPanel";
import WashConfig from "./components/WashConfig";
import GeminiLive from "./components/GeminiLive";
import "./App.css";

interface WashConfiguration {
  program: string;
  temperature: number;
  spinSpeed: number;
  duration: number;
  waterLevel: 'low' | 'medium' | 'high';
  extraRinse: boolean;
  preWash: boolean;
}

interface PartStats {
  name: string;
  health: number;
  status: 'optimal' | 'warning' | 'critical';
  cyclesRemaining: number;
}

function App() {
  const [isActive, setIsActive] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGeminiLiveActive, setIsGeminiLiveActive] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [currentCycle, setCurrentCycle] = useState(0);
  const [totalCycles, setTotalCycles] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('0:00');
  const [washConfig, setWashConfig] = useState<WashConfiguration | null>(null);

  const [parts, setParts] = useState<PartStats[]>([
    { name: "Motor", health: 85, status: 'optimal', cyclesRemaining: 450 },
    { name: "Drum", health: 92, status: 'optimal', cyclesRemaining: 820 },
    { name: "Pump", health: 67, status: 'warning', cyclesRemaining: 234 },
    { name: "Heating Element", health: 78, status: 'optimal', cyclesRemaining: 567 },
    { name: "Control Board", health: 95, status: 'optimal', cyclesRemaining: 1200 },
    { name: "Water Inlet", health: 71, status: 'warning', cyclesRemaining: 189 },
  ]);

  const overallHealth = Math.round(parts.reduce((sum, part) => sum + part.health, 0) / parts.length);
  const totalCyclesRemaining = parts.reduce((sum, part) => sum + part.cyclesRemaining, 0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && washConfig) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const [minutes, seconds] = prev.split(':').map(Number);
          const totalSeconds = minutes * 60 + seconds - 1;

          if (totalSeconds <= 0) {
            setIsActive(false);
            setCurrentCycle(prev => prev + 1);
            return '0:00';
          }

          const newMinutes = Math.floor(totalSeconds / 60);
          const newSeconds = totalSeconds % 60;
          return `${newMinutes}:${newSeconds.toString().padStart(2, '0')}`;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, washConfig]);

  const handleStart = () => {
    if (!washConfig) {
      setIsConfigOpen(true);
      return;
    }

    setIsActive(true);
    setCurrentCycle(1);
    setTimeRemaining(`${washConfig.duration}:00`);
  };

  const handleStop = () => {
    setIsActive(false);
    setTimeRemaining('0:00');
  };

  const handleSettings = () => {
    setIsConfigOpen(true);
  };

  const handleConfigStart = (config: WashConfiguration) => {
    setWashConfig(config);
    setTotalCycles(config.extraRinse ? 2 : 1);
    setIsActive(true);
    setCurrentCycle(1);
    setTimeRemaining(`${config.duration}:00`);
  };

  const handleQuickWash = (programName: string) => {
    const programConfigs: Record<string, WashConfiguration> = {
      'Quick Wash': {
        program: 'quick',
        temperature: 40,
        spinSpeed: 1200,
        duration: 30,
        waterLevel: 'medium',
        extraRinse: false,
        preWash: false,
      },
      'Delicate': {
        program: 'delicate',
        temperature: 30,
        spinSpeed: 800,
        duration: 60,
        waterLevel: 'low',
        extraRinse: false,
        preWash: false,
      },
      'Heavy Duty': {
        program: 'heavy',
        temperature: 90,
        spinSpeed: 1400,
        duration: 120,
        waterLevel: 'high',
        extraRinse: true,
        preWash: true,
      },
      'Eco Mode': {
        program: 'eco',
        temperature: 40,
        spinSpeed: 1000,
        duration: 150,
        waterLevel: 'low',
        extraRinse: false,
        preWash: false,
      },
    };

    const config = programConfigs[programName];
    if (config) {
      handleConfigStart(config);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gray-900/50 backdrop-blur-xl border-b border-gray-700/50 px-6 py-4"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30 cursor-pointer hover:bg-blue-500/30 transition-colors"
                onClick={() => setIsApiKeyModalOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-white">SmartWash Pro</h1>
                <p className="text-gray-400 text-sm">AI-Powered Washing Machine Control</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsGeminiLiveActive(!isGeminiLiveActive)}
                className={`flex items-center space-x-3 px-4 py-2 rounded-xl border transition-all duration-200 ${
                  isGeminiLiveActive
                    ? 'bg-blue-500/20 border-blue-500/30'
                    : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${
                  isGeminiLiveActive ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  isGeminiLiveActive ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  Gemini Live
                </span>
              </motion.button>

              <div className="text-right">
                <p className="text-gray-400 text-sm">System Status</p>
                <p className="text-green-400 font-medium">Optimal</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.header>

        {/* 3D Model Section */}
        <div className="h-96 relative">
          <WashingMachine3D
            health={overallHealth}
            cyclesRemaining={totalCyclesRemaining}
            isActive={isActive}
          />
        </div>

        {/* Stats Display */}
        <StatsDisplay
          parts={parts}
          overallHealth={overallHealth}
          totalCycles={totalCyclesRemaining}
          isActive={isActive}
        />

        {/* Control Panel */}
        <ControlPanel
          isActive={isActive}
          onStart={handleStart}
          onStop={handleStop}
          onSettings={handleSettings}
          onQuickWash={handleQuickWash}
          currentCycle={currentCycle}
          totalCycles={totalCycles}
          timeRemaining={timeRemaining}
        />

        {/* Spacer for fixed control panel */}
        <div className="h-32" />
      </div>

      {/* Configuration Modal */}
      <WashConfig
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onStart={handleConfigStart}
      />

      {/* Gemini Live Assistant */}
      {isGeminiLiveActive && (
        <GeminiLive
          parts={parts}
          overallHealth={overallHealth}
          totalCycles={totalCyclesRemaining}
          onStartWash={handleConfigStart}
          isActive={isActive}
          currentCycle={currentCycle}
          totalCyclesScheduled={totalCycles}
          timeRemaining={timeRemaining}
        />
      )}

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsApiKeyModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">API Key Settings</h3>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                      input.type = input.type === 'password' ? 'text' : 'password';
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-gray-900/30 rounded-lg">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-gray-300">
                  The API key will be stored in your browser's local storage and will replace any existing key for this session.
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  if (apiKeyInput.trim()) {
                    localStorage.setItem('VITE_GEMINI_API_KEY', apiKeyInput.trim());
                    window.location.reload();
                  }
                }}
                disabled={!apiKeyInput.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Save & Reload
              </button>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export default App;
