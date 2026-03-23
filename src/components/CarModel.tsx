import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Trail, Sparkles, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Car } from '../types';

const WindLine = ({ speed, offset }: { speed: number, offset: [number, number, number] }) => {
  const ref = useRef<THREE.Mesh>(null);
  const initialZ = offset[2];
  
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.position.z += speed * delta * 0.5;
      if (ref.current.position.z > 3) {
        ref.current.position.z = -3;
      }
      // Fade out at edges
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      const zPos = ref.current.position.z;
      if (zPos > 1.5) {
        mat.opacity = 0.3 * (1 - (zPos - 1.5) / 1.5);
      } else if (zPos < -1.5) {
        mat.opacity = 0.3 * (1 - (-1.5 - zPos) / 1.5);
      } else {
        mat.opacity = 0.3;
      }
    }
  });

  return (
    <mesh ref={ref} position={offset}>
      <boxGeometry args={[0.01, 0.01, 1.0]} />
      <meshBasicMaterial color="#00ffff" transparent opacity={0.0} />
    </mesh>
  );
};

interface CarModelProps {
  car: Car;
  position?: [number, number, number];
  rotation?: [number, number, number];
  isRacing?: boolean;
  speed?: number;
  equipFlash?: number;
  isAccelerating?: boolean;
  isBraking?: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', // gray-400
  rare: '#3b82f6',   // blue-500
  epic: '#a855f7',   // purple-500
  legendary: '#eab308' // yellow-500
};

export const CarModel: React.FC<CarModelProps> = ({ car, position = [0, 0, 0], rotation = [0, 0, 0], isRacing, speed = 0, equipFlash = 0, isAccelerating = false, isBraking = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);
  const flashRef = useRef<THREE.Mesh>(null);
  const flashMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const windParticlesRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (equipFlash > 0) {
      if (flashMatRef.current) flashMatRef.current.opacity = 0.8;
      if (flashRef.current) flashRef.current.scale.set(1, 1, 1);
    }
  }, [equipFlash]);

  useFrame((state, delta) => {
    if (isRacing && wheelsRef.current.length > 0) {
      const rotationSpeed = speed * 0.5;
      wheelsRef.current.forEach((wheel) => {
        if (wheel) wheel.rotation.x -= rotationSpeed; // Rotate wheels forward
      });
    }

    if (flashMatRef.current && flashMatRef.current.opacity > 0) {
      flashMatRef.current.opacity -= delta * 1.5;
      if (flashRef.current) {
        flashRef.current.scale.addScalar(delta * 1.5);
      }
    }

    if (windParticlesRef.current && isRacing) {
      windParticlesRef.current.position.z = (state.clock.elapsedTime * speed * 0.2) % 5 - 2.5;
    }
  });

  const mfgColor = useMemo(() => {
    switch (car.manufacturer.id) {
      case 'aero-tech': return '#3b82f6';
      case 'heavy-metal': return '#4b5563';
      case 'spark-core': return '#f59e0b';
      default: return '#ef4444';
    }
  }, [car.manufacturer.id]);

  const p = car.parts;

  // Visual properties based on parts
  const chassisColor = p.chassis ? RARITY_COLORS[p.chassis.rarity] : '#374151';
  const bodyColor = p.body?.id === 'carbon-body' ? '#171717' : mfgColor;
  const motorGlow = p.motor?.id === 'plasma-motor' ? '#06b6d4' : (p.motor ? RARITY_COLORS[p.motor.rarity] : '#4b5563');
  const tireColor = p.tire?.id === 'spiked-tire' ? '#3f3f46' : '#18181b';
  const tireScale = p.tire?.id === 'spiked-tire' ? 1.1 : 1.0;
  const batteryColor = p.battery ? RARITY_COLORS[p.battery.rarity] : '#10b981';
  const specialColor = p.special ? RARITY_COLORS[p.special.rarity] : '#3f3f46';
  const isBoss = p.weapon?.id === 'boss-weapon';

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Special Part (Top Module) */}
      {p.special && (
        <group position={[0, 0.55, 0]}>
          <Cylinder args={[0.2, 0.2, 0.1, 16]} castShadow>
            <meshStandardMaterial color={specialColor} metalness={0.8} roughness={0.2} />
          </Cylinder>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial 
              color={specialColor} 
              emissive={specialColor} 
              emissiveIntensity={1.5} 
              toneMapped={false} 
            />
          </mesh>
        </group>
      )}

      {/* Aerodynamic Wind Simulation */}
      {isRacing && speed > 10 && (
        <group>
          {/* Existing Sparkles */}
          <group ref={windParticlesRef}>
            <Sparkles 
              count={10} 
              scale={[1.5, 0.5, 4]} 
              size={2} 
              speed={speed * 0.1} 
              opacity={0.3} 
              color="#ffffff" 
            />
            <Sparkles 
              count={5} 
              scale={[1.2, 0.8, 3]} 
              size={4} 
              speed={speed * 0.15} 
              opacity={0.2} 
              color="#00ffff" 
            />
          </group>
          {/* New Fluid Lines */}
          <WindLine speed={speed} offset={[-0.6, 0.5, -2]} />
          <WindLine speed={speed * 1.1} offset={[0.6, 0.4, -1]} />
          <WindLine speed={speed * 0.9} offset={[-0.4, 0.8, -3]} />
          <WindLine speed={speed * 1.2} offset={[0.4, 0.7, -1.5]} />
          <WindLine speed={speed} offset={[0, 0.9, -2.5]} />
        </group>
      )}

      {/* Equip Flash Effect */}
      <mesh ref={flashRef} visible={equipFlash > 0}>
        <boxGeometry args={[3, 2, 5]} />
        <meshStandardMaterial 
          ref={flashMatRef} 
          color="#00ffff" 
          transparent 
          opacity={0} 
          wireframe 
          blending={THREE.AdditiveBlending} 
          depthWrite={false}
        />
      </mesh>

      {/* Boss Aura */}
      {isBoss && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[2, 32, 32]} />
          <meshStandardMaterial color="#a855f7" transparent opacity={0.3} wireframe blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {/* 1. Chassis (Base Plate) */}
      <Box args={[1.4, 0.1, 3.2]} position={[0, 0.15, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={chassisColor} metalness={0.6} roughness={0.4} />
      </Box>

      {/* Front Bumper & Rollers */}
      <Box args={[1.8, 0.05, 0.4]} position={[0, 0.15, 1.6]} castShadow>
        <meshStandardMaterial color={chassisColor} metalness={0.8} roughness={0.2} />
      </Box>
      <Cylinder args={[0.15, 0.15, 0.1, 16]} position={[-0.8, 0.25, 1.6]} castShadow>
        <meshStandardMaterial color={p.weapon ? RARITY_COLORS[p.weapon.rarity] : '#9ca3af'} metalness={0.5} />
      </Cylinder>
      <Cylinder args={[0.15, 0.15, 0.1, 16]} position={[0.8, 0.25, 1.6]} castShadow>
        <meshStandardMaterial color={p.weapon ? RARITY_COLORS[p.weapon.rarity] : '#9ca3af'} metalness={0.5} />
      </Cylinder>

      {/* Rear Bumper & Rollers */}
      <Box args={[1.8, 0.05, 0.4]} position={[0, 0.15, -1.6]} castShadow>
        <meshStandardMaterial color={chassisColor} metalness={0.8} roughness={0.2} />
      </Box>
      <Cylinder args={[0.15, 0.15, 0.1, 16]} position={[-0.8, 0.25, -1.6]} castShadow>
        <meshStandardMaterial color="#9ca3af" metalness={0.5} />
      </Cylinder>
      <Cylinder args={[0.15, 0.15, 0.1, 16]} position={[0.8, 0.25, -1.6]} castShadow>
        <meshStandardMaterial color="#9ca3af" metalness={0.5} />
      </Cylinder>

      {/* 2. Motor (Rear Mounted) */}
      <group position={[0, 0.3, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <Cylinder args={[0.25, 0.25, 0.8, 16]} castShadow>
          <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
        </Cylinder>
        {/* Motor Core / Glow */}
        <Cylinder args={[0.26, 0.26, 0.4, 16]}>
          <meshStandardMaterial 
            color={motorGlow} 
            emissive={motorGlow} 
            emissiveIntensity={p.motor ? 2 : 0} 
            toneMapped={false} 
          />
        </Cylinder>
      </group>

      {/* Exhaust Flames */}
      {isAccelerating && (
        <group position={[0, 0.3, -1.4]}>
          <Sparkles 
            count={8} 
            scale={[0.6, 0.6, 1]} 
            size={4} 
            speed={2} 
            opacity={0.8} 
            color="#f97316" 
            position={[0.3, 0, 0]}
          />
          <Sparkles 
            count={8} 
            scale={[0.6, 0.6, 1]} 
            size={4} 
            speed={2} 
            opacity={0.8} 
            color="#f97316" 
            position={[-0.3, 0, 0]}
          />
        </group>
      )}

      {/* Brake Lights */}
      <group position={[0, 0.4, -1.25]}>
        <mesh position={[0.4, 0, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.05]} />
          <meshStandardMaterial 
            color="#ef4444" 
            emissive="#ef4444" 
            emissiveIntensity={isBraking ? 5 : 0.5} 
            toneMapped={false} 
          />
        </mesh>
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.05]} />
          <meshStandardMaterial 
            color="#ef4444" 
            emissive="#ef4444" 
            emissiveIntensity={isBraking ? 5 : 0.5} 
            toneMapped={false} 
          />
        </mesh>
      </group>

      {/* 3. Batteries (Middle/Side Mounted) */}
      <group position={[-0.4, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Cylinder args={[0.12, 0.12, 0.8, 16]} castShadow>
          <meshStandardMaterial color={batteryColor} metalness={0.4} roughness={0.6} />
        </Cylinder>
        <Cylinder args={[0.05, 0.05, 0.85, 16]} castShadow>
          <meshStandardMaterial color="#d1d5db" metalness={0.8} />
        </Cylinder>
      </group>
      <group position={[0.4, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Cylinder args={[0.12, 0.12, 0.8, 16]} castShadow>
          <meshStandardMaterial color={batteryColor} metalness={0.4} roughness={0.6} />
        </Cylinder>
        <Cylinder args={[0.05, 0.05, 0.85, 16]} castShadow>
          <meshStandardMaterial color="#d1d5db" metalness={0.8} />
        </Cylinder>
      </group>

      {/* 4. Body (Shell) */}
      {p.body ? (
        <group position={[0, 0.4, 0.2]}>
          {p.body.manufacturer === 'aero-tech' && (
            <>
              {/* Sleek Aero Body */}
              <Box args={[0.8, 0.2, 2.4]} position={[0, 0, 0]} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.3} />
              </Box>
              <Box args={[0.5, 0.2, 1.0]} position={[0, 0.2, -0.2]} castShadow>
                <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
              </Box>
              <Box args={[0.6, 0.1, 1.0]} position={[0, -0.05, 1.5]} rotation={[0.3, 0, 0]} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.3} />
              </Box>
              {/* Rear Wing */}
              <Box args={[1.2, 0.05, 0.3]} position={[0, 0.4, -1.0]} castShadow>
                <meshStandardMaterial color="#111827" />
              </Box>
              <Box args={[0.05, 0.3, 0.2]} position={[-0.4, 0.2, -1.0]} castShadow>
                <meshStandardMaterial color="#111827" />
              </Box>
              <Box args={[0.05, 0.3, 0.2]} position={[0.4, 0.2, -1.0]} castShadow>
                <meshStandardMaterial color="#111827" />
              </Box>
            </>
          )}

          {p.body.manufacturer === 'heavy-metal' && (
            <>
              {/* Boxy Armored Body */}
              <Box args={[1.2, 0.4, 2.0]} position={[0, 0.1, 0]} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.6} />
              </Box>
              <Box args={[0.8, 0.3, 0.8]} position={[0, 0.4, -0.2]} castShadow>
                <meshStandardMaterial color="#111827" roughness={0.2} metalness={0.8} />
              </Box>
              {/* Armor Plates */}
              <Box args={[1.3, 0.2, 0.6]} position={[0, 0.1, 1.0]} castShadow>
                <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.4} />
              </Box>
              <Box args={[1.3, 0.2, 0.6]} position={[0, 0.1, -1.0]} castShadow>
                <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.4} />
              </Box>
            </>
          )}

          {p.body.manufacturer === 'spark-core' && (
            <>
              {/* Futuristic Neon Body */}
              <Box args={[1.0, 0.25, 2.2]} position={[0, 0, 0]} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.2} />
              </Box>
              <Box args={[0.6, 0.25, 1.2]} position={[0, 0.25, -0.1]} castShadow>
                <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
              </Box>
              {/* Neon Accents */}
              <Box args={[0.1, 0.05, 2.0]} position={[-0.4, 0.15, 0]}>
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} toneMapped={false} />
              </Box>
              <Box args={[0.1, 0.05, 2.0]} position={[0.4, 0.15, 0]}>
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} toneMapped={false} />
              </Box>
            </>
          )}

          {(!p.body.manufacturer || p.body.manufacturer === 'generic') && (
            <>
              {/* Generic Body */}
              <Box args={[1.0, 0.3, 2.0]} position={[0, 0, 0]} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.3} roughness={0.5} />
              </Box>
              <Box args={[0.6, 0.25, 0.8]} position={[0, 0.25, -0.2]} castShadow>
                <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
              </Box>
              <Box args={[0.8, 0.2, 0.8]} position={[0, -0.05, 1.2]} rotation={[0.2, 0, 0]} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.3} roughness={0.5} />
              </Box>
            </>
          )}
        </group>
      ) : (
        /* Minimal Body if none equipped (Exposed internals) */
        <Box args={[0.6, 0.2, 1.2]} position={[0, 0.3, 0.2]} castShadow>
          <meshStandardMaterial color={mfgColor} transparent opacity={0.6} />
        </Box>
      )}

      {/* 5. Wheels */}
      {[
        [-0.8, 0.3, 1.0], [0.8, 0.3, 1.0],
        [-0.8, 0.3, -1.0], [0.8, 0.3, -1.0]
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]} ref={el => el && (wheelsRef.current[i] = el)}>
          {/* Tire */}
          <Cylinder args={[0.35 * tireScale, 0.35 * tireScale, 0.25, 24]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <meshStandardMaterial 
              color={tireColor} 
              roughness={p.tire?.id === 'spiked-tire' ? 0.9 : 0.6} 
              metalness={0.1} 
            />
          </Cylinder>
          {/* Hubcap */}
          <Cylinder args={[0.2, 0.2, 0.27, 12]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color={p.tire ? RARITY_COLORS[p.tire.rarity] : '#d1d5db'} metalness={0.8} roughness={0.2} />
          </Cylinder>
        </group>
      ))}

      {/* Racing Trail */}
      {isRacing && speed > 5 && (
        <Trail width={1} length={5} color={bodyColor} attenuation={(t) => t * t}>
          <mesh position={[0, 0.2, 1.2]} />
        </Trail>
      )}
    </group>
  );
};
