import React, { useMemo } from 'react';

interface PipeWallPort3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
  color?: string;
}

/**
 * Wall penetration sleeve + bolted flange.
 *
 * Local +Y is the "outward" face (away from tank interior for the standard
 * wall rotations). Solid hubs on BOTH faces close the bore so neither the
 * pump-bay side nor the basin side reads as a hollow cut green pipe.
 */
export const PipeWallPort3D: React.FC<PipeWallPort3DProps> = ({
  position,
  rotation = [Math.PI / 2, 0, 0],
  radius = 0.12,
  color = '#4ADE80',
}) => {
  const bolts = useMemo(() => {
    const numBolts = 8;
    const boltRadius = radius * 1.48;
    const arr: [number, number, number][] = [];
    for (let i = 0; i < numBolts; i++) {
      const angle = (i / numBolts) * Math.PI * 2;
      // Bolts on the exterior flange face (local +Y).
      arr.push([Math.cos(angle) * boltRadius, radius * 0.08, Math.sin(angle) * boltRadius]);
    }
    return arr;
  }, [radius]);

  const stopPortPointer = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  const sleeveLen = Math.max(radius * 0.7, 0.08);
  const hubT = Math.max(radius * 0.14, 0.014);
  const flangeT = Math.max(radius * 0.08, 0.012);

  return (
    <group position={position} rotation={rotation} onClick={stopPortPointer} onPointerDown={stopPortPointer}>
      {/* Concrete-embedded sleeve (centred on the wall face) */}
      <mesh castShadow receiveShadow onClick={stopPortPointer} onPointerDown={stopPortPointer}>
        <cylinderGeometry args={[radius * 1.12, radius * 1.12, sleeveLen, 28]} />
        <meshStandardMaterial color="#6B7684" roughness={0.74} metalness={0.16} />
      </mesh>

      {/* Exterior solid hub — faces the pump bay / corridor; seals end-on views */}
      <mesh position={[0, sleeveLen * 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.02, radius * 1.02, hubT, 28]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
      </mesh>
      {/* Exterior bolted flange */}
      <mesh position={[0, sleeveLen * 0.28 + flangeT * 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.55, radius * 1.55, flangeT, 32]} />
        <meshStandardMaterial color="#B6C2CC" roughness={0.42} metalness={0.62} />
      </mesh>
      {/* Exterior gasket ring */}
      <mesh position={[0, sleeveLen * 0.28 + flangeT * 1.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.18, radius * 1.18, radius * 0.02, 24]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>

      {/* Interior solid hub — faces the basin; no hollow green tunnel into the pool */}
      <mesh position={[0, -sleeveLen * 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.02, radius * 1.02, hubT, 28]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
      </mesh>

      {bolts.map((pos, i) => (
        <mesh key={i} position={pos} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.1, radius * 0.1, radius * 0.05, 6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
};
