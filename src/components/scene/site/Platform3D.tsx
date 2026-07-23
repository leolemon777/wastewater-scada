import React from 'react';
import { Materials } from '../shared/Materials';

interface PlatformProps {
  position: [number, number, number];
  size: [number, number, number]; // width, height (thickness), depth
  label?: string;
  showRailings?: boolean;
}

const RailTube: React.FC<{
  position: [number, number, number];
  length: number;
  axis: 'x' | 'z';
  radius?: number;
}> = ({ position, length, axis, radius = 0.025 }) => (
  <mesh
    material={Materials.safetyGuard}
    castShadow
    receiveShadow
    position={position}
    rotation={axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}
  >
    <cylinderGeometry args={[radius, radius, length, 12]} />
  </mesh>
);

const RailPost: React.FC<{ position: [number, number, number]; height: number }> = ({ position, height }) => (
  <group>
    <mesh material={Materials.castIron} castShadow receiveShadow position={[position[0], position[1] - height / 2 + 0.018, position[2]]}>
      <boxGeometry args={[0.22, 0.035, 0.22]} />
    </mesh>
    <mesh material={Materials.safetyGuard} castShadow receiveShadow position={position}>
      <cylinderGeometry args={[0.032, 0.032, height, 10]} />
    </mesh>
  </group>
);

export const Platform3D: React.FC<PlatformProps> = ({ position, size, label, showRailings = true }) => {
  const [w, h, d] = size;
  const railBaseY = h + 0.05;
  const railHeight = 0.86;
  const topY = railBaseY + railHeight;
  const midY = railBaseY + railHeight * 0.52;
  const zFront = d / 2 - 0.16;
  const zBack = -d / 2 + 0.16;
  const xRight = w / 2 - 0.16;
  const xLeft = -w / 2 + 0.16;
  const postTopY = railBaseY + railHeight / 2;
  const postPoints: [number, number][] = [
    [xLeft, zBack],
    [xRight, zBack],
    [xRight, zFront],
    [xLeft, zFront],
  ];
  const xPostCount = Math.max(2, Math.floor(w / 4));
  const zPostCount = Math.max(2, Math.floor(d / 4));
  const jointCount = Math.max(2, Math.floor(w / 8));

  for (let i = 1; i < xPostCount; i++) {
    const x = xLeft + ((xRight - xLeft) * i) / xPostCount;
    postPoints.push([x, zBack], [x, zFront]);
  }

  for (let i = 1; i < zPostCount; i++) {
    const z = zBack + ((zFront - zBack) * i) / zPostCount;
    postPoints.push([xLeft, z], [xRight, z]);
  }

  return (
    <group position={position}>
      {/* Concrete Base */}
      <mesh material={Materials.concrete} receiveShadow castShadow position={[0, h/2, 0]}>
        <boxGeometry args={[w, h, d]} />
      </mesh>

      {/* Poured-concrete platform edge detail: coping lip, darker side wash, and slab joints. */}
      <mesh castShadow receiveShadow position={[0, h + 0.035, d / 2 - 0.08]}>
        <boxGeometry args={[w, 0.07, 0.16]} />
        <meshStandardMaterial color="#A9ADA8" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, h + 0.035, -d / 2 + 0.08]}>
        <boxGeometry args={[w, 0.07, 0.16]} />
        <meshStandardMaterial color="#A9ADA8" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh castShadow receiveShadow position={[w / 2 - 0.08, h + 0.035, 0]}>
        <boxGeometry args={[0.16, 0.07, d]} />
        <meshStandardMaterial color="#A9ADA8" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh castShadow receiveShadow position={[-w / 2 + 0.08, h + 0.035, 0]}>
        <boxGeometry args={[0.16, 0.07, d]} />
        <meshStandardMaterial color="#A9ADA8" roughness={0.86} metalness={0.02} />
      </mesh>

      {Array.from({ length: jointCount }).map((_, i) => {
        const x = -w / 2 + ((i + 1) * w) / (jointCount + 1);
        return (
          <mesh key={`platform-joint-${i}`} position={[x, h + 0.073, 0]} receiveShadow>
            <boxGeometry args={[0.026, 0.01, Math.max(0.2, d - 0.45)]} />
            <meshBasicMaterial color="#5F6764" transparent opacity={0.34} />
          </mesh>
        );
      })}
      
      {/* Label on the floor (optional, diegetic) */}
      {label && (
        <mesh position={[0, h + 0.01, d / 2 + 1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, 2]} />
          <meshBasicMaterial color="#161920" transparent opacity={0.5} />
          {/* Note: In a real app we'd use Text from drei to render the label on the floor */}
        </mesh>
      )}
      
      {/* Industrial safety railings: yellow tube posts with top and middle rails. */}
      {showRailings && (
        <>
          {postPoints.map(([x, z], index) => (
            <RailPost key={`platform-post-${index}`} position={[x, postTopY, z]} height={railHeight} />
          ))}

          {[topY, midY].map((y) => (
            <React.Fragment key={`platform-rails-${y}`}>
              <RailTube position={[0, y, zFront]} length={w - 0.32} axis="x" radius={y === topY ? 0.03 : 0.024} />
              <RailTube position={[0, y, zBack]} length={w - 0.32} axis="x" radius={y === topY ? 0.03 : 0.024} />
              <RailTube position={[xRight, y, 0]} length={d - 0.32} axis="z" radius={y === topY ? 0.03 : 0.024} />
              <RailTube position={[xLeft, y, 0]} length={d - 0.32} axis="z" radius={y === topY ? 0.03 : 0.024} />
            </React.Fragment>
          ))}
        </>
      )}
    </group>
  );
};
