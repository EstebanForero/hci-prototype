/**
 * Streaming 3D Model Loader for Large Files
 * Implements progressive loading and LOD (Level of Detail)
 */

import { Suspense, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface StreamingModelProps {
  modelUrl: string
  lodUrls?: string[] // [high, medium, low] quality versions
  maxDistance?: number
  position?: [number, number, number]
  scale?: [number, number, number]
}

export function StreamingModel({
  modelUrl,
  lodUrls,
  maxDistance = 10,
  position = [0, 0, 0],
  scale = [1, 1, 1]
}: StreamingModelProps) {
  return (
    <Suspense fallback={<LoadingPlaceholder position={position} />}>
      <StreamingModelInner
        modelUrl={modelUrl}
        lodUrls={lodUrls}
        maxDistance={maxDistance}
        position={position}
        scale={scale}
      />
    </Suspense>
  )
}

function StreamingModelInner({
  modelUrl,
  lodUrls,
  maxDistance,
  position,
  scale
}: StreamingModelProps) {
  const { camera } = useThree()
  const meshRef = useRef<THREE.Group>(null)
  const [currentLOD, setCurrentLOD] = useState(0) // 0: low, 1: medium, 2: high
  const [loadedModels, setLoadedModels] = useState<any[]>([])
  const [loadingStates, setLoadingStates] = useState<boolean[]>([true, false, false])

  // Load models progressively
  useEffect(() => {
    const urls = lodUrls ? [...lodUrls].reverse() : [modelUrl] // Low to high quality
    const newModels: any[] = []

    urls.forEach((url, index) => {
      if (index === 0) {
        // Load low quality immediately
        loadModel(url, index, newModels, setLoadingStates)
      } else {
        // Load higher qualities with delay
        setTimeout(() => {
          loadModel(url, index, newModels, setLoadingStates)
        }, index * 1000) // 1 second delay between each LOD
      }
    })

    return () => {
      // Cleanup models
      newModels.forEach(model => {
        if (model?.scene) {
          model.scene.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose()
            if (child.material) {
              Object.values(child.material).forEach((material: any) => {
                if (material.map) material.map.dispose()
                if (material.normalMap) material.normalMap.dispose()
                material.dispose()
              })
            }
          })
        }
      })
    }
  }, [modelUrl, lodUrls])

  const loadModel = async (
    url: string,
    index: number,
    modelsArray: any[],
    setLoadingStates: React.Dispatch<React.SetStateAction<boolean[]>>
  ) => {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader')
      const loader = new GLTFLoader()

      loader.load(
        url,
        (gltf) => {
          // Optimize the loaded model
          gltf.scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
              child.frustumCulled = true

              // Optimize materials for performance
              if (child.material) {
                child.material.envMapIntensity = 0.8
                child.material.needsUpdate = true
              }
            }
          })

          modelsArray[index] = gltf
          setLoadedModels([...modelsArray])
          setLoadingStates(prev => {
            const newState = [...prev]
            newState[index] = false
            return newState
          })
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100
          console.log(`Loading LOD ${index}: ${percent.toFixed(1)}%`)
        },
        (error) => {
          console.error(`Error loading LOD ${index}:`, error)
          setLoadingStates(prev => {
            const newState = [...prev]
            newState[index] = false
            return newState
          })
        }
      )
    } catch (error) {
      console.error(`Failed to load LOD ${index}:`, error)
    }
  }

  // Determine LOD based on camera distance
  useFrame(() => {
    if (meshRef.current && loadedModels.length > 0) {
      const distance = camera.position.distanceTo(meshRef.current.position)
      let targetLOD = 0

      if (distance < maxDistance * 0.3 && loadedModels[2]) {
        targetLOD = 2 // High quality
      } else if (distance < maxDistance * 0.7 && loadedModels[1]) {
        targetLOD = 1 // Medium quality
      } else if (loadedModels[0]) {
        targetLOD = 0 // Low quality
      }

      setCurrentLOD(targetLOD)
    }
  })

  const currentModel = loadedModels[currentLOD]

  return (
    <group ref={meshRef} position={position} scale={scale}>
      {currentModel && (
        <>
          <primitive object={currentModel.scene.clone()} />
          {loadingStates[currentLOD] && (
            <LoadingIndicator position={[0, 2, 0]} />
          )}
        </>
      )}
    </group>
  )
}

function LoadingPlaceholder({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Simple box placeholder */}
      <mesh>
        <boxGeometry args={[1.5, 2, 1.5]} />
        <meshStandardMaterial
          color="#374151"
          transparent
          opacity={0.7}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Rotating loading indicator */}
      <group position={[0, 1.5, 0]}>
        <mesh rotation={[Date.now() * 0.002, 0, 0]}>
          <torusGeometry args={[0.3, 0.05, 8, 20]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      {/* Loading text */}
      <mesh position={[0, 2.2, 0]}>
        <planeGeometry args={[1, 0.3]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

function LoadingIndicator({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02
      meshRef.current.rotation.x += 0.01
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <torusGeometry args={[0.2, 0.02, 8, 16]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
    </group>
  )
}

export default function StreamingModelViewer() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [5, 3, 8], fov: 45 }}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[8, 12, 8]} intensity={2.5} castShadow />
        <pointLight position={[4, 6, 4]} intensity={1.5} color="#60a5fa" />

        <StreamingModel
          modelUrl="/models/washer.glb"
          lodUrls={[
            '/models/washer_low.glb',    // ~5MB
            '/models/washer_medium.glb',  // ~15MB
            '/models/washer_high.glb'     // ~30MB
          ]}
          position={[0, 0, 0]}
          scale={[1, 1, 1]}
        />

        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={15}
          autoRotate={true}
          autoRotateSpeed={0.5}
        />

        <gridHelper args={[20, 20, '#475569', '#1e293b']} position={[0, -1.5, 0]} />
      </Canvas>
    </div>
  )
}