import React from 'react';

type PipeAxis = '+x' | '-x' | '+z' | '-z' | '+y' | '-y';

interface PipeInspectionCollar3DProps {
  position: [number, number, number];
  axis?: PipeAxis;
  radius?: number;
  color?: string;
}

const axisRotation: Record<PipeAxis, [number, number, number]> = {
  '+x': [0, 0, -Math.PI / 2],
  '-x': [0, 0, Math.PI / 2],
  '+z': [Math.PI / 2, 0, 0],
  '-z': [-Math.PI / 2, 0, 0],
  '+y': [0, 0, 0],
  '-y': [Math.PI, 0, 0],
};

export const PipeInspectionCollar3D: React.FC<PipeInspectionCollar3DProps> = ({
  position,
  axis = '+x',
  radius = 0.1,
  color = '#14b8a6',
}) => (
  <group position={position} rotation={axisRotation[axis]}>
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 1.0, radius * 1.0, radius * 0.075, 28]} />
      <meshStandardMaterial color={color} roughness={0.52} metalness={0.08} />
    </mesh>
    <mesh position={[0, -radius * 0.048, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 1.1, radius * 1.1, radius * 0.02, 28]} />
      <meshStandardMaterial color="#AEB9C3" roughness={0.36} metalness={0.7} />
    </mesh>
    <mesh position={[0, radius * 0.048, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 1.1, radius * 1.1, radius * 0.02, 28]} />
      <meshStandardMaterial color="#AEB9C3" roughness={0.36} metalness={0.7} />
    </mesh>
    <mesh position={[radius * 0.78, 0, 0]} castShadow>
      <boxGeometry args={[radius * 0.055, radius * 0.18, radius * 0.07]} />
      <meshStandardMaterial color="#4B5563" roughness={0.46} metalness={0.55} />
    </mesh>
    <mesh position={[-radius * 0.78, 0, 0]} castShadow>
      <boxGeometry args={[radius * 0.055, radius * 0.18, radius * 0.07]} />
      <meshStandardMaterial color="#4B5563" roughness={0.46} metalness={0.55} />
    </mesh>
  </group>
);
