import React from 'react';

interface PipeFloorSleeve3DProps {
  position: [number, number, number];
  radius?: number;
  color?: string;
}

export const PipeFloorSleeve3D: React.FC<PipeFloorSleeve3DProps> = ({
  position,
  radius = 0.1,
  color = '#0ea5e9',
}) => (
  <group position={position}>
    <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 1.18, radius * 1.18, radius * 0.034, 32]} />
      <meshStandardMaterial color="#9AA7B2" roughness={0.44} metalness={0.58} />
    </mesh>
    <mesh position={[0, 0.029, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.96, radius * 0.96, radius * 0.048, 24]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
    </mesh>
    {Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return (
        <mesh key={`floor-sleeve-bolt-${i}`} position={[Math.cos(angle) * radius * 0.94, 0.038, Math.sin(angle) * radius * 0.94]} castShadow>
          <cylinderGeometry args={[radius * 0.042, radius * 0.042, radius * 0.012, 8]} />
          <meshStandardMaterial color="#5B6670" roughness={0.36} metalness={0.8} />
        </mesh>
      );
    })}
  </group>
);
