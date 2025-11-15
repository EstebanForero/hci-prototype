/**
 * Modular QR Scanner Component
 * Handles background QR code scanning functionality without visual interface
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import jsQR from 'jsqr';
import { createWashRecommendation, analyzeQRTextForWashing } from '../utils/washProgramManager';

interface QRScannerProps {
  onScan?: (result: string) => void;
  onError?: (error: string) => void;
  onCottonDetected?: (recommendation: string, qrText: string) => void;
  onCottonDetectedShow?: (washProgram: any) => void;
}

export function QRScanner({ onScan, onError, onCottonDetected, onCottonDetectedShow }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      setCameraError(null);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setIsScanning(true);
          console.log('📷 Camera initialized successfully, starting QR scanning');
          startScanning();
        };

        await videoRef.current.play();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access camera';
      setCameraError(errorMessage);
      onError?.(errorMessage);
      console.error('❌ Camera initialization failed:', error);
    }
  }, [onError]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsScanning(false);
    console.log('📷 Camera stopped');
  }, []);

  // Start QR code scanning loop
  const startScanning = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const scan = () => {
      if (!isScanning || !video || !canvas || !context) {
        return;
      }

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // Use jsQR to detect QR codes
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        // QR code found!
        const qrText = code.data.toLowerCase();
        setLastScanResult(code.data);
        onScan?.(code.data);
        console.log('📱 QR Code scanned:', code.data);

        // Check if QR contains "cotton" and provide wash recommendation
        if (qrText.includes('cotton')) {
          const recommendation = createWashRecommendation(code.data);
          const washProgram = analyzeQRTextForWashing(code.data);

          console.log('👕 Cotton detected! Wash recommendation:', recommendation);
          console.log('🧺 Wash program:', washProgram);

          // Show modal via parent component
          onCottonDetectedShow?.({
            ...washProgram,
            originalQRText: code.data,
            recommendation: recommendation
          });

          // Don't call onCottonDetected yet - wait for user confirmation
        }

        // Stop scanning after successful scan
        stopCamera();
        return;
      } else {
        // Continue scanning
        animationFrameRef.current = requestAnimationFrame(scan);
      }
    };

    // Start scanning loop
    scan();
  }, [isScanning, onScan]);

  // Start QR scanning
  const startScanningProcess = useCallback(async () => {
    if (isScanning) return;

    setLastScanResult(null);
    setCameraError(null);
    await initializeCamera();
  }, [isScanning, initializeCamera]);

  // Stop QR scanning
  const stopScanningProcess = useCallback(() => {
    stopCamera();
    setCameraError(null);
  }, [stopCamera]);

  // Start scanning when camera is ready
  useEffect(() => {
    if (isScanning && videoRef.current) {
      startScanning();
    }
  }, [isScanning, startScanning]);

  return (
    <>
      {/* QR Scanner Button */}
      <motion.button
        onClick={isScanning ? stopScanningProcess : startScanningProcess}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`p-2 rounded-xl border cursor-pointer transition-colors relative group ${
          isScanning
            ? 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30'
            : 'bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30'
        }`}
        title={isScanning ? "Stop QR Scanning" : "Start QR Scanning"}
      >
        <svg
          className={`w-5 h-5 ${isScanning ? 'text-red-400' : 'text-purple-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>

        {/* Pulse animation when scanning */}
        {isScanning && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.3 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 bg-red-500 rounded-xl"
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {isScanning ? "Stop Scanning" : "Scan QR Code"}
        </div>
      </motion.button>

      {/* Hidden video and canvas elements for QR processing */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {/* Status indicator for last scan */}
      {lastScanResult && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-400 whitespace-nowrap">
          Last scan: {lastScanResult.substring(0, 20)}{lastScanResult.length > 20 ? '...' : ''}
        </div>
      )}
    </>
  );
}