import React, { useMemo } from 'react';
import * as THREE from 'three';
import { type CardinalWall, wallMountAtBackPlane, WALL_MOUNT_STANDOFF } from './wallPlacement';

interface FireExtinguisher3DProps {
  floorTopY: number;
  wall: CardinalWall;
  /** Position along the wall (X for N/S, Z for E/W). */
  along: number;
  /** Room-side wall plane coordinate. */
  wallInner: number;
  /** Clear gap between wall inner face and bracket back (metres). */
  standoff?: number;
}

/** All geometry lives at local Z >= Z_MIN so nothing protrudes toward the wall. */
const Z_MIN = 0.04;

/**
 * Realistic wall-mounted dry powder extinguisher.
 * Local +Z points into the room; bracket back face sits at Z = Z_MIN.
 */
export const FireExtinguisher3D: React.FC<FireExtinguisher3DProps> = ({
  floorTopY,
  wall,
  along,
  wallInner,
  standoff = WALL_MOUNT_STANDOFF,
}) => {
  const { position, rotationY } = wallMountAtBackPlane({
    wall,
    floorTopY,
    along,
    wallInner,
    standoff,
  });

  const labelTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, 256, 160);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(0, 0, 256, 34);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FIRE', 128, 17);

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ABC', 128, 68);
      ctx.font = '18px sans-serif';
      ctx.fillText('DRY POWDER', 128, 98);
      ctx.fillStyle = '#374151';
      ctx.font = '15px sans-serif';
      ctx.fillText('干粉灭火器 4kg', 128, 126);

      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 5;
      ctx.strokeRect(5, 5, 246, 150);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const hoseCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.035, 0.78, Z_MIN + 0.13),
    new THREE.Vector3(0.125, 0.74, Z_MIN + 0.2),
    new THREE.Vector3(0.145, 0.57, Z_MIN + 0.2),
    new THREE.Vector3(0.105, 0.44, Z_MIN + 0.17),
  ]), []);

  const bodyRed = '#B91C1C';
  const bodyDarkRed = '#7F1D1D';
  const metal = '#C4CDD5';
  const darkMetal = '#334155';
  const blackRubber = '#111827';
  const bracket = '#6B7280';

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Wall bracket back plate */}
      <mesh position={[0, 0.48, Z_MIN + 0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.23, 0.74, 0.035]} />
        <meshStandardMaterial color={bracket} roughness={0.58} metalness={0.45} />
      </mesh>

      {/* Top and bottom wall hook saddles */}
      {[0.27, 0.66].map((y) => (
        <mesh key={`saddle-${y}`} position={[0, y, Z_MIN + 0.085]} castShadow receiveShadow>
          <boxGeometry args={[0.25, 0.035, 0.11]} />
          <meshStandardMaterial color={bracket} roughness={0.46} metalness={0.52} />
        </mesh>
      ))}

      {/* Lower rubber foot boot */}
      <mesh position={[0, 0.085, Z_MIN + 0.155]} castShadow receiveShadow>
        <cylinderGeometry args={[0.116, 0.122, 0.085, 32]} />
        <meshStandardMaterial color={blackRubber} roughness={0.88} metalness={0.03} />
      </mesh>

      {/* Main pressure cylinder */}
      <mesh position={[0, 0.405, Z_MIN + 0.155]} castShadow receiveShadow>
        <cylinderGeometry args={[0.108, 0.116, 0.61, 36]} />
        <meshPhysicalMaterial color={bodyRed} roughness={0.42} metalness={0.08} clearcoat={0.26} clearcoatRoughness={0.42} />
      </mesh>

      {/* Rounded shoulder + bottom crown */}
      <mesh position={[0, 0.72, Z_MIN + 0.155]} castShadow receiveShadow>
        <sphereGeometry args={[0.108, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={bodyRed} roughness={0.42} metalness={0.08} clearcoat={0.26} clearcoatRoughness={0.42} />
      </mesh>
      <mesh position={[0, 0.105, Z_MIN + 0.155]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.104, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={bodyDarkRed} roughness={0.48} metalness={0.08} clearcoat={0.16} clearcoatRoughness={0.55} />
      </mesh>

      {/* Neck, valve block and lever handle */}
      <mesh position={[0, 0.79, Z_MIN + 0.155]} castShadow receiveShadow>
        <cylinderGeometry args={[0.035, 0.042, 0.075, 16]} />
        <meshStandardMaterial color={metal} roughness={0.32} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.842, Z_MIN + 0.155]} castShadow receiveShadow>
        <boxGeometry args={[0.135, 0.045, 0.07]} />
        <meshStandardMaterial color={darkMetal} roughness={0.34} metalness={0.68} />
      </mesh>
      <mesh position={[-0.07, 0.875, Z_MIN + 0.155]} rotation={[0, 0, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.145, 0.018, 0.026]} />
        <meshStandardMaterial color={metal} roughness={0.3} metalness={0.78} />
      </mesh>
      <mesh position={[0.058, 0.872, Z_MIN + 0.155]} rotation={[0, 0, -0.28]} castShadow receiveShadow>
        <boxGeometry args={[0.115, 0.016, 0.024]} />
        <meshStandardMaterial color={metal} roughness={0.3} metalness={0.78} />
      </mesh>

      {/* Safety pin, ring and yellow tamper tag */}
      <mesh position={[0.07, 0.835, Z_MIN + 0.195]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.018, 0.0035, 8, 20]} />
        <meshStandardMaterial color={metal} metalness={0.82} roughness={0.24} />
      </mesh>
      <mesh position={[0.041, 0.833, Z_MIN + 0.18]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.085, 8]} />
        <meshStandardMaterial color={metal} metalness={0.82} roughness={0.24} />
      </mesh>
      <mesh position={[0.074, 0.772, Z_MIN + 0.205]} rotation={[0.18, 0, -0.1]} castShadow>
        <boxGeometry args={[0.025, 0.072, 0.008]} />
        <meshStandardMaterial color="#FACC15" roughness={0.52} metalness={0.03} />
      </mesh>

      {/* Pressure gauge */}
      <group position={[-0.065, 0.83, Z_MIN + 0.21]} rotation={[Math.PI / 2.6, 0, -0.12]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.033, 0.033, 0.012, 24]} />
          <meshStandardMaterial color={metal} roughness={0.25} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0, 0.0075]}>
          <cylinderGeometry args={[0.026, 0.026, 0.004, 24]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh position={[0.008, 0, 0.011]} rotation={[0, 0, -0.65]}>
          <boxGeometry args={[0.021, 0.003, 0.002]} />
          <meshStandardMaterial color="#16A34A" roughness={0.45} />
        </mesh>
      </group>

      {/* Front label */}
      <mesh position={[0, 0.43, Z_MIN + 0.266]}>
        <planeGeometry args={[0.145, 0.255]} />
        <meshStandardMaterial map={labelTexture} roughness={0.62} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>

      {/* Retaining steel straps around the bottle */}
      {[0.305, 0.565].map((y) => (
        <mesh key={`strap-${y}`} position={[0, y, Z_MIN + 0.155]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.119, 0.006, 8, 32]} />
          <meshStandardMaterial color={darkMetal} roughness={0.36} metalness={0.72} />
        </mesh>
      ))}

      {/* Black discharge hose and nozzle */}
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[hoseCurve, 24, 0.0085, 8, false]} />
        <meshStandardMaterial color={blackRubber} roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[0.105, 0.435, Z_MIN + 0.17]} rotation={[0.55, 0, -0.25]} castShadow receiveShadow>
        <cylinderGeometry args={[0.012, 0.018, 0.09, 12]} />
        <meshStandardMaterial color={blackRubber} roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0.095, 0.39, Z_MIN + 0.195]} rotation={[0.55, 0, -0.25]} castShadow receiveShadow>
        <coneGeometry args={[0.019, 0.052, 12]} />
        <meshStandardMaterial color={darkMetal} roughness={0.46} metalness={0.55} />
      </mesh>
    </group>
  );
};
