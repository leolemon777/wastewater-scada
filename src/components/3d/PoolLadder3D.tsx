import React, { useMemo } from 'react';
import * as THREE from 'three';

/** Which outer wall the ladder mounts on (tank-local coordinates). */
export type PoolLadderWall = 'front' | 'back' | 'left' | 'right';

export interface PoolLadder3DProps {
  poolWidth: number;
  poolHeight: number;
  poolDepth: number;
  wallThickness?: number;
  wall: PoolLadderWall;
  /** Lateral placement along the wall, roughly −0.85…0.85 (0 = centred). */
  lateral?: number;
  /** Compact dosing-tank ladder. */
  variant?: 'standard' | 'compact';
}

const RAIL = new THREE.MeshStandardMaterial({
  color: '#B8C2CC',
  roughness: 0.36,
  metalness: 0.74,
});

const RUNG = new THREE.MeshStandardMaterial({
  color: '#9DAAB4',
  roughness: 0.4,
  metalness: 0.7,
});

const SAFETY = new THREE.MeshStandardMaterial({
  color: '#EAB308',
  roughness: 0.45,
  metalness: 0.25,
});

const STILE_R = 0.022;
const RUNG_R = 0.016;
const LADDER_W = 0.38;

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Pick a wall that is not blocked by overflow weirs. */
export function pickLadderWall(
  id: string,
  overflowLeft = false,
  overflowRight = false,
): PoolLadderWall {
  const candidates: PoolLadderWall[] = [];
  if (!overflowLeft) candidates.push('left');
  if (!overflowRight) candidates.push('right');
  candidates.push('front', 'back');
  const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return candidates[Math.floor(seededUnit(seed * 2.17) * candidates.length)] ?? 'front';
}

export function pickLadderLateral(id: string): number {
  const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return -0.55 + seededUnit(seed * 4.83) * 1.1;
}

function mountOnWall(
  w: number,
  d: number,
  t: number,
  wall: PoolLadderWall,
  lateral: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  const xSpan = w / 2 - t - 0.5;
  const zSpan = d / 2 - t - 0.5;
  switch (wall) {
    case 'front':
      return { position: [lateral * xSpan, 0, d / 2 + 0.042], rotation: [0, 0, 0] };
    case 'back':
      return { position: [lateral * xSpan, 0, -d / 2 - 0.042], rotation: [0, Math.PI, 0] };
    case 'left':
      return { position: [-w / 2 - 0.042, 0, lateral * zSpan], rotation: [0, -Math.PI / 2, 0] };
    case 'right':
      return { position: [w / 2 + 0.042, 0, lateral * zSpan], rotation: [0, Math.PI / 2, 0] };
  }
}

/**
 * Fixed stainless pool-access ladder — vertical stiles, anti-slip rungs, coping
 * hooks, and a short top guard rail for maintenance access.
 */
export const PoolLadder3D: React.FC<PoolLadder3DProps> = ({
  poolWidth: w,
  poolHeight: h,
  poolDepth: d,
  wallThickness: t = 0.3,
  wall,
  lateral = 0,
  variant = 'standard',
}) => {
  const compact = variant === 'compact';
  const bottomY = -h / 2 - (compact ? 0.12 : 0.3);
  const topY = h / 2 + (compact ? 0.08 : 0.18);
  const ladderH = topY - bottomY;
  const rungCount = compact ? 4 : Math.max(5, Math.round(ladderH / 0.28));
  const halfW = LADDER_W / 2;

  const mount = useMemo(() => mountOnWall(w, d, t, wall, lateral), [w, d, t, wall, lateral]);

  const rungYs = useMemo(() => {
    const ys: number[] = [];
    for (let i = 0; i < rungCount; i++) {
      const tNorm = (i + 1) / (rungCount + 1);
      ys.push(bottomY + tNorm * ladderH);
    }
    return ys;
  }, [bottomY, ladderH, rungCount]);

  return (
    <group position={mount.position} rotation={mount.rotation}>
      {/* Vertical stiles */}
      {([-halfW, halfW] as const).map((x) => (
        <mesh key={`stile-${x}`} position={[x, (bottomY + topY) / 2, 0]} castShadow>
          <cylinderGeometry args={[STILE_R, STILE_R, ladderH + 0.06, 10]} />
          <primitive object={RAIL} attach="material" />
        </mesh>
      ))}

      {/* Rungs */}
      {rungYs.map((y, i) => (
        <mesh key={`rung-${i}`} position={[0, y, 0.012]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[RUNG_R, RUNG_R, LADDER_W, 10]} />
          <primitive object={i === rungCount - 1 ? SAFETY : RUNG} attach="material" />
        </mesh>
      ))}

      {/* Coping hooks — rest on pool edge */}
      {([-halfW, halfW] as const).map((x) => (
        <group key={`hook-${x}`} position={[x, topY + 0.02, -0.04]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[STILE_R, STILE_R, 0.1, 8]} />
            <primitive object={RAIL} attach="material" />
          </mesh>
          <mesh position={[0, 0.02, -0.06]} castShadow>
            <boxGeometry args={[STILE_R * 2.4, 0.028, 0.1]} />
            <primitive object={RAIL} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Top grab rail + short fall-arrest cage */}
      <mesh position={[0, topY + 0.22, -0.06]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[STILE_R * 1.1, STILE_R * 1.1, LADDER_W + 0.06, 10]} />
        <primitive object={RAIL} attach="material" />
      </mesh>
      {([-halfW, halfW] as const).map((x) => (
        <mesh key={`cage-${x}`} position={[x, topY + 0.12, -0.1]} castShadow>
          <boxGeometry args={[STILE_R * 2, 0.22, STILE_R * 2]} />
          <primitive object={RAIL} attach="material" />
        </mesh>
      ))}

      {/* Base spreader / floor anchor plate */}
      <mesh position={[0, bottomY + 0.015, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[LADDER_W + 0.08, 0.028, 0.14]} />
        <meshStandardMaterial color="#8E979E" roughness={0.55} metalness={0.62} />
      </mesh>
    </group>
  );
};

/** Cylindrical chemical tank — ladder on the +Z face of the bounding square. */
export const CylindricalTankLadder3D: React.FC<{
  radius: number;
  height: number;
  id: string;
}> = ({ radius, height, id }) => (
  <PoolLadder3D
    poolWidth={radius * 2.2}
    poolHeight={height}
    poolDepth={radius * 2.2}
    wallThickness={0.08}
    wall="front"
    lateral={pickLadderLateral(id) * 0.35}
    variant="compact"
  />
);
