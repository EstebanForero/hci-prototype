import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import WashingMachine3D from "./components/WashingMachine3D";
import StatsDisplay from "./components/StatsDisplay";
import ControlPanel from "./components/ControlPanel";
import WashConfig from "./components/WashConfig";
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
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">SmartWash Pro</h1>
                <p className="text-gray-400 text-sm">AI-Powered Washing Machine Control</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
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
          currentCycle={currentCycle}
          totalCycles={totalCycles}
          timeRemaining={timeRemaining}
        />
      </div>

      {/* Configuration Modal */}
      <WashConfig
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onStart={handleConfigStart}
      />
    </div>
  );
}

export default App;
