import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Text } from '@react-three/drei';
import * as THREE from 'three';

interface WashingMachineProps {
  health: number;
  cyclesRemaining: number;
  isActive: boolean;
}

function CameraFacingText({ children, position, color = "white", fontSize = 0.15 }: any) {
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (textRef.current) {
      textRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <Text
      ref={textRef}
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
    >
      {children}
    </Text>
  );
}

function WashingMachineModel({ health, cyclesRemaining, isActive }: WashingMachineProps) {
  const meshRef = useRef<THREE.Group>(null);
  const drumRef = useRef<THREE.Mesh>(null);
  const motorRef = useRef<THREE.Mesh>(null);
  const controlBoardRef = useRef<THREE.Mesh>(null);
  const pumpRef = useRef<THREE.Mesh>(null);
  const heatingElementRef = useRef<THREE.Mesh>(null);
  const waterInletRef = useRef<THREE.Mesh>(null);

  const [hoveredPart, setHoveredPart] = useState<string>('');

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }

    if (drumRef.current && isActive) {
      drumRef.current.rotation.x += delta * 2;
    }
  });

  const healthColor = health > 70 ? '#4ade80' : health > 40 ? '#fbbf24' : '#ef4444';

  const handlePartHover = (partName: string) => {
    setHoveredPart(partName);
  };

  const handlePartLeave = () => {
    setHoveredPart('');
  };

  return (
    <group ref={meshRef}>
      {/* Main Washer Body */}
      <Box args={[2.2, 2.8, 2.2]} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#9ca3af"
          metalness={0.7}
          roughness={0.3}
          envMapIntensity={1.0}
        />
      </Box>

      {/* Washer Shell/Outer Casing */}
      <Box args={[2.0, 2.6, 2.0]} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#e5e7eb"
          metalness={0.8}
          roughness={0.2}
          envMapIntensity={1.2}
        />
      </Box>

      {/* Front Door Frame */}
      <Cylinder
        args={[0.8, 0.8, 0.2, 32]}
        position={[0, 0.2, 1.1]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#6b7280"
          metalness={0.9}
          roughness={0.1}
          envMapIntensity={1.5}
        />
      </Cylinder>

      {/* Glass Door */}
      <Cylinder
        args={[0.75, 0.75, 0.15, 32]}
        position={[0, 0.2, 1.2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.9}
          roughness={0.0}
          transparent={true}
          opacity={0.7}
          envMapIntensity={1.0}
        />
      </Cylinder>

      {/* Inner Drum - Rotating */}
      <Cylinder
        ref={drumRef}
        args={[0.7, 0.7, 0.4, 32]}
        position={[0, 0.2, 1.15]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#9ca3af"
          metalness={0.95}
          roughness={0.05}
          transparent={true}
          opacity={0.9}
          envMapIntensity={1.3}
        />
      </Cylinder>

      {/* Drum Paddles */}
      {Array.from({ length: 3 }, (_, i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <Box
            key={`paddle-${i}`}
            args={[0.1, 0.6, 0.1]}
            position={[
              Math.cos(angle) * 0.6,
              0.2,
              Math.sin(angle) * 0.6 + 1.15
            ]}
            rotation={[0, -angle, 0]}
          >
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.9}
              roughness={0.1}
              envMapIntensity={1.2}
            />
          </Box>
        );
      })}

      {/* Motor - Inside at bottom */}
      <group position={[0, -1.0, 0]}>
        <Box
          ref={motorRef}
          args={[0.6, 0.2, 0.6]}
          position={[0, 0, 0]}
          onPointerOver={() => handlePartHover('Motor')}
          onPointerOut={handlePartLeave}
        >
          <meshStandardMaterial
            color="#ef4444"
            metalness={0.7}
            roughness={0.3}
            emissive={hoveredPart === 'Motor' ? '#ef4444' : '#000000'}
            emissiveIntensity={hoveredPart === 'Motor' ? 0.3 : 0}
          />
        </Box>
        {/* Motor shaft */}
        <Cylinder
          args={[0.05, 0.05, 0.8, 16]}
          position={[0, 0.4, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </Cylinder>
      </group>

      {/* Control Board - Top panel */}
      <Box
        ref={controlBoardRef}
        args={[1.8, 0.1, 1.8]}
        position={[0, 1.3, 0]}
        onPointerOver={() => handlePartHover('Control Board')}
        onPointerOut={handlePartLeave}
      >
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.8}
          roughness={0.2}
          emissive={hoveredPart === 'Control Board' ? '#3b82f6' : '#000000'}
          emissiveIntensity={hoveredPart === 'Control Board' ? 0.3 : 0}
        />
      </Box>

      {/* Control Panel Display */}
      <Box args={[1.4, 0.05, 0.8]} position={[0, 1.36, 0.6]}>
        <meshStandardMaterial
          color="#111827"
          metalness={0.9}
          roughness={0.1}
          emissive="#111827"
          emissiveIntensity={0.2}
        />
      </Box>

      {/* Pump - Inside bottom left */}
      <group position={[-0.7, -1.1, 0]}>
        <Box
          ref={pumpRef}
          args={[0.3, 0.3, 0.3]}
          position={[0, 0, 0]}
          onPointerOver={() => handlePartHover('Pump')}
          onPointerOut={handlePartLeave}
        >
          <meshStandardMaterial
            color="#f59e0b"
            metalness={0.7}
            roughness={0.3}
            emissive={hoveredPart === 'Pump' ? '#f59e0b' : '#000000'}
            emissiveIntensity={hoveredPart === 'Pump' ? 0.3 : 0}
          />
        </Box>
        {/* Pump inlet/outlet */}
        <Cylinder args={[0.08, 0.08, 0.4, 12]} position={[0, 0, 0.3]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </Cylinder>
      </group>

      {/* Heating Element - Inside bottom right */}
      <group position={[0.7, -1.1, 0]}>
        <Box
          ref={heatingElementRef}
          args={[0.4, 0.05, 0.3]}
          position={[0, 0, 0]}
          onPointerOver={() => handlePartHover('Heating Element')}
          onPointerOut={handlePartLeave}
        >
          <meshStandardMaterial
            color="#f97316"
            metalness={0.9}
            roughness={0.1}
            emissive={hoveredPart === 'Heating Element' ? '#f97316' : '#f97316'}
            emissiveIntensity={hoveredPart === 'Heating Element' ? 0.5 : 0.1}
          />
        </Box>
      </group>

      {/* Water Inlet - Top back */}
      <group position={[0, 1.2, -0.8]}>
        <Box
          ref={waterInletRef}
          args={[0.2, 0.2, 0.4]}
          position={[0, 0, 0]}
          onPointerOver={() => handlePartHover('Water Inlet')}
          onPointerOut={handlePartLeave}
        >
          <meshStandardMaterial
            color="#06b6d4"
            metalness={0.8}
            roughness={0.2}
            emissive={hoveredPart === 'Water Inlet' ? '#06b6d4' : '#000000'}
            emissiveIntensity={hoveredPart === 'Water Inlet' ? 0.3 : 0}
          />
        </Box>
      </group>

      {/* Detergent Drawer - Front bottom left */}
      <Box args={[0.4, 0.1, 0.3]} position={[-0.7, -1.2, 1.0]}>
        <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.4} />
      </Box>

      {/* Status Light */}
      <mesh position={[0.8, 1.35, 0.8]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={isActive ? '#4ade80' : '#ef4444'}
          emissive={isActive ? '#4ade80' : '#ef4444'}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Power Button */}
      <mesh position={[-0.8, 1.35, 0.8]}>
        <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.8}
          roughness={0.2}
          emissive="#ffffff"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Health Indicator - Always facing camera */}
      <CameraFacingText
        position={[-3, 1.5, 0]}
        color={healthColor}
        fontSize={0.18}
      >
        {`Health: ${health}%`}
      </CameraFacingText>

      {/* Cycles Indicator - Always facing camera */}
      <CameraFacingText
        position={[3, 1.5, 0]}
        color="#60a5fa"
        fontSize={0.18}
      >
        {`Cycles: ${cyclesRemaining}`}
      </CameraFacingText>

      {/* Part Info - Always facing camera */}
      {hoveredPart && (
        <CameraFacingText
          position={[0, 3, 0]}
          color="#fbbf24"
          fontSize={0.25}
        >
          {hoveredPart}
        </CameraFacingText>
      )}

      {/* Energy Particles when active */}
      {isActive && (
        <group>
          {[...Array(12)].map((_, i) => {
            const time = Date.now() * 0.001;
            const angle = (i / 12) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(angle + time * 0.8) * 1.5,
                  Math.sin(time + i * 0.5) * 1.5,
                  Math.sin(angle + time * 0.6) * 1.5
                ]}
              >
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshStandardMaterial
                  color="#60a5fa"
                  emissive="#60a5fa"
                  emissiveIntensity={1.0}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

export default function WashingMachine3D({ health, cyclesRemaining, isActive }: WashingMachineProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [5, 3, 7], fov: 45 }}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      >
        {/* Enhanced Lighting with Environment */}
        <ambientLight intensity={1.0} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={2.0}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[5, 8, 5]} intensity={1.2} color="#60a5fa" />
        <pointLight position={[-5, 8, -5]} intensity={0.8} color="#8b5cf6" />
        <spotLight
          position={[0, 12, 0]}
          angle={0.4}
          penumbra={1}
          intensity={1.5}
          color="#ffffff"
          target-position={[0, 0, 0]}
        />

        {/* Environment for reflections */}
        <mesh>
          <sphereGeometry args={[100, 16, 16]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={1}
            metalness={0}
            side={THREE.BackSide}
          />
        </mesh>

        <WashingMachineModel
          health={health}
          cyclesRemaining={cyclesRemaining}
          isActive={isActive}
        />

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={12}
          autoRotate={!isActive}
          autoRotateSpeed={0.5}
          enableDamping={true}
          dampingFactor={0.05}
        />

        <gridHelper
          args={[20, 20, '#475569', '#1e293b']}
          position={[0, -2.5, 0]}
        />
      </Canvas>
    </div>
  );
}