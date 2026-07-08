import React, { useMemo } from 'react';

interface PipeWallPort3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
  color?: string;
}

export const PipeWallPort3D: React.FC<PipeWallPort3DProps> = ({
  position,
  rotation = [Math.PI / 2, 0, 0],
  radius = 0.12,
  color = '#0ea5e9',
}) => {
  // Generate bolt positions around the flange
  const bolts = useMemo(() => {
    const numBolts = 8;
    const boltRadius = radius * 1.5;
    const arr = [];
    for (let i = 0; i < numBolts; i++) {
      const angle = (i / numBolts) * Math.PI * 2;
      arr.push([Math.cos(angle) * boltRadius, radius * 0.05, Math.sin(angle) * boltRadius] as [number, number, number]);
    }
    return arr;
  }, [radius]);

  return (
    <group position={position} rotation={rotation}>
      {/* Wall Sleeve (embeds into the concrete) */}
      <mesh position={[0, -radius * 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.24, radius * 1.24, radius * 0.06, 32]} />
        <meshStandardMaterial color="#8B98A9" roughness={0.7} metalness={0.2} />
      </mesh>
      
      {/* Metal Flange Base */}
      <mesh position={[0, radius * 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.2, radius * 1.2, radius * 0.04, 32]} />
        <meshStandardMaterial color="#B6C2CC" roughness={0.42} metalness={0.62} />
      </mesh>
      
      {/* Rubber Gasket / Seal */}
      <mesh position={[0, radius * 0.045, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.1, radius * 1.1, radius * 0.01, 24]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>

      {/* Pipe Stub (colored) */}
      <mesh position={[0, radius * 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.98, radius * 0.98, radius * 0.08, 24]} />
        <meshStandardMaterial color={color} roughness={0.56} metalness={0.04} />
      </mesh>

      {/* Bolts */}
      {bolts.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[radius * 0.15, radius * 0.15, radius * 0.06, 6]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
