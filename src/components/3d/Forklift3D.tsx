import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScadaStore } from '../../store/useScadaStore';
import { getSludgeForkliftSurfaceY } from './sludgePlatformLayout';
import { WoodenPallet, WovenTonBag } from './SludgeLogistics';

// Reused per-frame temporaries. Module-scoped; useFrame runs single-threaded so sharing is safe.
const _targetVec = new THREE.Vector3();


interface Forklift3DProps {
  position?: [number, number, number];
  patrolPath?: [number, number, number][]; // Waypoints for the forklift patrol
  pauseAtIndices?: number[];
  speed?: number;
  pauseTime?: number; // Time in seconds to pause for loading/unloading
}

export const Forklift3D: React.FC<Forklift3DProps> = ({
  position = [10, 0, 23.8],
  patrolPath = [
    [8, 0, 23.8],
    [22, 0, 23.8]
  ],
  pauseAtIndices = [2, 4],
  speed = 2.2,
  pauseTime = 4.0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const carriageRef = useRef<THREE.Group>(null);
  
  // Wheel refs for rotation animation
  const frontLeftWheelRef = useRef<THREE.Mesh>(null);
  const frontRightWheelRef = useRef<THREE.Mesh>(null);
  const rearLeftWheelRef = useRef<THREE.Mesh>(null);
  const rearRightWheelRef = useRef<THREE.Mesh>(null);

  // Patrol and animation state
  const currentPos = useRef<THREE.Vector3>(new THREE.Vector3(...(patrolPath[0] || position)));
  const targetIdx = useRef<number>(patrolPath.length > 1 ? 1 : 0);
  const curRotation = useRef<number>(Math.PI / 2); // Initial rotation facing right (+X)
  const curPitch = useRef<number>(0);
  const pauseTimer = useRef<number>(0);
  const isMoving = useRef<boolean>(patrolPath.length > 1);
  const forkHeight = useRef<number>(0.25);
  const wheelRot = useRef<number>(0);

  // Retrieve forklift ton bag state
  const forkliftHasBag = useScadaStore((s) => s.forkliftHasBag);

  // Stringified path for stable useEffect dependency (prevents resets on parent renders)
  const pathString = JSON.stringify(patrolPath);
  useEffect(() => {
    if (patrolPath.length > 0) {
      currentPos.current.set(...patrolPath[0]);
      if (groupRef.current) {
        groupRef.current.position.copy(currentPos.current);
      }
      targetIdx.current = patrolPath.length > 1 ? 1 : 0;
      isMoving.current = patrolPath.length > 1;
      pauseTimer.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathString]);

  // Dimensions for wheel rotation calculation
  const wheelRadius = 0.3;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const hasPath = patrolPath.length > 1;

    if (hasPath) {
      if (pauseTimer.current > 0) {
        // Paused at loading/unloading point
        pauseTimer.current -= dt;
        isMoving.current = false;
        curPitch.current += (0 - curPitch.current) * Math.min(1.0, dt * 6.0);
        if (groupRef.current) groupRef.current.rotation.x = curPitch.current;

        const elapsedPause = pauseTime - pauseTimer.current;

        // Animate forks lowering and raising during pause:
        // - First 1.2s: lower forks to floor (height = 0.05)
        // - Middle: stay low (loading/unloading simulation)
        // - Last 1.2s: raise forks to carry height (height = 0.28)
        if (elapsedPause < 1.2) {
          // Lowering
          const progress = elapsedPause / 1.2;
          forkHeight.current = 0.28 - progress * 0.23;
        } else if (pauseTimer.current < 1.2) {
          // Raising
          const progress = (1.2 - pauseTimer.current) / 1.2;
          forkHeight.current = 0.05 + progress * 0.23;
        } else {
          // Stay down
          forkHeight.current = 0.05;
        }
      } else {
        // Driving towards target
        isMoving.current = true;

        // Subtle carrying bobbing
        forkHeight.current = 0.28 + Math.sin(state.clock.elapsedTime * 14) * 0.008;

        _targetVec.set(...patrolPath[targetIdx.current]);
        const targetX = _targetVec.x;
        const targetZ = _targetVec.z;
        const dx = targetX - currentPos.current.x;
        const dz = targetZ - currentPos.current.z;
        const stepSize = speed * dt;

        if (Math.abs(dx) < 0.15 && Math.abs(dz) < 0.15) {
          currentPos.current.set(targetX, getSludgeForkliftSurfaceY(targetX, targetZ), targetZ);

          const shouldPause = pauseAtIndices.includes(targetIdx.current);

          if (shouldPause) {
            pauseTimer.current = pauseTime;

            const loadIdx = pauseAtIndices[0];
            const unloadIdx = pauseAtIndices[1] ?? pauseAtIndices[0];
            if (targetIdx.current === loadIdx) {
              curRotation.current = Math.PI;
              if (groupRef.current) groupRef.current.rotation.y = Math.PI;
              useScadaStore.setState({ forkliftHasBag: true, sludgeBagLevel: 0 });
            } else if (targetIdx.current === unloadIdx) {
              // Warehouse unload: forklift entered from the north door heading
              // south (+Z), so forks point south toward the interior staging bags.
              curRotation.current = 0;
              if (groupRef.current) groupRef.current.rotation.y = 0;
              useScadaStore.getState().addHazwasteStoredBag();
              useScadaStore.setState({ forkliftHasBag: false });
            }
          }

          targetIdx.current = (targetIdx.current + 1) % patrolPath.length;
          isMoving.current = !shouldPause;

          if (groupRef.current) {
            groupRef.current.position.copy(currentPos.current);
          }
        } else {
          let moveX = 0;
          let moveZ = 0;
          if (Math.abs(dx) > 0.15) {
            moveX = Math.sign(dx) * Math.min(Math.abs(dx), stepSize);
          } else if (Math.abs(dz) > 0.15) {
            moveZ = Math.sign(dz) * Math.min(Math.abs(dz), stepSize);
          }

          currentPos.current.x += moveX;
          currentPos.current.z += moveZ;
          currentPos.current.y = getSludgeForkliftSurfaceY(currentPos.current.x, currentPos.current.z);

          if (groupRef.current) {
            groupRef.current.position.copy(currentPos.current);
          }

          const sampleDz = 0.3;
          const yNorth = getSludgeForkliftSurfaceY(currentPos.current.x, currentPos.current.z - sampleDz);
          const ySouth = getSludgeForkliftSurfaceY(currentPos.current.x, currentPos.current.z + sampleDz);
          const targetPitch = Math.atan2(-(yNorth - ySouth), sampleDz * 2) * 0.65;
          curPitch.current += (targetPitch - curPitch.current) * Math.min(1.0, dt * 8.0);

          const travelDist = Math.hypot(moveX, moveZ);
          wheelRot.current += travelDist / wheelRadius;
          if (frontLeftWheelRef.current) frontLeftWheelRef.current.rotation.x = wheelRot.current;
          if (frontRightWheelRef.current) frontRightWheelRef.current.rotation.x = wheelRot.current;
          if (rearLeftWheelRef.current) rearLeftWheelRef.current.rotation.x = wheelRot.current;
          if (rearRightWheelRef.current) rearRightWheelRef.current.rotation.x = wheelRot.current;

          const targetRot = Math.abs(moveX) > Math.abs(moveZ)
            ? (moveX > 0 ? Math.PI / 2 : -Math.PI / 2)
            : (moveZ > 0 ? 0 : Math.PI);
          let diffAngle = targetRot - curRotation.current;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

          curRotation.current += diffAngle * Math.min(1.0, dt * 6.0);
          if (groupRef.current) {
            groupRef.current.rotation.y = curRotation.current;
            groupRef.current.rotation.x = curPitch.current;
          }
        }
      }
    } else if (groupRef.current) {
      curPitch.current += (0 - curPitch.current) * Math.min(1.0, dt * 6.0);
      groupRef.current.rotation.x = curPitch.current;
    }

    // Apply carriage position Y
    if (carriageRef.current) {
      carriageRef.current.position.y = forkHeight.current;
    }
  });

  // Industrial colors — safety-orange painted body (standard counterbalance
  // forklift livery), dark forged steel for mast/forks, silver only on levers.
  const forkliftBody = '#C8551F'; // safety orange paint
  const darkMetal = '#374151'; // Dark Grey Steel
  const mastSteel = '#5D646B'; // rolled mast channel steel
  const brightSilver = '#D4D8DC'; // control lever shafts

  return (
    <group ref={groupRef} position={position} receiveShadow>
      {/* ================= FORKLIFT CHASSIS ================= */}
      {/* Main Orange Body */}
      <mesh position={[0, 0.45, 0.1]} receiveShadow>
        <boxGeometry args={[1.0, 0.5, 1.8]} />
        <meshStandardMaterial color={forkliftBody} roughness={0.42} metalness={0.15} />
      </mesh>

      {/* Engine Cover & Battery Box (Behind seat) */}
      <mesh position={[0, 0.85, -0.3]} >
        <boxGeometry args={[0.9, 0.4, 0.7]} />
        <meshStandardMaterial color={forkliftBody} roughness={0.45} metalness={0.12} />
      </mesh>

      {/* Rear Counterweight (Dark steel block at back) */}
      <mesh position={[0, 0.55, -0.85]} >
        <boxGeometry args={[1.0, 0.7, 0.35]} />
        <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Rear Guard Flaps */}
      <mesh position={[0, 0.3, -0.98]} >
        <boxGeometry args={[0.96, 0.15, 0.08]} />
        <meshStandardMaterial color={forkliftBody} roughness={0.42} metalness={0.12} />
      </mesh>

      {/* Exhaust Pipe */}
      <group position={[0.35, 0.85, -0.75]}>
        <mesh >
          <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Curved tip */}
        <mesh position={[0.04, 0.42, 0]} rotation={[0, 0, -Math.PI / 4]} >
          <cylinderGeometry args={[0.025, 0.025, 0.12, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* ================= CABIN & CONTROLS ================= */}
      {/* Driver Seat */}
      <group position={[0, 0.82, 0.15]}>
        {/* Cushion */}
        <mesh >
          <boxGeometry args={[0.5, 0.08, 0.45]} />
          <meshStandardMaterial color="#1F2937" roughness={0.8} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 0.25, -0.2]} rotation={[-0.15, 0, 0]} >
          <boxGeometry args={[0.48, 0.42, 0.08]} />
          <meshStandardMaterial color="#1F2937" roughness={0.8} />
        </mesh>

        {/* ================= SITTING DRIVER CHARACTER ================= */}
        <group position={[0, 0.04, 0.03]}>
          {/* Pelvis / Pants */}
          <mesh position={[0, 0.08, -0.05]} >
            <boxGeometry args={[0.38, 0.15, 0.32]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.7} />
          </mesh>
          {/* Torso */}
          <mesh position={[0, 0.26, -0.08]} rotation={[-0.08, 0, 0]} >
            <boxGeometry args={[0.42, 0.28, 0.26]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.7} />
          </mesh>
          {/* Safety Vest */}
          <mesh position={[0, 0.26, -0.075]} rotation={[-0.08, 0, 0]} >
            <boxGeometry args={[0.44, 0.26, 0.28]} />
            <meshStandardMaterial color="#eab308" roughness={0.5} />
          </mesh>
          {/* Vest Reflective strip */}
          <mesh position={[0, 0.18, 0.066]} rotation={[-0.08, 0, 0]}>
            <boxGeometry args={[0.36, 0.03, 0.01]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.2} />
          </mesh>
          {/* Vest Reflective shoulder straps */}
          <mesh position={[-0.09, 0.3, 0.056]} rotation={[-0.08, 0, 0.08]}>
            <boxGeometry args={[0.03, 0.1, 0.01]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[0.09, 0.3, 0.056]} rotation={[-0.08, 0, -0.08]}>
            <boxGeometry args={[0.03, 0.1, 0.01]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>

          {/* Neck */}
          <mesh position={[0, 0.42, -0.1]} >
            <cylinderGeometry args={[0.045, 0.045, 0.08, 8]} />
            <meshStandardMaterial color="#e0a96d" roughness={0.6} />
          </mesh>

          {/* Head & Safety Gear */}
          <group position={[0, 0.52, -0.11]}>
            <mesh >
              <sphereGeometry args={[0.1, 16, 12]} />
              <meshStandardMaterial color="#e0a96d" roughness={0.6} />
            </mesh>
            {/* Goggles */}
            <mesh position={[0, 0.02, 0.09]}>
              <boxGeometry args={[0.15, 0.035, 0.03]} />
              <meshStandardMaterial color="#0c4a6e" transparent opacity={0.8} />
            </mesh>
            {/* Respirator mask */}
            <mesh position={[0, -0.04, 0.09]} rotation={[-0.1, 0, 0]}>
              <coneGeometry args={[0.055, 0.07, 4]} />
              <meshStandardMaterial color="#1e293b" roughness={0.8} />
            </mesh>
            {/* Safety helmet — worker yellow, matches the patrol crew */}
            <mesh position={[0, 0.08, 0]} >
              <sphereGeometry args={[0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#EAB308" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} >
              <cylinderGeometry args={[0.145, 0.145, 0.015, 16]} />
              <meshStandardMaterial color="#D6A000" roughness={0.42} />
            </mesh>
          </group>

          {/* Left Arm (holding steering wheel) */}
          <group position={[-0.22, 0.32, -0.05]}>
            <mesh >
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[0.01, -0.08, 0.07]} rotation={[-0.5, 0.2, 0.1]} >
              <cylinderGeometry args={[0.035, 0.032, 0.16, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[0.08, -0.15, 0.22]} rotation={[0.4, -0.6, 0]} >
              <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
              <meshStandardMaterial color="#0E7490" roughness={0.6} /> {/* Teal glove */}
            </mesh>
          </group>

          {/* Right Arm (resting on dashboard / levers) */}
          <group position={[0.22, 0.32, -0.05]}>
            <mesh >
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[-0.01, -0.08, 0.07]} rotation={[-0.5, -0.2, -0.1]} >
              <cylinderGeometry args={[0.035, 0.032, 0.16, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[-0.08, -0.15, 0.22]} rotation={[0.3, 0.6, 0]} >
              <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
              <meshStandardMaterial color="#0E7490" roughness={0.6} />
            </mesh>
          </group>

          {/* Left Leg */}
          <group position={[-0.12, 0.06, 0.06]}>
            <mesh rotation={[0.6, 0, 0]} >
              <cylinderGeometry args={[0.05, 0.045, 0.26, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[0, -0.16, 0.11]} rotation={[-0.2, 0, 0]} >
              <cylinderGeometry args={[0.045, 0.04, 0.24, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[0, -0.28, 0.14]} >
              <boxGeometry args={[0.08, 0.05, 0.13]} />
              <meshStandardMaterial color="#5c4033" />
            </mesh>
          </group>

          {/* Right Leg */}
          <group position={[0.12, 0.06, 0.06]}>
            <mesh rotation={[0.6, 0, 0]} >
              <cylinderGeometry args={[0.05, 0.045, 0.26, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[0, -0.16, 0.11]} rotation={[-0.2, 0, 0]} >
              <cylinderGeometry args={[0.045, 0.04, 0.24, 8]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh position={[0, -0.28, 0.14]} >
              <boxGeometry args={[0.08, 0.05, 0.13]} />
              <meshStandardMaterial color="#5c4033" />
            </mesh>
          </group>
        </group>
      </group>

      {/* Steering Column & Wheel */}
      <group position={[0.2, 0.95, 0.52]} rotation={[-0.25, 0, 0]}>
        {/* Column */}
        <mesh >
          <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.6} />
        </mesh>
        {/* Steering Wheel Ring */}
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} >
          <torusGeometry args={[0.13, 0.02, 6, 16]} />
          <meshStandardMaterial color="#111827" roughness={0.9} />
        </mesh>
        {/* Steering Center Cap */}
        <mesh position={[0, 0.25, 0]} >
          <cylinderGeometry args={[0.03, 0.03, 0.01, 8]} />
          <meshStandardMaterial color={darkMetal} />
        </mesh>
      </group>

      {/* Hydraulic Control Levers (3 small sticks) */}
      <group position={[-0.28, 0.8, 0.45]}>
        <mesh position={[-0.04, 0.1, 0]} rotation={[0.1, 0, 0]} >
          <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
          <meshStandardMaterial color={brightSilver} metalness={0.9} />
        </mesh>
        <mesh position={[-0.04, 0.2, 0]} >
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#EF4444" />
        </mesh>

        <mesh position={[0, 0.1, -0.04]} rotation={[-0.1, 0, 0]} >
          <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
          <meshStandardMaterial color={brightSilver} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.2, -0.04]} >
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#10B981" />
        </mesh>

        <mesh position={[0.04, 0.1, 0.02]} rotation={[0, 0, 0.05]} >
          <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
          <meshStandardMaterial color={brightSilver} metalness={0.9} />
        </mesh>
        <mesh position={[0.04, 0.2, 0.02]} >
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#3B82F6" />
        </mesh>
      </group>

      {/* Overhead Protective Cage (ROPS) */}
      <group>
        {/* Support Pillar Front Left */}
        <mesh position={[-0.45, 1.25, 0.42]} rotation={[0.08, 0, 0.04]} >
          <cylinderGeometry args={[0.02, 0.02, 1.3, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} />
        </mesh>
        {/* Support Pillar Front Right */}
        <mesh position={[0.45, 1.25, 0.42]} rotation={[0.08, 0, -0.04]} >
          <cylinderGeometry args={[0.02, 0.02, 1.3, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} />
        </mesh>
        {/* Support Pillar Rear Left */}
        <mesh position={[-0.45, 1.25, -0.42]} rotation={[-0.08, 0, 0.04]} >
          <cylinderGeometry args={[0.02, 0.02, 1.3, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} />
        </mesh>
        {/* Support Pillar Rear Right */}
        <mesh position={[0.45, 1.25, -0.42]} rotation={[-0.08, 0, -0.04]} >
          <cylinderGeometry args={[0.02, 0.02, 1.3, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} />
        </mesh>
        {/* Top Roof Shield */}
        <mesh position={[0, 1.88, 0]} >
          <boxGeometry args={[0.96, 0.04, 0.98]} />
          <meshStandardMaterial color={darkMetal} roughness={0.4} />
        </mesh>
        {/* Roof Cutouts (safety grid) */}
        <mesh position={[0, 1.89, 0.15]}>
          <boxGeometry args={[0.7, 0.03, 0.1]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 1.89, -0.15]}>
          <boxGeometry args={[0.7, 0.03, 0.1]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {/* Safety Warning Light on top of cage */}
      <group position={[-0.2, 1.95, -0.3]}>
        <mesh >
          <cylinderGeometry args={[0.04, 0.04, 0.06, 8]} />
          <meshStandardMaterial color={darkMetal} />
        </mesh>
        <mesh position={[0, 0.05, 0]} >
          <cylinderGeometry args={[0.03, 0.03, 0.05, 8]} />
          <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Front Headlights */}
      <group position={[-0.4, 0.8, 0.85]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} >
          <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
          <meshStandardMaterial color={darkMetal} />
        </mesh>
        <mesh position={[0, 0, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.01, 8]} />
          <meshStandardMaterial color="#FFFEE0" emissive="#FFFEE0" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <group position={[0.4, 0.8, 0.85]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} >
          <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
          <meshStandardMaterial color={darkMetal} />
        </mesh>
        <mesh position={[0, 0, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.01, 8]} />
          <meshStandardMaterial color="#FFFEE0" emissive="#FFFEE0" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* ================= WHEELS ================= */}
      {/* Front Left Wheel (Larger) */}
      <group position={[-0.56, 0.3, 0.55]}>
        <mesh ref={frontLeftWheelRef} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.22, 16]} />
          <meshStandardMaterial color="#1F2937" roughness={0.85} />
        </mesh>
        {/* Rim */}
        <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} >
          <cylinderGeometry args={[0.18, 0.18, 0.04, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Front Right Wheel (Larger) */}
      <group position={[0.56, 0.3, 0.55]}>
        <mesh ref={frontRightWheelRef} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.22, 16]} />
          <meshStandardMaterial color="#1F2937" roughness={0.85} />
        </mesh>
        {/* Rim */}
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} >
          <cylinderGeometry args={[0.18, 0.18, 0.04, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Rear Left Wheel (Smaller, Steerable) */}
      <group position={[-0.48, 0.22, -0.65]}>
        <mesh ref={rearLeftWheelRef} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 16]} />
          <meshStandardMaterial color="#1F2937" roughness={0.85} />
        </mesh>
        {/* Rim */}
        <mesh position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} >
          <cylinderGeometry args={[0.13, 0.13, 0.04, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Rear Right Wheel (Smaller, Steerable) */}
      <group position={[0.48, 0.22, -0.65]}>
        <mesh ref={rearRightWheelRef} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 16]} />
          <meshStandardMaterial color="#1F2937" roughness={0.85} />
        </mesh>
        {/* Rim */}
        <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} >
          <cylinderGeometry args={[0.13, 0.13, 0.04, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* ================= METAL MAST (HYDRAULIC RAILS) ================= */}
      <group position={[0, 0.9, 0.95]}>
        {/* Left Mast Rail */}
        <mesh position={[-0.28, 0, 0]} >
          <boxGeometry args={[0.06, 1.8, 0.08]} />
          <meshStandardMaterial color={mastSteel} metalness={0.55} roughness={0.42} />
        </mesh>
        {/* Right Mast Rail */}
        <mesh position={[0.28, 0, 0]} >
          <boxGeometry args={[0.06, 1.8, 0.08]} />
          <meshStandardMaterial color={mastSteel} metalness={0.55} roughness={0.42} />
        </mesh>
        {/* Central Hydraulic Piston */}
        <mesh position={[0, -0.2, -0.02]} >
          <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
          <meshStandardMaterial color={darkMetal} metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Crossbar Top */}
        <mesh position={[0, 0.88, 0]} >
          <boxGeometry args={[0.62, 0.06, 0.06]} />
          <meshStandardMaterial color={darkMetal} />
        </mesh>
        {/* Crossbar Middle */}
        <mesh position={[0, 0, 0]} >
          <boxGeometry args={[0.62, 0.06, 0.04]} />
          <meshStandardMaterial color={darkMetal} />
        </mesh>
      </group>

      {/* ================= VERTICALLY MOVING CARRIAGE & FORKS ================= */}
      {/* The carriageRef vertical position is controlled inside useFrame */}
      <group ref={carriageRef} position={[0, 0.25, 0.95]}>
        {/* Carriage Slider Plate */}
        <mesh position={[0, 0, 0.03]} >
          <boxGeometry args={[0.74, 0.35, 0.04]} />
          <meshStandardMaterial color={darkMetal} metalness={0.8} roughness={0.4} />
        </mesh>

        {/* Fork 1 (Left Fork) */}
        <group position={[-0.22, 0, 0.05]}>
          {/* Vertical section on carriage */}
          <mesh position={[0, -0.05, 0.025]} >
            <boxGeometry args={[0.08, 0.45, 0.03]} />
            <meshStandardMaterial color="#2E3338" metalness={0.5} roughness={0.55} />
          </mesh>
          {/* Horizontal fork blade projecting forward */}
          <mesh position={[0, -0.26, 0.52]} >
            <boxGeometry args={[0.08, 0.032, 1.0]} />
            <meshStandardMaterial color="#2E3338" metalness={0.5} roughness={0.55} />
          </mesh>
        </group>

        {/* Fork 2 (Right Fork) */}
        <group position={[0.22, 0, 0.05]}>
          {/* Vertical section on carriage */}
          <mesh position={[0, -0.05, 0.025]} >
            <boxGeometry args={[0.08, 0.45, 0.03]} />
            <meshStandardMaterial color="#2E3338" metalness={0.5} roughness={0.55} />
          </mesh>
          {/* Horizontal fork blade projecting forward */}
          <mesh position={[0, -0.26, 0.52]} >
            <boxGeometry args={[0.08, 0.032, 1.0]} />
            <meshStandardMaterial color="#2E3338" metalness={0.5} roughness={0.55} />
          </mesh>
        </group>

        {/* ================= WOODEN PALLET & SLUDGE TON BAG ================= */}
        {/* Placed on top of the horizontal fork blades (Y offset -0.24 to sit flush) */}
        {forkliftHasBag && (
          <group position={[0, -0.245, 0.56]}>
            <WoodenPallet />
            <WovenTonBag position={[0, 0.1, 0]} sludgeLevel={100} />
          </group>
        )}
      </group>
    </group>
  );
};
