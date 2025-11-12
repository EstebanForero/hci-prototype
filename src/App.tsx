import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import WashingMachine3D from "./components/WashingMachine3D";
import StatsDisplay from "./components/StatsDisplay";
import WashConfig from "./components/WashConfig";
import GeminiLive from "./components/GeminiLive";
import SidebarLayout from "./components/SidebarLayout";
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

function getComponentInfo(componentName: string, health: number) {
  const infoData: Record<string, any> = {
    "Motor": {
      description: "The motor powers the drum rotation and spin cycles.",
      maintenance: "Keep bearings lubricated and check belt tension annually.",
      warning: "Unusual noises or vibration indicate wear.",
      critical: "Motor failure requires professional replacement.",
      replacement: "Unplug washer, remove back panel, disconnect wiring, unbolt motor, install new unit (~$200-400)."
    },
    "Drum": {
      description: "The stainless steel drum holds clothes during washing.",
      maintenance: "Clean drum gasket regularly and leave door open between cycles.",
      warning: "Rust spots or cracks need immediate attention.",
      critical: "Cracked drum can leak and damage clothes.",
      replacement: "Remove top panel, disconnect spring clips, lift out old drum, install new one (~$150-300)."
    },
    "Pump": {
      description: "The pump removes water from the drum during drain cycles.",
      maintenance: "Clean filter regularly and check for blockages.",
      warning: "Slow draining indicates pump issues.",
      critical: "Pump failure causes water backup and flooding.",
      replacement: "Unplug washer, remove front panel, disconnect hoses, unbolt pump, install new one (~$100-250)."
    },
    "Heating Element": {
      description: "Heats water to optimal washing temperatures.",
      maintenance: "Descale monthly to prevent mineral buildup.",
      warning: "Water not getting hot indicates element issues.",
      critical: "Failed element prevents hot water washing.",
      replacement: "Unplug washer, remove back panel, disconnect wiring, remove mounting screws, install new element (~$80-150)."
    },
    "Control Board": {
      description: "Electronic brain controlling all washer functions.",
      maintenance: "Keep dry and clean, avoid power surges.",
      warning: "Error codes or erratic behavior indicate issues.",
      critical: "Board failure renders washer inoperable.",
      replacement: "Unplug washer, document wiring, remove board, transfer settings to new board (~$200-500)."
    },
    "Water Inlet": {
      description: "Controls water flow into the washing machine.",
      maintenance: "Clean inlet screens quarterly and check hoses.",
      warning: "Slow filling or leaking indicates problems.",
      critical: "Complete failure prevents water intake.",
      replacement: "Unplug washer, turn off water, disconnect hoses, remove inlet valve, install new one (~$50-120)."
    }
  };

  const info = infoData[componentName] || infoData["Motor"];

  return (
    <>
      <div className="p-4 bg-gray-900/30 rounded-lg">
        <h4 className="font-medium text-white mb-2">About this component</h4>
        <p className="text-sm text-gray-300">{info.description}</p>
      </div>

      {health <= 20 ? (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
          <h4 className="font-medium text-red-400 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Critical Condition - Immediate Action Required
          </h4>
          <p className="text-sm text-red-300 mb-3">{info.critical}</p>
          <div className="bg-red-900/30 p-3 rounded-lg">
            <h5 className="font-medium text-red-400 mb-2">Replacement Instructions:</h5>
            <p className="text-xs text-red-200">{info.replacement}</p>
          </div>
        </div>
      ) : health <= 50 ? (
        <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
          <h4 className="font-medium text-yellow-400 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Warning - Maintenance Recommended
          </h4>
          <p className="text-sm text-yellow-300 mb-2">{info.warning}</p>
          <p className="text-sm text-gray-300">{info.maintenance}</p>
        </div>
      ) : (
        <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
          <h4 className="font-medium text-green-400 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Good Condition
          </h4>
          <p className="text-sm text-gray-300">{info.maintenance}</p>
        </div>
      )}

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h5 className="font-medium text-blue-400 mb-2">Pro Tips:</h5>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Check this component every 6 months</li>
          <li>• Use appropriate detergent amounts</li>
          <li>• Don't overload the washer</li>
          <li>• Schedule professional service annually</li>
        </ul>
      </div>
    </>
  );
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
  const [currentUsage, setCurrentUsage] = useState({ electricityKw: 0, waterLiters: 0 });

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

  const [selectedPart, setSelectedPart] = useState<PartStats | null>(null);
  const [showPartInfo, setShowPartInfo] = useState(false);

  // Calculate resource usage based on wash configuration
  const calculateResourceUsage = (config: WashConfiguration) => {
    // Base electricity consumption (kW) by temperature and program
    const baseElectricity: Record<string, number> = {
      'Quick Wash': 0.5,
      'Daily': 0.8,
      'Heavy': 2.0,
      'Delicate': 0.6,
      'Eco': 0.4,
      'Whites': 1.2,
      'Colors': 0.9,
      'Sportswear': 0.7
    };

    // Temperature multiplier (higher temp = more electricity)
    const tempMultiplier = 1 + (config.temperature - 20) * 0.02;

    // Spin speed multiplier (higher speed = more electricity)
    const spinMultiplier = 1 + (config.spinSpeed - 800) * 0.0002;

    // Extra options cost
    const extraCosts = (config.extraRinse ? 0.15 : 0) + (config.preWash ? 0.25 : 0);

    // Calculate electricity usage
    const programName = config.program || 'Daily';
    const baseKw = baseElectricity[programName] || 0.8;
    const electricityKw = baseKw * tempMultiplier * spinMultiplier + extraCosts;

    // Water usage calculation (liters)
    const baseWater: Record<string, number> = {
      'Quick Wash': 25,
      'Daily': 45,
      'Heavy': 80,
      'Delicate': 40,
      'Eco': 30,
      'Whites': 50,
      'Colors': 45,
      'Sportswear': 35
    };

    const baseLiters = baseWater[programName] || 45;
    const waterLevelMultiplier = {
      'low': 0.7,
      'medium': 1.0,
      'high': 1.3
    };

    const waterLiters = baseLiters * waterLevelMultiplier[config.waterLevel] +
                       (config.extraRinse ? 15 : 0) +
                       (config.preWash ? 20 : 0);

    return { electricityKw: Math.round(electricityKw * 10) / 10, waterLiters: Math.round(waterLiters) };
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

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
    // Always show settings modal when starting wash
    setIsConfigOpen(true);
  };

  const handleStop = () => {
    setIsActive(false);
    setTimeRemaining('0:00');
    setCurrentUsage({ electricityKw: 0, waterLiters: 0 });
  };

  const handleGetConsumption = (config: any) => {
    // Convert AI config format to WashConfiguration format
    const washConfig: WashConfiguration = {
      program: config.program || 'Daily',
      temperature: config.temperature || 40,
      spinSpeed: config.spin_speed || 1000,
      duration: config.duration || 60,
      waterLevel: config.water_level || 'medium',
      extraRinse: config.extra_rinse || false,
      preWash: config.pre_wash || false
    };

    // Calculate resource usage using existing function
    const usage = calculateResourceUsage(washConfig);

    // Calculate costs and environmental impact
    const electricityCostPerKw = 0.15; // Average cost per kWh
    const waterCostPerLiter = 0.004; // Average cost per liter

    const estimatedElectricityCost = usage.electricityKw * electricityCostPerKw;
    const estimatedWaterCost = usage.waterLiters * waterCostPerLiter;
    const totalEstimatedCost = estimatedElectricityCost + estimatedWaterCost;

    // Return consumption data in format expected by AI
    return {
      program: washConfig.program,
      temperature: washConfig.temperature,
      spin_speed: washConfig.spinSpeed,
      duration: washConfig.duration,
      water_level: washConfig.waterLevel,
      extra_rinse: washConfig.extraRinse,
      pre_wash: washConfig.preWash,
      electricity_usage: {
        kw: usage.electricityKw,
        estimated_cost: Math.round(estimatedElectricityCost * 100) / 100
      },
      water_usage: {
        liters: usage.waterLiters,
        estimated_cost: Math.round(estimatedWaterCost * 100) / 100
      },
      total_estimated_cost: Math.round(totalEstimatedCost * 100) / 100,
      efficiency_rating: usage.electricityKw <= 1.0 ? 'High' : usage.electricityKw <= 1.5 ? 'Medium' : 'Low',
      environmental_impact: {
        co2_emissions_kg: Math.round(usage.electricityKw * 0.4 * 100) / 100,
        water_efficiency: usage.waterLiters <= 40 ? 'Excellent' : usage.waterLiters <= 60 ? 'Good' : 'Fair'
      }
    };
  };


  const handleConfigStart = (config: WashConfiguration) => {
    setWashConfig(config);
    setTotalCycles(config.extraRinse ? 2 : 1);

    // Calculate resource usage
    const usage = calculateResourceUsage(config);
    setCurrentUsage(usage);

    setIsActive(true);
    setCurrentCycle(1);
    setTimeRemaining(`${config.duration}:00`);
  };

  
  return (
    <SidebarLayout
      isActive={isActive}
      health={overallHealth}
      cyclesRemaining={totalCyclesRemaining}
      timeRemaining={timeRemaining}
      onStartWash={handleStart}
      onStopWash={handleStop}
      washConfig={washConfig}
    >
      <div className="h-full flex flex-col">
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
            electricityUsage={currentUsage.electricityKw}
            waterUsage={currentUsage.waterLiters}
            useCustomModel={true}
            modelUrl="/models/washer.glb"
          />
        </div>

        {/* Stats Display */}
        <StatsDisplay
          parts={parts}
          overallHealth={overallHealth}
          totalCycles={totalCyclesRemaining}
          isActive={isActive}
          onPartClick={(part) => {
            setSelectedPart(part);
            setShowPartInfo(true);
          }}
        />

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
          onStopWash={handleStop}
          onGetConsumption={handleGetConsumption}
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
              <h3 className="text-xl font-semibold text-white">Developer Settings</h3>
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

              {/* Component Health Controls */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Component Health Controls
                </label>
                <div className="space-y-2">
                  {parts.map((part, index) => (
                    <div key={part.name} className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          part.health > 80 ? 'bg-green-400' :
                          part.health > 50 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}></div>
                        <span className="text-sm text-gray-300">{part.name}</span>
                        <span className="text-xs text-gray-400">{part.health}%</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const newParts = [...parts];
                            newParts[index].health = Math.max(0, newParts[index].health - 5);
                            // Update status based on health
                            if (newParts[index].health <= 20) {
                              newParts[index].status = 'critical';
                            } else if (newParts[index].health <= 50) {
                              newParts[index].status = 'warning';
                            } else {
                              newParts[index].status = 'optimal';
                            }
                            setParts(newParts);
                          }}
                          className="px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs transition-colors"
                        >
                          -5%
                        </button>
                        <button
                          onClick={() => {
                            const newParts = [...parts];
                            newParts[index].health = Math.min(100, newParts[index].health + 5);
                            // Update status based on health
                            if (newParts[index].health > 80) {
                              newParts[index].status = 'optimal';
                            } else if (newParts[index].health > 50) {
                              newParts[index].status = 'warning';
                            } else {
                              newParts[index].status = 'critical';
                            }
                            setParts(newParts);
                          }}
                          className="px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-xs transition-colors"
                        >
                          +5%
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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

      {/* Component Information Modal */}
      {showPartInfo && selectedPart && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPartInfo(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${
                  selectedPart.health > 80 ? 'bg-green-400' :
                  selectedPart.health > 50 ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <h3 className="text-xl font-semibold text-white">{selectedPart.name}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  selectedPart.health > 80 ? 'bg-green-500/20 text-green-400' :
                  selectedPart.health > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {selectedPart.health}% ({selectedPart.status})
                </span>
              </div>
              <button
                onClick={() => setShowPartInfo(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {getComponentInfo(selectedPart.name, selectedPart.health)}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowPartInfo(false)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </div>
    </SidebarLayout>
  );
}

export default App;
