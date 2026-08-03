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

const stopFlangePointer = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
};

/**
 * Pipe-side mating flange at a pump sealing face.
 *
 * Closed bolted face when viewed end-on — solid hub fills the bore so the
 * joint never reads as a hollow green cut-off.
 */
export const PipeOpenFlange3D: React.FC<PipeOpenFlange3DProps> = ({
  position,
  axis = '+x',
  radius = 0.1,
  color = '#4ADE80',
}) => {
  const hubT = Math.max(radius * 0.18, 0.016);
  const flangeT = Math.max(radius * 0.1, 0.012);

  return (
    <group
      position={position}
      rotation={axisRotation[axis]}
      onClick={stopFlangePointer}
      onPointerDown={stopFlangePointer}
    >
      {/* Solid hub fills bore (pipe colour) */}
      <mesh
        position={[0, 0, 0]}
        castShadow
        receiveShadow
        onClick={stopFlangePointer}
        onPointerDown={stopFlangePointer}
      >
        <cylinderGeometry args={[radius * 1.04, radius * 1.04, hubT, 32]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
      </mesh>
      {/* Outer bolted flange ring */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.32, radius * 1.32, flangeT, 32]} />
        <meshStandardMaterial color="#B7C0C8" roughness={0.38} metalness={0.7} />
      </mesh>
      {/* Pump-facing gasket */}
      <mesh position={[0, -hubT * 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.15, radius * 1.15, radius * 0.022, 28]} />
        <meshStandardMaterial color="#1F2933" roughness={0.72} metalness={0.08} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={`open-flange-bolt-${i}`}
            position={[Math.cos(angle) * radius * 1.12, 0, Math.sin(angle) * radius * 1.12]}
            castShadow
          >
            <cylinderGeometry args={[radius * 0.05, radius * 0.05, flangeT * 1.1, 8]} />
            <meshStandardMaterial color="#52606B" roughness={0.34} metalness={0.82} />
          </mesh>
        );
      })}
    </group>
  );
};
