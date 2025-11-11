import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

interface WashingMachineProps {
  health: number;
  cyclesRemaining: number;
  isActive: boolean;
}

function WashingMachineModel({ health, cyclesRemaining, isActive }: WashingMachineProps) {
  const meshRef = useRef<THREE.Group>(null);
  const drumRef = useRef<THREE.Mesh>(null);
  const [rotation, setRotation] = useState(0);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }

    if (drumRef.current && isActive) {
      drumRef.current.rotation.x += delta * 2;
    }
  });

  const healthColor = health > 70 ? '#4ade80' : health > 40 ? '#fbbf24' : '#ef4444';

  return (
    <group ref={meshRef}>
      {/* Main Body */}
      <Box args={[2, 2.5, 2]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
      </Box>

      {/* Front Panel */}
      <Box args={[1.8, 2.3, 0.1]} position={[0, 0, 1.05]}>
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
      </Box>

      {/* Drum */}
      <Cylinder
        ref={drumRef}
        args={[0.7, 0.7, 0.3, 32]}
        position={[0, -0.2, 1.1]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#6b7280"
          metalness={0.95}
          roughness={0.05}
          transparent={true}
          opacity={0.8}
        />
      </Cylinder>

      {/* Drum Center */}
      <Cylinder
        args={[0.65, 0.65, 0.31, 32]}
        position={[0, -0.2, 1.15]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.9}
          roughness={0.1}
        />
      </Cylinder>

      {/* Control Panel */}
      <Box args={[1.6, 0.4, 0.05]} position={[0, 1.2, 1.08]}>
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.2} />
      </Box>

      {/* Status Light */}
      <mesh position={[0, 1.2, 1.11]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={isActive ? '#4ade80' : '#ef4444'}
          emissive={isActive ? '#4ade80' : '#ef4444'}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Health Indicator */}
      <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
        <Text
          position={[-1.5, 0.5, 0]}
          fontSize={0.15}
          color={healthColor}
          anchorX="center"
          anchorY="middle"
        >
          {`Health: ${health}%`}
        </Text>
      </Float>

      {/* Cycles Indicator */}
      <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
        <Text
          position={[1.5, 0.5, 0]}
          fontSize={0.15}
          color="#60a5fa"
          anchorX="center"
          anchorY="middle"
        >
          {`Cycles: ${cyclesRemaining}`}
        </Text>
      </Float>

      {/* Energy Particles when active */}
      {isActive && (
        <group>
          {[...Array(6)].map((_, i) => (
            <mesh
              key={i}
              position={[
                Math.cos((i / 6) * Math.PI * 2) * 1.2,
                Math.sin((i / 6) * Math.PI * 2) * 1.2,
                0
              ]}
            >
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                color="#60a5fa"
                emissive="#60a5fa"
                emissiveIntensity={0.8}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export default function WashingMachine3D({ health, cyclesRemaining, isActive }: WashingMachineProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [3, 2, 5], fov: 50 }}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      >
        <ambientLight intensity={0.5} />
        <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-5, 5, -5]} intensity={0.5} color="#60a5fa" />
        <WashingMachineModel
          health={health}
          cyclesRemaining={cyclesRemaining}
          isActive={isActive}
        />
        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          autoRotate={!isActive}
          autoRotateSpeed={1}
        />
        <gridHelper args={[10, 10, '#374151', '#1f2937']} position={[0, -1.5, 0]} />
      </Canvas>
    </div>
  );
}