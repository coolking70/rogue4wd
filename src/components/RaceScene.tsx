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
  boostActive?: boolean;
  onBoostReady?: () => void;
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

export const RaceScene: React.FC<RaceSceneProps> = ({ playerCar, playerStats, opponentCar, opponentStats, timeScale, cameraView, stage, onFinish, onProgress, boostActive, onBoostReady }) => {
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
  const playerProgress = useRef(0.002); // Start slightly ahead to avoid immediate clumping
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
  const playerLateralOffset = useRef(-1.2); // Start wider apart
  const oppLateralOffset = useRef(1.2);
  const playerControlLoss = useRef(0);
  const oppControlLoss = useRef(0);
  
  const [playerIsAccelerating, setPlayerIsAccelerating] = useState(false);
  const [playerIsBraking, setPlayerIsBraking] = useState(false);
  const [oppIsAccelerating, setOppIsAccelerating] = useState(false);
  const [oppIsBraking, setOppIsBraking] = useState(false);

  const raceTime = useRef(0);
  const boostTriggered = useRef(false);
  const lastProgressTime = useRef(0);

  useFrame((state, delta) => {
    if (finished) return;

    // Add a small countdown delay before cars move
    if (state.clock.elapsedTime < 2) return;

    const scaledDelta = delta * timeScale;
    raceTime.current += scaledDelta;

    if (raceTime.current > 5 && !boostTriggered.current && onBoostReady) {
      boostTriggered.current = true;
      onBoostReady();
    }

    // Curvature calculation for dynamic speed
    const lookAhead = 0.02;
    const p1 = curve.getPointAt(Math.min(1, playerProgress.current));
    const p2 = curve.getPointAt(Math.min(1, playerProgress.current + lookAhead));
    const p3 = curve.getPointAt(Math.min(1, playerProgress.current + lookAhead * 2));
    
    const v1 = new THREE.Vector3().subVectors(p2, p1).normalize();
    const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
    const angle = v1.angleTo(v2);
    
    const o1 = curve.getPointAt(Math.min(1, oppProgress.current));
    const o2 = curve.getPointAt(Math.min(1, oppProgress.current + lookAhead));
    const o3 = curve.getPointAt(Math.min(1, oppProgress.current + lookAhead * 2));
    
    const ov1 = new THREE.Vector3().subVectors(o2, o1).normalize();
    const ov2 = new THREE.Vector3().subVectors(o3, o2).normalize();
    const oAngle = ov1.angleTo(ov2);

    // Dynamic target speed based on curvature and stats
    const pHandlingFactor = (playerStats.handling || 10) / 100;
    const pWeightFactor = (playerStats.weight || 10) / 100;
    const pCornerPenalty = Math.min(0.8, Math.max(0, angle * (1 + pWeightFactor - pHandlingFactor)));
    let currentPTargetSpeed = playerTargetSpeed * (1 - pCornerPenalty);
    
    if (boostActive) {
      currentPTargetSpeed *= 1.5;
    }

    const oHandlingFactor = (opponentStats.handling || 10) / 100;
    const oWeightFactor = (opponentStats.weight || 10) / 100;
    const oCornerPenalty = Math.min(0.8, Math.max(0, oAngle * (1 + oWeightFactor - oHandlingFactor)));
    const currentOTargetSpeed = oppTargetSpeed * (1 - oCornerPenalty);

    // Acceleration logic
    const playerAccel = (playerStats.acceleration || 5) / 100 * 0.05;
    const oppAccel = (opponentStats.acceleration || 5) / 100 * 0.05;

    let pAcc = false;
    let pBrk = false;
    if (playerCurrentSpeed.current < currentPTargetSpeed) {
      playerCurrentSpeed.current += playerAccel * scaledDelta;
      pAcc = true;
    } else if (playerCurrentSpeed.current > currentPTargetSpeed) {
      playerCurrentSpeed.current -= playerAccel * 1.5 * scaledDelta; // Braking is faster
      pBrk = true;
    }

    let oAcc = false;
    let oBrk = false;
    if (oppCurrentSpeed.current < currentOTargetSpeed) {
      oppCurrentSpeed.current += oppAccel * scaledDelta;
      oAcc = true;
    } else if (oppCurrentSpeed.current > currentOTargetSpeed) {
      oppCurrentSpeed.current -= oppAccel * 1.5 * scaledDelta;
      oBrk = true;
    }
    
    // Update states sparingly to avoid too many re-renders
    if (pAcc !== playerIsAccelerating) setPlayerIsAccelerating(pAcc);
    if (pBrk !== playerIsBraking) setPlayerIsBraking(pBrk);
    if (oAcc !== oppIsAccelerating) setOppIsAccelerating(oAcc);
    if (oBrk !== oppIsBraking) setOppIsBraking(oBrk);

    // Recover lateral offset and handle control loss
    if (playerControlLoss.current > 0) {
      playerControlLoss.current = Math.max(0, playerControlLoss.current - scaledDelta);
    }
    if (oppControlLoss.current > 0) {
      oppControlLoss.current = Math.max(0, oppControlLoss.current - scaledDelta);
    }

    const playerControlFactor = 1 - Math.min(1, playerControlLoss.current);
    const oppControlFactor = 1 - Math.min(1, oppControlLoss.current);

    // Calculate track curvature for inertia and racing line
    const getCurvature = (progress: number) => {
      const p1 = curve.getPointAt(progress % 1);
      const p2 = curve.getPointAt((progress + 0.01) % 1);
      const p3 = curve.getPointAt((progress + 0.02) % 1);
      
      const v1 = new THREE.Vector3().subVectors(p2, p1).normalize();
      const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
      
      // Cross product gives the turn axis. Y component indicates left/right turn.
      // If Y > 0, turning left. If Y < 0, turning right.
      const turnAxis = v1.clone().cross(v2);
      return turnAxis.y * 100; // Scale up for easier math
    };

    const playerCurvature = getCurvature(playerProgress.current);
    const oppCurvature = getCurvature(oppProgress.current);

    // Inertia pushes car OUTWARD. 
    // If turning left (curvature > 0), force is right (positive lateral offset).
    // If turning right (curvature < 0), force is left (negative lateral offset).
    const playerHandling = Math.max(1, playerStats.handling || 10);
    const oppHandling = Math.max(1, opponentStats.handling || 10);
    
    // Base target offset (racing line)
    // A good handling car will try to cut the corner (move INTO the turn).
    // Turning left (curvature > 0) -> cut left (negative offset).
    let playerTargetOffset = -playerCurvature * 0.8; 
    let oppTargetOffset = -oppCurvature * 0.8;

    // Centrifugal force pushing outward (inertia)
    // Speed is around 0.05, so speed * 20 is around 1.0
    const playerSpeedFactor = playerCurrentSpeed.current * 20;
    const oppSpeedFactor = oppCurrentSpeed.current * 20;
    
    const playerInertia = playerCurvature * Math.pow(playerSpeedFactor, 2) * (100 / playerHandling) * 0.5;
    const oppInertia = oppCurvature * Math.pow(oppSpeedFactor, 2) * (100 / oppHandling) * 0.5;

    playerTargetOffset += playerInertia;
    oppTargetOffset += oppInertia;

    // Clamp to track bounds
    playerTargetOffset = Math.max(-1.5, Math.min(1.5, playerTargetOffset));
    oppTargetOffset = Math.max(-1.5, Math.min(1.5, oppTargetOffset));

    // Collision avoidance (if close longitudinally)
    const longDist = Math.abs(playerProgress.current - oppProgress.current);
    if (longDist < 0.04) {
      const currentLatDist = oppLateralOffset.current - playerLateralOffset.current;
      if (currentLatDist > 0) {
        // Player is on the left
        playerTargetOffset = Math.min(playerTargetOffset, -0.6);
        oppTargetOffset = Math.max(oppTargetOffset, 0.6);
      } else {
        // Player is on the right
        playerTargetOffset = Math.max(playerTargetOffset, 0.6);
        oppTargetOffset = Math.min(oppTargetOffset, -0.6);
      }
    }

    playerLateralOffset.current += (playerTargetOffset - playerLateralOffset.current) * 3 * playerControlFactor * scaledDelta;
    oppLateralOffset.current += (oppTargetOffset - oppLateralOffset.current) * 3 * oppControlFactor * scaledDelta;

    playerProgress.current += playerCurrentSpeed.current * scaledDelta;
    oppProgress.current += oppCurrentSpeed.current * scaledDelta;

    const pPos = curve.getPointAt(playerProgress.current % 1);
    const oPos = curve.getPointAt(oppProgress.current % 1);

    // Throttle onProgress to ~10fps (every 0.1s) to prevent excessive React re-renders
    if (state.clock.elapsedTime - lastProgressTime.current > 0.1) {
      onProgress(playerProgress.current, oppProgress.current, [pPos.x, pPos.z], [oPos.x, oPos.z]);
      lastProgressTime.current = state.clock.elapsedTime;
    }

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

        // Calculate relative speed and impact angle
        const speedDiff = playerCurrentSpeed.current - oppCurrentSpeed.current;
        const absSpeedDiff = Math.abs(speedDiff);
        
        // Nuanced force based on relative speeds and angles
        // If dist is very small but lateralDist is larger, it's a side-swipe.
        // If dist is larger but lateralDist is small, it's a rear-end.
        const isRearEnd = dist > 0.005 && lateralDist < 0.5;
        const impactSeverity = Math.max(0.01, absSpeedDiff * (isRearEnd ? 2.0 : 1.0) + (lateralDist * 0.02));

        // Heavier/more stable car loses less speed
        const playerSpeedLoss = impactSeverity * (oppWeight / playerWeight) * (100 / Math.max(1, playerStability));
        const oppSpeedLoss = impactSeverity * (playerWeight / oppWeight) * (100 / Math.max(1, oppStability));

        // Apply speed changes
        if (speedDiff > 0) {
          // Player hit opponent from behind
          playerCurrentSpeed.current = Math.max(0.01, playerCurrentSpeed.current - playerSpeedLoss);
          oppCurrentSpeed.current = Math.min(oppTargetSpeed, oppCurrentSpeed.current + (oppSpeedLoss * 0.5)); // Opponent gets a slight push
        } else {
          // Opponent hit player from behind
          oppCurrentSpeed.current = Math.max(0.01, oppCurrentSpeed.current - oppSpeedLoss);
          playerCurrentSpeed.current = Math.min(playerTargetSpeed, playerCurrentSpeed.current + (playerSpeedLoss * 0.5)); // Player gets a slight push
        }

        // Temporary reduction in control (Control Loss)
        playerControlLoss.current = Math.min(2.0, impactSeverity * 50 * (100 / Math.max(1, playerStability)));
        oppControlLoss.current = Math.min(2.0, impactSeverity * 50 * (100 / Math.max(1, oppStability)));

        // Lateral bounce based on impact severity
        const baseBounce = 0.2;
        const dynamicBounce = Math.min(0.8, baseBounce + (impactSeverity * 10));
        
        if (playerLateralOffset.current < oppLateralOffset.current) {
          playerLateralOffset.current -= dynamicBounce * (oppWeight / playerWeight);
          oppLateralOffset.current += dynamicBounce * (playerWeight / oppWeight);
        } else {
          playerLateralOffset.current += dynamicBounce * (oppWeight / playerWeight);
          oppLateralOffset.current -= dynamicBounce * (playerWeight / oppWeight);
        }

        // Calculate midpoint for particles
        const midPos = new THREE.Vector3().addVectors(pPos, oPos).multiplyScalar(0.5);
        midPos.y = midPos.y * 0.05 + 1;
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
      
      const globalUp = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, globalUp).normalize();
      const trackUp = new THREE.Vector3().crossVectors(right, tangent).normalize();

      // Calculate unscaled position on the tube surface (radius 3)
      const carPos = pos.clone()
        .addScaledVector(trackUp, 3)
        .addScaledVector(right, offset);

      // Apply track squashing scale to position
      carPos.y *= 0.05;

      // Add a small bounce effect based on speed and stability
      const stats = isPlayer ? playerStats : opponentStats;
      const currentSpeed = isPlayer ? playerCurrentSpeed.current : oppCurrentSpeed.current;
      const stabilityFactor = (stats.stability || 10) / 100;
      const bounceAmplitude = (1 - stabilityFactor) * 0.05 * (currentSpeed / 10);
      const bounceFreq = currentSpeed * 20;
      carPos.y += Math.sin(state.clock.elapsedTime * bounceFreq) * bounceAmplitude;
      
      ref.current.position.copy(carPos);
      
      // Apply squashing to tangent for correct orientation
      const squashedTangent = tangent.clone();
      squashedTangent.y *= 0.05;
      squashedTangent.normalize();

      const lookAtPos = carPos.clone().add(squashedTangent);
      ref.current.lookAt(lookAtPos);
    };

    updateCar(playerRef, playerProgress.current, playerLateralOffset.current, true);
    updateCar(oppRef, oppProgress.current, oppLateralOffset.current, false);

    // Dynamic Camera
    if (playerRef.current) {
      const p = playerProgress.current % 1;
      const tangent = curve.getTangentAt(p);
      
      // Apply squashing to tangent for correct orientation
      tangent.y *= 0.05;
      tangent.normalize();
      
      const carPos = playerRef.current.position.clone();
      
      let targetCamPos = new THREE.Vector3();
      let lookAtTarget = new THREE.Vector3();

      if (cameraView === 'follow') {
        // Camera behind and above the car
        const cameraOffset = new THREE.Vector3(0, 4, 0).addScaledVector(tangent, -10);
        targetCamPos = carPos.clone().add(cameraOffset);
        lookAtTarget = carPos.clone().addScaledVector(tangent, 10);
      } else if (cameraView === 'top') {
        // Top-down view tracking the player
        targetCamPos = new THREE.Vector3(carPos.x, carPos.y + 40, carPos.z + 10);
        lookAtTarget = carPos.clone();
      } else if (cameraView === 'fpv') {
        // First-person view (hood camera)
        const cameraOffset = new THREE.Vector3(0, 0.8, 0).addScaledVector(tangent, 1);
        targetCamPos = carPos.clone().add(cameraOffset);
        lookAtTarget = carPos.clone().addScaledVector(tangent, 20);
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
  
  const globalUp = new THREE.Vector3(0, 1, 0);
  const startRight = new THREE.Vector3().crossVectors(startTangent, globalUp).normalize();
  const startTrackUp = new THREE.Vector3().crossVectors(startRight, startTangent).normalize();

  // Calculate unscaled position on the tube surface (radius 3)
  const unscaledStartSurfacePos = startPos.clone().addScaledVector(startTrackUp, 3.5);
  const unscaledStartRotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTangent)
  );

  const startSurfacePos = startPos.clone().addScaledVector(startTrackUp, 3);

  // Apply track squashing scale
  startSurfacePos.y *= 0.05;
  startTangent.y *= 0.05;
  startTangent.normalize();

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
        
        {/* Start/Finish Line */}
        <group position={[unscaledStartSurfacePos.x, unscaledStartSurfacePos.y, unscaledStartSurfacePos.z]} rotation={unscaledStartRotation}>
          <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <planeGeometry args={[6, 1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <planeGeometry args={[6, 0.5]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      </mesh>

      {/* Cars */}
      <group ref={playerRef} position={[startSurfacePos.x, startSurfacePos.y, startSurfacePos.z]}>
        <CarModel 
          car={playerCar} 
          isRacing 
          speed={playerStats.speed} 
          isAccelerating={playerIsAccelerating}
          isBraking={playerIsBraking}
        />
      </group>
      <group ref={oppRef} position={[startSurfacePos.x, startSurfacePos.y, startSurfacePos.z]}>
        <CarModel 
          car={opponentCar} 
          isRacing 
          speed={opponentStats.speed} 
          isAccelerating={oppIsAccelerating}
          isBraking={oppIsBraking}
        />
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
