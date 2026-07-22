import React from 'react';

type PipeAxis = '+x' | '-x' | '+z' | '-z' | '+y' | '-y';

interface PipeOpenFlange3DProps {
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

export const PipeOpenFlange3D: React.FC<PipeOpenFlange3DProps> = ({
  position,
  axis = '+x',
  radius = 0.1,
  color = '#0ea5e9',
}) => (
  <group position={position} rotation={axisRotation[axis]}>
    {/* The route tube itself reaches this plane. The fitting contains no
        coloured pipe stub, so nothing protrudes beyond the flange face. */}
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 1.24, radius * 1.24, radius * 0.06, 32]} />
      <meshStandardMaterial color="#B7C0C8" roughness={0.38} metalness={0.7} />
    </mesh>
    <mesh position={[0, -radius * 0.038, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.62, radius * 0.7, radius * 0.018, 24]} />
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.08} />
    </mesh>
    {Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return (
        <mesh
          key={`open-flange-bolt-${i}`}
          position={[Math.cos(angle) * radius * 0.98, -radius * 0.045, Math.sin(angle) * radius * 0.98]}
          castShadow
        >
          <cylinderGeometry args={[radius * 0.048, radius * 0.048, radius * 0.018, 8]} />
          <meshStandardMaterial color="#52606B" roughness={0.34} metalness={0.82} />
        </mesh>
      );
    })}
  </group>
);
