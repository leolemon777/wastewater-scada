import React, { useMemo } from 'react';
import * as THREE from 'three';

const yAxis = new THREE.Vector3(0, 1, 0);

interface PumpPipeReducer3DProps {
  /** Pump-side sealing face. */
  position: [number, number, number];
  /** Unit vector pointing away from the pump and toward the process pipe. */
  direction: [number, number, number];
  pumpRadius: number;
  pipeRadius: number;
  color: string;
  length?: number;
}

/**
 * Short concentric reducer between the standardized Pump3D nozzle and a larger
 * process/sludge pipe. It overlaps both meshes slightly, replacing the former
 * visual trick where an oversized tube was simply buried inside the pump.
 */
export const PumpPipeReducer3D: React.FC<PumpPipeReducer3DProps> = ({
  position,
  direction,
  pumpRadius,
  pipeRadius,
  color,
  length = 0.16,
}) => {
  const { center, rotation } = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    return {
      center: new THREE.Vector3(...position).addScaledVector(dir, length / 2),
      rotation: [e.x, e.y, e.z] as [number, number, number],
    };
  }, [direction, length, position]);

  return (
    <group position={center.toArray()} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[pipeRadius, pumpRadius, length, 32]} />
        <meshStandardMaterial color={color} roughness={0.56} metalness={0.08} />
      </mesh>
      <mesh position={[0, -length / 2 + 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[pumpRadius * 1.32, pumpRadius * 1.32, 0.024, 32]} />
        <meshStandardMaterial color="#AEB9C3" roughness={0.38} metalness={0.72} />
      </mesh>
    </group>
  );
};
