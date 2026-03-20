import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Sphere, Cylinder, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { Car } from '../types';

interface CarModelProps {
  car: Car;
  position?: [number, number, number];
  rotation?: [number, number, number];
  isRacing?: boolean;
  speed?: number;
}

export const CarModel: React.FC<CarModelProps> = ({ car, position = [0, 0, 0], rotation = [0, 0, 0], isRacing, speed = 0 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);

  useFrame((state) => {
    if (isRacing && wheelsRef.current.length > 0) {
      const rotationSpeed = speed * 0.5;
      wheelsRef.current.forEach((wheel) => {
        wheel.rotation.x += rotationSpeed;
      });
    }
  });

  const bodyColor = useMemo(() => {
    switch (car.manufacturer.id) {
      case 'aero-tech': return '#3b82f6';
      case 'heavy-metal': return '#4b5563';
      case 'spark-core': return '#f59e0b';
      default: return '#ef4444';
    }
  }, [car.manufacturer.id]);

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Chassis */}
      <Box args={[1.2, 0.2, 2.5]} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#1f2937" />
      </Box>

      {/* Body */}
      <Box args={[1, 0.4, 2]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={bodyColor} />
      </Box>

      {/* Cockpit */}
      <Box args={[0.6, 0.3, 0.8]} position={[0, 0.8, 0.2]}>
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.6} />
      </Box>

      {/* Wheels */}
      {[
        [-0.7, 0.2, 0.8], [0.7, 0.2, 0.8],
        [-0.7, 0.2, -0.8], [0.7, 0.2, -0.8]
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]} ref={el => el && (wheelsRef.current[i] = el)}>
          <Cylinder args={[0.4, 0.4, 0.3, 16]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color="#111827" />
          </Cylinder>
        </group>
      ))}

      {/* Weapon if exists */}
      {car.parts.weapon && (
        <Cylinder args={[0.1, 0.1, 0.6]} position={[0, 0.8, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#dc2626" />
        </Cylinder>
      )}

      {/* Racing Trail */}
      {isRacing && speed > 5 && (
        <Trail width={1} length={5} color={bodyColor} attenuation={(t) => t * t}>
          <mesh position={[0, 0.2, 1.2]} />
        </Trail>
      )}
    </group>
  );
};
