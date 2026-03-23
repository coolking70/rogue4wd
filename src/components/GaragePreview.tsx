import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { CarModel } from './CarModel';
import { Car, PartType } from '../types';
import { cn } from '../lib/utils';

const PART_POSITIONS: Record<PartType, [number, number, number]> = {
  chassis: [0, 0.15, 0],
  body: [0, 0.4, 0.2],
  motor: [0, 0.3, -1.1],
  tire: [0.8, 0.3, 1.0],
  battery: [0.4, 0.25, 0],
  weapon: [0.8, 0.25, 1.6],
  special: [0, 0.5, 0],
};

const LEFT_PARTS: PartType[] = ['chassis', 'motor', 'battery', 'special'];
const RIGHT_PARTS: PartType[] = ['body', 'tire', 'weapon'];

interface GarageCarPreviewProps {
  car: Car;
  equipFlash: number;
}

const PartTracker = ({ car, equipFlash, onUpdate }: { car: Car, equipFlash: number, onUpdate: (coords: Record<string, {x: number, y: number}>) => void }) => {
  const { camera, size } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const vec = new THREE.Vector3();

  useFrame(() => {
    if (!groupRef.current) return;
    const coords: Record<string, {x: number, y: number}> = {};
    
    Object.entries(PART_POSITIONS).forEach(([type, pos]) => {
      vec.set(...pos);
      // The car is inside a Float, so we need to get the world position of the part
      groupRef.current!.localToWorld(vec);
      vec.project(camera);
      
      const x = (vec.x * 0.5 + 0.5) * size.width;
      const y = (-(vec.y * 0.5) + 0.5) * size.height;
      coords[type] = { x, y };
    });
    
    onUpdate(coords);
  });

  return (
    <group ref={groupRef}>
      <CarModel car={car} equipFlash={equipFlash} />
    </group>
  );
};

export const GarageCarPreview: React.FC<GarageCarPreviewProps> = ({ car, equipFlash }) => {
  const [coords, setCoords] = useState<Record<string, {x: number, y: number}>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // We use a mutable ref for coords to avoid React state updates every frame
  const coordsRef = useRef<Record<string, {x: number, y: number}>>({});

  const handleUpdate = (newCoords: Record<string, {x: number, y: number}>) => {
    coordsRef.current = newCoords;
    updateDOM();
  };

  const updateDOM = () => {
    if (!containerRef.current || !svgRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Update SVG paths and label positions
    Object.entries(coordsRef.current).forEach(([type, pos]) => {
      const isLeft = LEFT_PARTS.includes(type as PartType);
      const index = isLeft ? LEFT_PARTS.indexOf(type as PartType) : RIGHT_PARTS.indexOf(type as PartType);
      const total = isLeft ? LEFT_PARTS.length : RIGHT_PARTS.length;
      
      // Fixed label position
      const labelX = isLeft ? 40 : width - 240; // 200px width for label
      const labelY = (height / (total + 1)) * (index + 1);
      
      // Update label DOM
      const labelEl = labelsRef.current[type];
      if (labelEl) {
        labelEl.style.transform = `translate(${labelX}px, ${labelY - 20}px)`;
      }
      
      // Update SVG path
      const pathEl = svgRef.current?.querySelector(`#path-${type}`) as SVGPathElement;
      if (pathEl) {
        // Draw a polyline: from label, horizontal line, then diagonal to part
        const startX = isLeft ? labelX + 200 : labelX;
        const startY = labelY;
        const midX = isLeft ? startX + 40 : startX - 40;
        
        pathEl.setAttribute('d', `M ${startX} ${startY} L ${midX} ${startY} L ${pos.x} ${pos.y}`);
      }
    });
  };

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      <Canvas shadows>
        <React.Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[4, 3, 5]} />
          <OrbitControls enablePan={false} minDistance={3} maxDistance={8} />
          <Environment preset="city" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            {/* We render CarModel inside PartTracker to get accurate localToWorld */}
            <PartTracker car={car} equipFlash={equipFlash} onUpdate={handleUpdate} />
          </Float>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#09090b" roughness={0.8} />
          </mesh>
          <gridHelper args={[20, 20, '#18181b', '#09090b']} position={[0, -0.49, 0]} />
        </React.Suspense>
      </Canvas>

      {/* 2D Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg ref={svgRef} className="absolute inset-0 w-full h-full">
          {[...LEFT_PARTS, ...RIGHT_PARTS].map(type => (
            <path
              key={`path-${type}`}
              id={`path-${type}`}
              fill="none"
              stroke={car.parts[type as PartType] ? "#3b82f6" : "#3f3f46"}
              strokeWidth="1.5"
              strokeDasharray={car.parts[type as PartType] ? "none" : "4 4"}
              className="transition-colors duration-300"
            />
          ))}
        </svg>

        {[...LEFT_PARTS, ...RIGHT_PARTS].map(type => {
          const part = car.parts[type as PartType];
          const isLeft = LEFT_PARTS.includes(type as PartType);
          
          return (
            <div
              key={`label-${type}`}
              ref={el => { labelsRef.current[type] = el; }}
              className="absolute top-0 left-0 w-[200px] pointer-events-auto"
              style={{ willChange: 'transform' }}
            >
              <div className={cn(
                "p-2 rounded-xl border-2 backdrop-blur-md transition-all cursor-pointer flex items-center gap-3",
                part 
                  ? "bg-zinc-900/80 border-blue-500 shadow-lg shadow-blue-500/20" 
                  : "bg-zinc-900/50 border-zinc-800 border-dashed hover:border-zinc-600",
                isLeft ? "flex-row" : "flex-row-reverse text-right"
              )}>
                <div className="w-10 h-10 shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-500 font-bold uppercase">
                  {type.substring(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">{type}</div>
                  <div className="text-xs font-bold text-zinc-100 truncate">
                    {part ? part.name : 'Empty'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
