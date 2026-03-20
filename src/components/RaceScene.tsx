import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CarModel } from './CarModel';
import { Car, Stats } from '../types';
import { Environment, Stars, Sparkles } from '@react-three/drei';
import { TRACKS } from '../constants';

interface RaceSceneProps {
  playerCar: Car;
  playerStats: Stats;
  opponentCar: Car;
  opponentStats: Stats;
  timeScale: number;
  cameraView: 'follow' | 'top' | 'fpv';
  stage: number;
  onFinish: (isWinner: boolean) => void;
  onProgress: (playerProg: number, oppProg: number, playerPos: [number, number], oppPos: [number, number]) => void;
}

const playBumpSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const RaceScene: React.FC<RaceSceneProps> = ({ playerCar, playerStats, opponentCar, opponentStats, timeScale, cameraView, stage, onFinish, onProgress }) => {
  const curve = useMemo(() => {
    const trackIndex = (stage - 1) % TRACKS.length;
    const points = TRACKS[trackIndex].map(p => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  }, [stage]);

  const trackGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 300, 3, 16, true);
  }, [curve]);

  const playerRef = useRef<THREE.Group>(null);
  const oppRef = useRef<THREE.Group>(null);
  const playerProgress = useRef(0);
  const oppProgress = useRef(0);
  const [finished, setFinished] = useState(false);
  
  // Collision state
  const [collisionPos, setCollisionPos] = useState<THREE.Vector3 | null>(null);
  const collisionCooldown = useRef(0);
  const shakeIntensity = useRef(0);

  const calculateSpeed = (stats: Stats) => {
    const performance = (stats.speed || 0) * 0.5 + (stats.acceleration || 0) * 0.3 + (stats.handling || 0) * 0.2;
    // Base speed + scaled performance. 
    // A performance of 50 gives ~0.05 progress per second (approx 20s lap)
    return 0.03 + (performance / 100) * 0.04; 
  };

  const playerTargetSpeed = useMemo(() => calculateSpeed(playerStats), [playerStats]);
  const oppTargetSpeed = useMemo(() => calculateSpeed(opponentStats), [opponentStats]);

  const playerCurrentSpeed = useRef(0);
  const oppCurrentSpeed = useRef(0);
  const playerLateralOffset = useRef(-0.8);
  const oppLateralOffset = useRef(0.8);

  useFrame((state, delta) => {
    if (finished) return;

    // Add a small countdown delay before cars move
    if (state.clock.elapsedTime < 2) return;

    const scaledDelta = delta * timeScale;

    // Acceleration logic
    const playerAccel = (playerStats.acceleration || 5) / 100 * 0.05;
    const oppAccel = (opponentStats.acceleration || 5) / 100 * 0.05;

    if (playerCurrentSpeed.current < playerTargetSpeed) {
      playerCurrentSpeed.current += playerAccel * scaledDelta;
    }
    if (oppCurrentSpeed.current < oppTargetSpeed) {
      oppCurrentSpeed.current += oppAccel * scaledDelta;
    }

    // Recover lateral offset
    playerLateralOffset.current += (-0.8 - playerLateralOffset.current) * 5 * scaledDelta;
    oppLateralOffset.current += (0.8 - oppLateralOffset.current) * 5 * scaledDelta;

    playerProgress.current += playerCurrentSpeed.current * scaledDelta;
    oppProgress.current += oppCurrentSpeed.current * scaledDelta;

    const pPos = curve.getPointAt(playerProgress.current % 1);
    const oPos = curve.getPointAt(oppProgress.current % 1);

    onProgress(playerProgress.current, oppProgress.current, [pPos.x, pPos.z], [oPos.x, oPos.z]);

    // Collision detection
    if (collisionCooldown.current > 0) {
      collisionCooldown.current -= scaledDelta;
    } else {
      const dist = Math.abs(playerProgress.current - oppProgress.current);
      // Check if they are close longitudinally AND laterally
      const lateralDist = Math.abs(playerLateralOffset.current - oppLateralOffset.current);
      
      if (dist < 0.015 && lateralDist < 1.0 && playerProgress.current > 0.05 && oppProgress.current > 0.05) {
        // Collision occurred!
        collisionCooldown.current = 0.5; // 0.5 second cooldown
        shakeIntensity.current = 0.8;
        playBumpSound();
        
        // Physics logic: Weight and Stability affect speed loss
        const playerWeight = playerStats.weight || 10;
        const oppWeight = opponentStats.weight || 10;
        const playerStability = playerStats.stability || 10;
        const oppStability = opponentStats.stability || 10;

        // Heavier/more stable car loses less speed
        const playerSpeedLoss = 0.01 * (oppWeight / playerWeight) * (100 / Math.max(1, playerStability));
        const oppSpeedLoss = 0.01 * (playerWeight / oppWeight) * (100 / Math.max(1, oppStability));

        playerCurrentSpeed.current = Math.max(0.01, playerCurrentSpeed.current - playerSpeedLoss);
        oppCurrentSpeed.current = Math.max(0.01, oppCurrentSpeed.current - oppSpeedLoss);

        // Lateral bounce
        const bounceForce = 0.4;
        if (playerLateralOffset.current < oppLateralOffset.current) {
          playerLateralOffset.current -= bounceForce;
          oppLateralOffset.current += bounceForce;
        } else {
          playerLateralOffset.current += bounceForce;
          oppLateralOffset.current -= bounceForce;
        }

        // Calculate midpoint for particles
        const midPos = new THREE.Vector3().addVectors(pPos, oPos).multiplyScalar(0.5);
        midPos.y = 1;
        setCollisionPos(midPos);
        
        // Hide particles after a short time
        setTimeout(() => setCollisionPos(null), 500);
      }
    }

    // Decay shake
    if (shakeIntensity.current > 0) {
      shakeIntensity.current -= scaledDelta * 2;
      if (shakeIntensity.current < 0) shakeIntensity.current = 0;
    }

    if (playerProgress.current >= 1 || oppProgress.current >= 1) {
      setFinished(true);
      onFinish(playerProgress.current >= oppProgress.current);
      return;
    }

    const updateCar = (ref: React.RefObject<THREE.Group>, progress: number, offset: number, isPlayer: boolean) => {
      if (!ref.current) return;
      const p = progress % 1;
      const pos = curve.getPointAt(p);
      const tangent = curve.getTangentAt(p);
      
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      // Position car on the track surface (y offset) and side offset
      pos.y = 0.15; 
      pos.addScaledVector(right, offset);
      
      ref.current.position.copy(pos);
      
      const lookAtPos = pos.clone().add(tangent);
      ref.current.lookAt(lookAtPos);
    };

    updateCar(playerRef, playerProgress.current, playerLateralOffset.current, true);
    updateCar(oppRef, oppProgress.current, oppLateralOffset.current, false);

    // Dynamic Camera
    if (playerRef.current) {
      const p = playerProgress.current % 1;
      const pos = curve.getPointAt(p);
      const tangent = curve.getTangentAt(p);
      
      let targetCamPos = new THREE.Vector3();
      let lookAtTarget = new THREE.Vector3();

      if (cameraView === 'follow') {
        // Camera behind and above the car
        const cameraOffset = new THREE.Vector3(0, 6, 0).addScaledVector(tangent, -12);
        targetCamPos = pos.clone().add(cameraOffset);
        lookAtTarget = pos.clone().addScaledVector(tangent, 10);
      } else if (cameraView === 'top') {
        // Top-down view tracking the player
        targetCamPos = new THREE.Vector3(pos.x, 40, pos.z + 10);
        lookAtTarget = pos.clone();
      } else if (cameraView === 'fpv') {
        // First-person view (hood camera)
        const cameraOffset = new THREE.Vector3(0, 1.5, 0).addScaledVector(tangent, 2);
        targetCamPos = pos.clone().add(cameraOffset);
        lookAtTarget = pos.clone().addScaledVector(tangent, 20);
      }

      // Apply shake
      if (shakeIntensity.current > 0) {
        targetCamPos.x += (Math.random() - 0.5) * shakeIntensity.current;
        targetCamPos.y += (Math.random() - 0.5) * shakeIntensity.current;
        targetCamPos.z += (Math.random() - 0.5) * shakeIntensity.current;
      }

      state.camera.position.lerp(targetCamPos, 0.1);
      state.camera.lookAt(lookAtTarget);
    }
  });

  const startPos = curve.getPointAt(0);
  const startTangent = curve.getTangentAt(0);
  const startRotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTangent)
  );

  return (
    <>
      <Environment preset="city" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <spotLight position={[-10, 25, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />

      {/* Track */}
      <mesh receiveShadow position={[0, 0, 0]} scale={[1, 0.05, 1]}>
        <primitive object={trackGeometry} attach="geometry" />
        <meshStandardMaterial color="#27272a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Start/Finish Line */}
      <group position={[startPos.x, 0.16, startPos.z]} rotation={startRotation}>
        <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[6, 1]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[6, 0.5]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
      </group>

      {/* Cars */}
      <group ref={playerRef} position={[startPos.x, 0.15, startPos.z]}>
        <CarModel car={playerCar} isRacing speed={playerStats.speed} />
      </group>
      <group ref={oppRef} position={[startPos.x, 0.15, startPos.z]}>
        <CarModel car={opponentCar} isRacing speed={opponentStats.speed} />
      </group>

      {/* Collision Particles */}
      {collisionPos && (
        <group position={collisionPos}>
          <Sparkles count={50} scale={4} size={6} speed={2} opacity={1} color="#ffaa00" />
          <pointLight color="#ff5500" intensity={2} distance={10} />
        </group>
      )}
    </>
  );
};
