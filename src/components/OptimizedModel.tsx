/**
 * Optimized 3D Model Loader with Progressive Loading
 * Handles large GLB files with compression and streaming
 */

import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'
import { MeshoptDecoder } from 'three/examples/jsm/loaders/MeshoptDecoder'
import * as THREE from 'three'
import { Suspense, useState, useEffect } from 'react'

interface OptimizedModelProps {
  url: string
  position?: [number, number, number]
  scale?: [number, number, number]
  rotation?: [number, number, number]
  onLoadingComplete?: () => void
  onProgress?: (progress: number) => void
  enableDraco?: boolean
  enableMeshopt?: boolean
}

export function OptimizedModel({
  url,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  onLoadingComplete,
  onProgress,
  enableDraco = true,
  enableMeshopt = true
}: OptimizedModelProps) {
  const { gl } = useThree()
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Setup optimized loaders
  const setupLoaders = () => {
    const loader = new GLTFLoader()

    // DRACO compression - can reduce file size by 90%+
    if (enableDraco) {
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath('/draco/') // You'll need to add these files to public/
      loader.setDRACOLoader(dracoLoader)
    }

    // Meshopt compression - excellent for geometry
    if (enableMeshopt) {
      loader.setMeshoptDecoder(MeshoptDecoder)
    }

    // KTX2 textures - compressed textures
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('/basis/') // You'll need to add these files
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)

    return loader
  }

  // Custom hook for loading with progress
  useGLTFWithProgress = (url: string) => {
    const [gltf, setGltf] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
      const loader = setupLoaders()

      loader.load(
        url,
        (loadedGltf) => {
          setGltf(loadedGltf)
          setIsLoading(false)
          onLoadingComplete?.()
        },
        (progress) => {
          const progressPercent = (progress.loaded / progress.total) * 100
          setLoadingProgress(progressPercent)
          onProgress?.(progressPercent)
        },
        (error) => {
          console.error('Error loading model:', error)
          setError(error)
          setIsLoading(false)
        }
      )
    }, [url])

    return { gltf, error, loadingProgress, isLoading }
  }

  const { gltf, error } = useGLTFWithProgress(url)

  if (error) {
    console.error('Model loading error:', error)
    return (
      <mesh position={position}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="red" />
      </mesh>
    )
  }

  if (!gltf || isLoading) {
    return (
      <group position={position}>
        {/* Loading placeholder */}
        <mesh>
          <cylinderGeometry args={[0.8, 0.8, 1.2, 32]} />
          <meshStandardMaterial
            color="#374151"
            transparent
            opacity={0.8}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* Loading indicator */}
        <group position={[0, 0.7, 0]}>
          <mesh rotation={[Date.now() * 0.001, 0, 0]}>
            <torusGeometry args={[0.3, 0.05, 8, 20]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#3b82f6"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>

        {/* Progress text */}
        <text
          position={[0, 1.2, 0]}
          fontSize={0.1}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {`Loading: ${Math.round(loadingProgress)}%`}
        </text>
      </group>
    )
  }

  // Optimize loaded model
  useEffect(() => {
    if (gltf) {
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Enable shadows
          child.castShadow = true
          child.receiveShadow = true

          // Optimize materials
          if (child.material) {
            child.material.envMapIntensity = 1.0
            child.material.needsUpdate = true
          }

          // Frustum culling for performance
          child.frustumCulled = true
        }
      })

      // Calculate bounding box for auto-scaling if needed
      const box = new THREE.Box3().setFromObject(gltf.scene)
      const size = box.getSize(new THREE.Vector3())
      console.log('Model loaded, size:', size)
    }
  }, [gltf])

  return (
    <primitive
      object={gltf.scene}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  )
}

// Hook for loading with progress tracking
function useGLTFWithProgress(url: string) {
  const [gltf, setGltf] = useState(null)
  const [error, setError] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const { gl } = useThree()

  useEffect(() => {
    const loader = new GLTFLoader()

    // DRACO compression setup
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    loader.setDRACOLoader(dracoLoader)

    loader.load(
      url,
      (loadedGltf) => {
        setGltf(loadedGltf)
      },
      (progress) => {
        const progressPercent = (progress.loaded / progress.total) * 100
        setLoadingProgress(progressPercent)
      },
      (error) => {
        console.error('Error loading model:', error)
        setError(error)
      }
    )

    return () => {
      // Cleanup
      dracoLoader.dispose()
    }
  }, [url])

  return { gltf, error, loadingProgress }
}