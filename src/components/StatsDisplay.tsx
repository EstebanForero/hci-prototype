import { motion } from 'framer-motion';
import { Battery, Zap, Droplets, Clock, Activity, Shield } from 'lucide-react';

interface PartStats {
  name: string;
  health: number;
  status: 'optimal' | 'warning' | 'critical';
  cyclesRemaining: number;
}

interface StatsDisplayProps {
  parts: PartStats[];
  overallHealth: number;
  totalCycles: number;
  isActive: boolean;
  onPartClick?: (part: PartStats) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'optimal':
      return 'text-green-400 bg-green-400/10 border-green-400/30';
    case 'warning':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    case 'critical':
      return 'text-red-400 bg-red-400/10 border-red-400/30';
    default:
      return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  }
};

const getHealthBarColor = (health: number) => {
  if (health > 70) return 'bg-green-500';
  if (health > 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

export default function StatsDisplay({ parts, overallHealth, totalCycles, isActive, onPartClick }: StatsDisplayProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {/* Overall Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-full lg:col-span-3 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
              <Battery className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Overall Health</p>
              <p className="text-2xl font-bold text-white">{overallHealth}%</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Cycles</p>
              <p className="text-2xl font-bold text-white">{totalCycles}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Status</p>
              <p className="text-lg font-bold text-white">
                {isActive ? 'Running' : 'Idle'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Individual Parts */}
      {parts.map((part, index) => (
        <motion.div
          key={part.name}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPartClick?.(part)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">{part.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(part.status)}`}>
              {part.status}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Health</span>
                <span className="text-white font-medium">{part.health}%</span>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full ${getHealthBarColor(part.health)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${part.health}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Cycles Left</span>
              </div>
              <span className="text-white font-medium">{part.cyclesRemaining}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}