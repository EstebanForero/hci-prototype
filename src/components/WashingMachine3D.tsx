import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Box, Text, Cylinder } from '@react-three/drei';
import * as THREE from 'three';

interface WashingMachineProps {
  health: number;
  cyclesRemaining: number;
  isActive: boolean;
  electricityUsage?: number;
  waterUsage?: number;
  useCustomModel?: boolean;
  modelUrl?: string;
}

// Water Particle System - Properly confined in drum center
function WaterParticles({ isActive }: { isActive: boolean }) {
  const particlesRef = useRef<THREE.Group>(null);
  const particleCount = 80;

  useFrame((state) => {
    if (particlesRef.current && isActive) {
      const time = state.clock.elapsedTime;

      particlesRef.current.children.forEach((particle, i) => {
        // Much smaller radius - tightly confined in center of drum
        const drumRadius = 0.08; // Very small radius in center
        const drumHeight = 0.15; // Small height range

        // Spherical coordinates for tight spherical motion
        const phi = (i / particleCount) * Math.PI; // Vertical angle (0 to π)
        const theta = (i / particleCount) * Math.PI * 2 + time * 2; // Horizontal rotation

        // Small radius oscillation
        const radiusOscillation = Math.sin(time * 3 + i * 0.2) * 0.02;
        const currentRadius = drumRadius + radiusOscillation;

        // Convert spherical to Cartesian coordinates
        let x = currentRadius * Math.sin(phi) * Math.cos(theta);
        let y = currentRadius * Math.cos(phi) * 0.6; // Flatten for drum shape
        let z = currentRadius * Math.sin(phi) * Math.sin(theta);

        // Add gentle drum rotation
        const drumRotationSpeed = 1.2;
        const rotatedX = x * Math.cos(time * drumRotationSpeed) - z * Math.sin(time * drumRotationSpeed);
        const rotatedZ = x * Math.sin(time * drumRotationSpeed) + z * Math.cos(time * drumRotationSpeed);

        // Very small turbulence
        const turbulenceX = Math.sin(time * 10 + i * 0.5) * 0.005;
        const turbulenceY = Math.cos(time * 8 + i * 0.3) * 0.005;
        const turbulenceZ = Math.sin(time * 9 + i * 0.4) * 0.005;

        // Final position with tight constraints
        let finalX = rotatedX + turbulenceX;
        let finalY = y + turbulenceY;
        let finalZ = rotatedZ + turbulenceZ;

        // Tight boundary constraints
        const distanceFromCenter = Math.sqrt(finalX * finalX + finalZ * finalZ);
        const maxRadius = drumRadius * 0.95; // Keep very tight

        if (distanceFromCenter > maxRadius) {
          const scale = maxRadius / distanceFromCenter;
          finalX *= scale;
          finalZ *= scale;
        }

        // Constrain Y tightly
        finalY = Math.max(-drumHeight/2, Math.min(drumHeight/2, finalY));

        // Smooth particle movement
        particle.position.x += (finalX - particle.position.x) * 0.15;
        particle.position.y += (finalY - particle.position.y) * 0.15;
        particle.position.z += (finalZ - particle.position.z) * 0.15;

        // Particle rotation
        particle.rotation.x += 0.02;
        particle.rotation.y += 0.03;
        particle.rotation.z += 0.01;

        // Larger, more visible droplets
        const baseScale = 0.012; // Much larger base size
        const pulseEffect = Math.sin(time * 6 + i * 0.4) * 0.003;
        particle.scale.setScalar(baseScale + pulseEffect);
      });
    }
  });

  return (
    <group ref={particlesRef} visible={isActive}>
      {Array.from({ length: particleCount }).map((_, i) => (
        <mesh key={`water-${i}`}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshStandardMaterial
            color="#1e40af"
            emissive="#60a5fa"
            emissiveIntensity={1.2}
            transparent
            opacity={0.8}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

// Bubble System for water effect - Confined space
function BubbleSystem({ isActive }: { isActive: boolean }) {
  const bubblesRef = useRef<THREE.Group>(null);
  const bubbleCount = 30;

  useFrame((state) => {
    if (bubblesRef.current && isActive) {
      const time = state.clock.elapsedTime;

      bubblesRef.current.children.forEach((bubble, i) => {
        // Rising bubbles - slower and confined
        bubble.position.y += 0.003;
        bubble.position.x += Math.sin(time * 2 + i) * 0.0005;
        bubble.position.z += Math.cos(time * 2 + i) * 0.0005;

        // Reset bubble when it reaches top - much smaller range
        if (bubble.position.y > 0.3) {
          bubble.position.y = -0.2;
          bubble.position.x = (Math.random() - 0.5) * 0.15;
          bubble.position.z = (Math.random() - 0.5) * 0.15;
        }

        // Bubble wobbling - smaller
        bubble.scale.setScalar(0.005 + Math.sin(time * 5 + i) * 0.002);
      });
    }
  });

  return (
    <group ref={bubblesRef} visible={isActive}>
      {Array.from({ length: bubbleCount }).map((_, i) => (
        <mesh
          key={`bubble-${i}`}
          position={[
            (Math.random() - 0.5) * 0.15, // Much smaller initial spread
            -0.2 + Math.random() * 0.5,   // Smaller height range
            (Math.random() - 0.5) * 0.15
          ]}
        >
          <sphereGeometry args={[0.005, 3, 3]} />
          <meshStandardMaterial
            color="#dbeafe"
            transparent
            opacity={0.3}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

// GLB Model Loader Component
function GLBModel({ url, health, cyclesRemaining, isActive, electricityUsage = 0, waterUsage = 0 }: { url: string, health: number, cyclesRemaining: number, isActive: boolean, electricityUsage?: number, waterUsage?: number }) {
  const meshRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
        const loader = new GLTFLoader();

        loader.load(
          url,
          (gltf: any) => {
            // Optimize the loaded model
            gltf.scene.traverse((child: any) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = true;

                // Enable interaction for parts
                child.userData.isInteractive = true;

                // Optimize materials
                if (child.material) {
                  child.material.envMapIntensity = 1.0;
                  child.material.needsUpdate = true;
                }
              }
            });

            // Auto-scale and center the model
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Scale to fit in 2x2x2 space
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;

            gltf.scene.position.sub(center); // Center the model
            gltf.scene.scale.setScalar(scale);

            setModel(gltf.scene);
            setLoading(false);
            console.log(`Model loaded: ${Math.round((size.x * size.y * size.z) * 1000)} cubic units`);
          },
          (progress: any) => {
            const percent = (progress.loaded / progress.total) * 100;
            setLoadingProgress(percent);
          },
          (error: any) => {
            console.error('Error loading GLB model:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Failed to load GLTFLoader:', err);
        setError('Failed to initialize model loader');
        setLoading(false);
      }
    };

    loadModel();
  }, [url]);

  // Animate the model
  useFrame((state, delta) => {
    if (meshRef.current && model) {
      // Gentle rotation when active
      if (isActive) {
        meshRef.current.rotation.y += delta * 0.1;
      }

      // Find and animate drum-like components
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.toLowerCase().includes('drum')) {
          if (isActive) {
            child.rotation.x += delta * 2;
          }
        }
      });
    }
  });

  if (error) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="red" />
        </mesh>
        <Text position={[0, 1.5, 0]} color="white" fontSize={0.1}>
          Model Error: {error}
        </Text>
      </group>
    );
  }

  if (loading) {
    return (
      <group>
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

        {/* Animated loading indicator */}
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
        <Text position={[0, 1.2, 0]} color="white" fontSize={0.1}>
          Loading: {Math.round(loadingProgress)}%
        </Text>
        <Text position={[0, 1.0, 0]} color="#94a3b8" fontSize={0.08}>
          30MB Model - Please Wait
        </Text>
      </group>
    );
  }

  return (
    <group ref={meshRef}>
      {model && (
        <>
          <primitive object={model.clone()} />

          {/* Water effects inside the washer */}
          <group position={[0, 0, 0]}>
            <WaterParticles isActive={isActive} />
            <BubbleSystem isActive={isActive} />
          </group>

          {/* Electricity usage indicator */}
          <CameraFacingText
            position={[-2.5, 1.5, 0]}
            color={isActive ? '#fbbf24' : '#6b7280'}
            fontSize={0.16}
          >
            {`⚡ ${electricityUsage} kW`}
          </CameraFacingText>

          {/* Water usage indicator */}
          <CameraFacingText
            position={[2.5, 1.5, 0]}
            color={isActive ? '#3b82f6' : '#6b7280'}
            fontSize={0.16}
          >
            {`💧 ${waterUsage} L`}
          </CameraFacingText>

          {/* Status light */}
          <mesh position={[1.5, 1.0, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial
              color={isActive ? '#4ade80' : '#ef4444'}
              emissive={isActive ? '#4ade80' : '#ef4444'}
              emissiveIntensity={0.8}
            />
          </mesh>

          {/* Active state particles */}
          {isActive && (
            <group>
              {[...Array(6)].map((_, i) => {
                const time = Date.now() * 0.001;
                const angle = (i / 6) * Math.PI * 2;
                return (
                  <mesh
                    key={i}
                    position={[
                      Math.cos(angle + time * 0.8) * 2,
                      Math.sin(time + i * 0.5) * 0.3 + 0.5,
                      Math.sin(angle + time * 0.6) * 2
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
        </>
      )}
    </group>
  );
}

function CameraFacingText({ children, position, color = "white", fontSize = 0.15 }: any) {
  const { camera } = useThree();
  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame(() => {
    if (spriteRef.current) {
      // Always face the camera - this is the correct way for sprites
      spriteRef.current.material.rotation = 0;
    }
  });

  // Create a high-quality canvas for the text
  const createTextTexture = (text: string) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    // Much smaller canvas for compact text
    const scale = 2; // 2x resolution for crisp text
    canvas.width = 64 * scale;
    canvas.height = 20 * scale;

    // Scale context for high DPI
    context.scale(scale, scale);

    // Transparent background
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, 64, 20);

    // Much smaller font size for professional look
    const fontSizePixels = 8;
    context.font = `600 ${fontSizePixels}px 'Inter', system-ui, sans-serif`;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Subtle shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 1;
    context.shadowOffsetX = 0.5;
    context.shadowOffsetY = 0.5;

    context.fillText(text, 32, 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return texture;
  };

  return (
    <sprite ref={spriteRef} position={position} scale={[0.15, 0.15, 0.15]}>
      <spriteMaterial
        map={createTextTexture(children as string)}
        transparent={true}
        alphaTest={0.01}
        sizeAttenuation={false}
      />
    </sprite>
  );
}

function WashingMachineModel({ health, cyclesRemaining, isActive, electricityUsage = 0, waterUsage = 0 }: WashingMachineProps) {
  const meshRef = useRef<THREE.Group>(null);
  const drumRef = useRef<THREE.Mesh>(null);
  const motorRef = useRef<THREE.Mesh>(null);
  const controlBoardRef = useRef<THREE.Mesh>(null);
  const pumpRef = useRef<THREE.Mesh>(null);
  const heatingElementRef = useRef<THREE.Mesh>(null);
  const waterInletRef = useRef<THREE.Mesh>(null);

  const [hoveredPart, setHoveredPart] = useState<string>('');

  // Simple noise function for realistic motion
  const noise = (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    return (X * 12.9898 + Y * 78.233 + Z * 37.719) % 1;
  };

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    if (meshRef.current && isActive) {
      // Gentle swaying motion - main body movement
      const swayX = Math.sin(time * 0.8) * 0.03 + noise(time * 0.1, 0, 0) * 0.01;
      const swayZ = Math.cos(time * 0.6) * 0.02 + noise(0, time * 0.1, 0) * 0.008;

      meshRef.current.rotation.x = swayX;
      meshRef.current.rotation.z = swayZ;

      // Vibration effect - high frequency small movements
      const vibrationX = Math.sin(time * 15) * 0.002;
      const vibrationY = Math.cos(time * 12) * 0.001;
      const vibrationZ = Math.sin(time * 18) * 0.002;

      meshRef.current.position.x = vibrationX;
      meshRef.current.position.y = vibrationY;
      meshRef.current.position.z = vibrationZ;

      // Occasional "bump" motion - simulating unbalanced load
      if (Math.sin(time * 0.3) > 0.8) {
        const bumpX = Math.sin(time * 25) * 0.008;
        const bumpZ = Math.cos(time * 20) * 0.006;
        meshRef.current.rotation.x += bumpX;
        meshRef.current.rotation.z += bumpZ;
      }
    } else if (meshRef.current) {
      // Gentle idle motion when not active
      meshRef.current.rotation.y = Math.sin(time * 0.2) * 0.02;
    }

    // Rotate the drum when active with variable speed
    if (drumRef.current && isActive) {
      // Variable rotation speed simulating different wash cycles
      const baseSpeed = delta * 2;
      const speedVariation = Math.sin(time * 0.4) * delta;
      const noiseSpeed = noise(time * 0.05, 0, 0) * delta * 0.5;

      drumRef.current.rotation.y += baseSpeed + speedVariation + noiseSpeed;

      // Add slight wobble to drum rotation
      const wobbleX = Math.sin(time * 8) * 0.005;
      const wobbleZ = Math.cos(time * 6) * 0.004;
      drumRef.current.rotation.x = wobbleX;
      drumRef.current.rotation.z = wobbleZ;
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
      {/* Main Washer Structure */}
      <group>
        {/* Back Panel */}
        <Box args={[2.0, 2.2, 0.1]} position={[0, 0, -1.0]}>
          <meshStandardMaterial
            color="#e5e7eb"
            metalness={0.7}
            roughness={0.3}
            envMapIntensity={1.0}
          />
        </Box>

        {/* Left Side Panel */}
        <Box args={[0.1, 2.2, 2.0]} position={[-1.0, 0, 0]}>
          <meshStandardMaterial
            color="#e5e7eb"
            metalness={0.7}
            roughness={0.3}
            envMapIntensity={1.0}
          />
        </Box>

        {/* Right Side Panel */}
        <Box args={[0.1, 2.2, 2.0]} position={[1.0, 0, 0]}>
          <meshStandardMaterial
            color="#e5e7eb"
            metalness={0.7}
            roughness={0.3}
            envMapIntensity={1.0}
          />
        </Box>

        {/* Top Panel - Control Board */}
        <Box
          ref={controlBoardRef}
          args={[2.0, 0.1, 2.0]}
          position={[0, 1.1, 0]}
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

        {/* Bottom Base */}
        <Box args={[2.0, 0.1, 2.0]} position={[0, -1.1, 0]}>
          <meshStandardMaterial
            color="#374151"
            metalness={0.8}
            roughness={0.2}
            envMapIntensity={1.0}
          />
        </Box>

        {/* Front Panel Structure */}
        <group position={[0, 0, 1.0]}>
          {/* Front Frame */}
          <Box args={[2.0, 2.2, 0.05]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#e5e7eb" metalness={0.8} roughness={0.2} />
          </Box>

          {/* Door Frame */}
          <Cylinder
            args={[0.7, 0.7, 0.1, 32]}
            position={[0, 0.1, 0.05]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.9}
              roughness={0.1}
              envMapIntensity={1.5}
            />
          </Cylinder>

          {/* Glass Door - Transparent to see inside */}
          <Cylinder
            args={[0.65, 0.65, 0.05, 32]}
            position={[0, 0.1, 0.08]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.9}
              roughness={0.0}
              transparent={true}
              opacity={0.3}
              envMapIntensity={1.0}
            />
          </Cylinder>

          {/* Door Handle */}
          <Box args={[0.3, 0.05, 0.05]} position={[0.7, 0.1, 0.1]}>
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
          </Box>

          {/* Detergent Drawer */}
          <Box args={[0.4, 0.15, 0.3]} position={[-0.6, -0.8, 0.1]}>
            <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.4} />
          </Box>
        </group>

        {/* Internal Components - Now properly positioned inside */}
        <group position={[0, 0, 0]}>
          {/* Inner Drum - Properly centered inside */}
          <Cylinder
            ref={drumRef}
            args={[0.6, 0.6, 0.5, 32]}
            position={[0, 0.1, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color="#9ca3af"
              metalness={0.95}
              roughness={0.05}
              transparent={true}
              opacity={0.8}
              envMapIntensity={1.3}
            />
          </Cylinder>

          {/* Drum Paddles - Inside the drum */}
          {Array.from({ length: 4 }, (_, i) => {
            const angle = (i / 4) * Math.PI * 2;
            return (
              <Box
                key={`paddle-${i}`}
                args={[0.08, 0.4, 0.08]}
                position={[
                  Math.cos(angle) * 0.5,
                  0.1,
                  Math.sin(angle) * 0.5
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

          {/* Motor - At the bottom back inside */}
          <group position={[0, -0.8, -0.3]}>
            <Box
              ref={motorRef}
              args={[0.5, 0.15, 0.5]}
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
            {/* Motor shaft connecting to drum */}
            <Cylinder
              args={[0.03, 0.03, 0.6, 16]}
              position={[0, 0.3, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
            </Cylinder>
          </group>

          {/* Pump - Bottom left inside */}
          <group position={[-0.5, -0.9, 0]}>
            <Box
              ref={pumpRef}
              args={[0.25, 0.25, 0.25]}
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
            {/* Pump pipes */}
            <Cylinder args={[0.05, 0.05, 0.3, 12]} position={[0, 0, 0.2]} rotation={[0, Math.PI / 2, 0]}>
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
            </Cylinder>
          </group>

          {/* Heating Element - Bottom right inside */}
          <group position={[0.5, -0.9, 0]}>
            <Box
              ref={heatingElementRef}
              args={[0.3, 0.05, 0.2]}
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

          {/* Water Inlet - Top back inside */}
          <group position={[0, 0.8, -0.5]}>
            <Box
              ref={waterInletRef}
              args={[0.15, 0.15, 0.3]}
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
        </group>

        {/* External Controls and Features */}
        {/* Control Panel Display Screen */}
        <Box args={[0.8, 0.3, 0.05]} position={[0, 1.2, 0.6]}>
          <meshStandardMaterial
            color="#111827"
            metalness={0.9}
            roughness={0.1}
            emissive="#111827"
            emissiveIntensity={0.3}
          />
        </Box>

        {/* Status Light */}
        <mesh position={[0.7, 1.15, 0.6]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshStandardMaterial
            color={isActive ? '#4ade80' : '#ef4444'}
            emissive={isActive ? '#4ade80' : '#ef4444'}
            emissiveIntensity={0.8}
          />
        </mesh>

        {/* Power Button */}
        <Cylinder
          args={[0.05, 0.05, 0.02, 16]}
          position={[-0.7, 1.15, 0.6]}
        >
          <meshStandardMaterial
            color="#ffffff"
            metalness={0.8}
            roughness={0.2}
            emissive="#ffffff"
            emissiveIntensity={0.1}
          />
        </Cylinder>

        {/* Feet/Base supports */}
        {[[-0.8, -1.15, -0.8], [0.8, -1.15, -0.8], [-0.8, -1.15, 0.8], [0.8, -1.15, 0.8]].map(
          (pos, i) => (
            <Cylinder
              key={`foot-${i}`}
              args={[0.05, 0.05, 0.1, 8]}
              position={pos as [number, number, number]}
            >
              <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
            </Cylinder>
          )
        )}
      </group>

      {/* Electricity Usage - Always facing camera */}
      <CameraFacingText
        position={[-2.5, 1.5, 0]}
        color={isActive ? '#fbbf24' : '#6b7280'}
        fontSize={0.16}
      >
        {`⚡ ${electricityUsage} kW`}
      </CameraFacingText>

      {/* Water Usage - Always facing camera */}
      <CameraFacingText
        position={[2.5, 1.5, 0]}
        color={isActive ? '#3b82f6' : '#6b7280'}
        fontSize={0.16}
      >
        {`💧 ${waterUsage} L`}
      </CameraFacingText>

      {/* Part Info - Always facing camera */}
      {hoveredPart && (
        <CameraFacingText
          position={[0, 2.5, 0]}
          color="#fbbf24"
          fontSize={0.25}
        >
          {hoveredPart}
        </CameraFacingText>
      )}

      {/* Water Effects when active - Inside the drum */}
      {isActive && (
        <group position={[0, 0.1, 0]}>
          <WaterParticles isActive={true} />
          <BubbleSystem isActive={true} />
        </group>
      )}

      {/* Energy Particles when active - Now positioned around the drum */}
      {isActive && (
        <group>
          {[...Array(8)].map((_, i) => {
            const time = Date.now() * 0.001;
            const angle = (i / 8) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(angle + time * 0.8) * 0.7,
                  Math.sin(time + i * 0.5) * 0.3 + 0.1,
                  Math.sin(angle + time * 0.6) * 0.7
                ]}
              >
                <sphereGeometry args={[0.015, 8, 8]} />
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

export default function WashingMachine3D({
  health,
  cyclesRemaining,
  isActive,
  electricityUsage = 0,
  waterUsage = 0,
  useCustomModel = false,
  modelUrl = '/models/washer.glb'
}: WashingMachineProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [4, 2, 6], fov: 45 }}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      >
        {/* Enhanced Lighting with Environment */}
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[8, 12, 8]}
          intensity={2.5}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[4, 6, 4]} intensity={1.5} color="#60a5fa" />
        <pointLight position={[-4, 6, -4]} intensity={1.0} color="#8b5cf6" />
        <spotLight
          position={[0, 10, 0]}
          angle={0.4}
          penumbra={1}
          intensity={2.0}
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

        {/* Choose between procedural and GLB model */}
        {useCustomModel ? (
          <Suspense fallback={<LoadingPlaceholder />}>
            <GLBModel
              url={modelUrl}
              health={health}
              cyclesRemaining={cyclesRemaining}
              isActive={isActive}
              electricityUsage={electricityUsage}
              waterUsage={waterUsage}
            />
          </Suspense>
        ) : (
          <WashingMachineModel
            health={health}
            cyclesRemaining={cyclesRemaining}
            isActive={isActive}
            electricityUsage={electricityUsage}
            waterUsage={waterUsage}
          />
        )}

        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={10}
          autoRotate={!isActive}
          autoRotateSpeed={0.5}
          enableDamping={true}
          dampingFactor={0.05}
        />

        <gridHelper
          args={[20, 20, '#475569', '#1e293b']}
          position={[0, -1.8, 0]}
        />
      </Canvas>
    </div>
  );
}

// Loading placeholder for Suspense
function LoadingPlaceholder() {
  return (
    <group>
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
      <Text position={[0, 1.2, 0]} color="white" fontSize={0.1}>
        Loading Model...
      </Text>
    </group>
  );
}