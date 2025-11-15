/**
 * Nylon Detection Modal Component
 * Renders as a portal to display wash recommendations
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface NylonDetectionModalProps {
  isOpen: boolean;
  washProgram: any;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NylonDetectionModal({ isOpen, washProgram, onConfirm, onCancel }: NylonDetectionModalProps) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  if (!isOpen || !washProgram) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999
        }}
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="mx-4 max-w-md w-full"
          style={{ maxHeight: '90vh', overflow: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
            {/* Header with icon */}
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-purple-500/20 rounded-full">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">
                Nylon Clothes Detected! 🧵
              </h3>
              <p className="text-purple-400 text-sm">
                We recommend this wash program:
              </p>
            </div>

            {/* Wash Program Details */}
            <div className="bg-black/30 rounded-xl p-5 mb-6 border border-white/10">
              <div className="text-center mb-4">
                <h4 className="text-lg font-semibold text-white mb-2">
                  {washProgram.displayName}
                </h4>
                <p className="text-gray-400 text-sm">
                  {washProgram.description}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Temperature
                  </span>
                  <span className="text-white font-medium">{washProgram.config.temperature_setting}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Cycle Type
                  </span>
                  <span className="text-white font-medium capitalize">{washProgram.config.cycle.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Duration
                  </span>
                  <span className="text-white font-medium">{washProgram.config.duration} minutes</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-400 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Spin Speed
                  </span>
                  <span className="text-white font-medium">{washProgram.config.spinSpeed} RPM</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className="flex-1 px-4 py-3 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 rounded-xl transition-colors border border-gray-600/30"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-400 rounded-xl transition-colors border border-purple-500/30 font-medium"
              >
                Start Wash
              </motion.button>
            </div>

            {/* QR Code Info */}
            <div className="mt-4 text-center">
              <p className="text-gray-500 text-xs">
                Detected from: "{washProgram.originalQRText.substring(0, 50)}{washProgram.originalQRText.length > 50 ? '...' : ''}"
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}