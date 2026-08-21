import React, { useRef, useMemo } from 'react';
import { sharedCanvasTexture } from '../shared/sharedCanvasTexture';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

/** Deepest local −Z point (rear cleats). */
export const DISTRIBUTION_CABINET_BACK_OFFSET = 0.21;

interface DistributionCabinet3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  cabinetName?: string;
  targetEquipmentId?: string;
}

export const DistributionCabinet3D: React.FC<DistributionCabinet3DProps> = ({
  position,
  rotation = [0, 0, 0],
  cabinetName = '1# 泵组控制柜',
}) => {
  const lastUpdate = useRef<number>(0);
  const textRef = useRef<THREE.Mesh & { text?: string }>(null);

  // Update troika text directly — avoids React re-renders every 1.2s per cabinet.
  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastUpdate.current > 1.2) {
      lastUpdate.current = elapsed;
      const value = (378.2 + Math.random() * 4.2).toFixed(1);
      const next = `${value} V`;
      if (textRef.current) textRef.current.text = next;
    }
  });

  // Canvas texture: Warning Triangle Sign (Lightning Bolt)
  const warningTexture = useMemo(() => sharedCanvasTexture('cab.warning', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      // Yellow triangle with thick black border
      ctx.fillStyle = '#FBBF24'; // Amber yellow
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(64, 12);
      ctx.lineTo(118, 108);
      ctx.lineTo(10, 108);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Black lightning bolt
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(66, 32);
      ctx.lineTo(44, 70);
      ctx.lineTo(60, 70);
      ctx.lineTo(54, 98);
      ctx.lineTo(84, 58);
      ctx.lineTo(68, 58);
      ctx.closePath();
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }), []);

  // Canvas texture: "DANGER HIGH VOLTAGE" Warning Sign
  const dangerPlateTexture = useMemo(() => sharedCanvasTexture('cab.danger', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#EF4444'; // Alarm Red
      ctx.fillRect(0, 0, 256, 64);
      
      // Border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, 248, 56);

      // Chinese/English Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('高压危险 DANGER', 128, 20);

      ctx.font = '12px sans-serif';
      ctx.fillText('有电危险 · 禁止擅自开箱', 128, 45);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }), []);

  // Canvas texture: Cabinet Nameplate
  const nameplateTexture = useMemo(() => sharedCanvasTexture(`cab.nameplate.${cabinetName}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Silver background
      ctx.fillStyle = '#D1D5DB';
      ctx.fillRect(0, 0, 192, 48);
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, 186, 42);

      // Engraved black letters
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cabinetName, 96, 24);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }), [cabinetName]);

  // Industrial Colors — RAL 7035 light grey powder-coat (true cabinet grey,
  // not white) over a dark plinth. Matte paint: low metalness so the enclosure
  // doesn't mirror the sky and read as glossy white.
  const cabinetColor = '#C4C8C6'; // RAL 7035 light grey
  const baseColor = '#1E293B'; // Dark Slate base (gives grounding contrast)
  const metalSilver = '#B9BEC2';

  return (
    <group position={position} rotation={rotation} userData={{ bakeExclude: true }}>
      {/* Rear mounting cleats — sit on cabinet back face, do not extend past z = −0.21 */}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 0.12, -0.19]} castShadow>
          <boxGeometry args={[0.08, 0.22, 0.04]} />
          <meshStandardMaterial color={baseColor} roughness={0.55} metalness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 0.95, -0.205]} castShadow receiveShadow>
        <boxGeometry args={[0.64, 1.52, 0.012]} />
        <meshStandardMaterial color="#A8ADAF" roughness={0.62} metalness={0.18} />
      </mesh>

      {/* ================= CABINET CHASSIS ================= */}
      {/* Base Plinth (Black steel bottom segment) */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.1, 0.42]} />
        <meshStandardMaterial color={baseColor} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Solid enclosure: keep real cabinet volume while avoiding floating slab decals. */}
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 1.7, 0.42]} />
        <meshStandardMaterial color={cabinetColor} roughness={0.56} metalness={0.14} />
      </mesh>
      <mesh position={[0, 1.81, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.76, 0.055, 0.46]} />
        <meshStandardMaterial color="#D5D8D6" roughness={0.54} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.76, 0.055, 0.46]} />
        <meshStandardMaterial color="#9EA6A5" roughness={0.62} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.95, 0.219]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 1.5, 0.012]} />
        <meshStandardMaterial color={cabinetColor} roughness={0.52} metalness={0.16} />
      </mesh>

      {/* Door Seam Lines (Simulated by drawing thin black borders) */}
      <mesh position={[-0.31, 0.95, 0.226]} scale={[1, 1, 1]}>
        <boxGeometry args={[0.005, 1.66, 0.002]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[0.31, 0.95, 0.226]}>
        <boxGeometry args={[0.005, 1.66, 0.002]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[0, 1.7, 0.226]}>
        <boxGeometry args={[0.62, 0.005, 0.002]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.2, 0.226]}>
        <boxGeometry args={[0.62, 0.005, 0.002]} />
        <meshBasicMaterial color="#111" />
      </mesh>

      {/* Door Hinges (Left side) */}
      <mesh position={[-0.345, 1.4, 0.225]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.08, 8]} />
        <meshStandardMaterial color={baseColor} metalness={0.8} />
      </mesh>
      <mesh position={[-0.345, 0.5, 0.225]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.08, 8]} />
        <meshStandardMaterial color={baseColor} metalness={0.8} />
      </mesh>

      {/* ================= ELECTRICAL COMPONENTS (FRONT) ================= */}
      {/* 3-Phase Signal Lights at the top */}
      {/* Phase A (Red) */}
      <group position={[-0.18, 1.65, 0.232]}>
        {/* Light ring base */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.01, 12]} />
          <meshStandardMaterial color={baseColor} metalness={0.7} />
        </mesh>
        {/* Light bulb */}
        <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.016, 12]} />
          <meshStandardMaterial color="#EF4444" emissive="#7F1D1D" emissiveIntensity={0.35} roughness={0.35} />
        </mesh>
      </group>

      {/* Phase B (Yellow) */}
      <group position={[0, 1.65, 0.232]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.01, 12]} />
          <meshStandardMaterial color={baseColor} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.016, 12]} />
          <meshStandardMaterial color="#FBBF24" emissive="#854D0E" emissiveIntensity={0.3} roughness={0.35} />
        </mesh>
      </group>

      {/* Phase C neutral indicator */}
      <group position={[0.18, 1.65, 0.232]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.01, 12]} />
          <meshStandardMaterial color={baseColor} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.016, 12]} />
          <meshStandardMaterial color="#64748b" roughness={0.1} />
        </mesh>
      </group>

      {/* Voltmeter Screen Frame (Bezel) */}
      <mesh position={[0, 1.48, 0.232]} castShadow>
        <boxGeometry args={[0.26, 0.12, 0.01]} />
        <meshStandardMaterial color={baseColor} roughness={0.8} />
      </mesh>
      {/* Voltmeter Screen Glass */}
      <mesh position={[0, 1.48, 0.238]}>
        <boxGeometry args={[0.22, 0.08, 0.002]} />
        <meshStandardMaterial color="#111" roughness={0.1} />
      </mesh>
      {/* Emissive Digital Voltmeter Text (changed to neutral to reduce green) */}
      <Text
        ref={textRef}
        position={[0, 1.48, 0.24]}
        fontSize={0.042}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        characters="0123456789. V"
      >
        380.2 V
      </Text>

      {/* Cabinet Engraved Nameplate (Decal Plane) */}
      <mesh position={[0, 1.32, 0.235]} castShadow>
        <planeGeometry args={[0.3, 0.075]} />
        <meshStandardMaterial map={nameplateTexture} roughness={0.4} />
      </mesh>

      {/* Yellow Triangle High Voltage Decal Sticker */}
      <mesh position={[0, 0.95, 0.235]} castShadow>
        <planeGeometry args={[0.22, 0.22]} />
        <meshStandardMaterial map={warningTexture} transparent roughness={0.5} />
      </mesh>

      {/* Red/White Warning Danger Plate Decal */}
      <mesh position={[0, 0.72, 0.235]} castShadow>
        <planeGeometry args={[0.42, 0.105]} />
        <meshStandardMaterial map={dangerPlateTexture} roughness={0.5} />
      </mesh>

      {/* E-Stop Emergency Button (Red mushroom on yellow circular backplate) */}
      <group position={[-0.2, 0.48, 0.232]}>
        {/* Yellow round backing plate */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.046, 0.046, 0.005, 16]} />
          <meshStandardMaterial color="#FBBF24" roughness={0.4} />
        </mesh>
        {/* Black collar */}
        <mesh position={[0, 0, 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
          <meshStandardMaterial color={baseColor} metalness={0.7} />
        </mesh>
        {/* Red plunger */}
        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.024, 16]} />
          <meshStandardMaterial color="#EF4444" roughness={0.3} />
        </mesh>
      </group>

      {/* Door Handle Latch (Silver lock with keyhole detail) */}
      <group position={[0.22, 0.95, 0.232]}>
        {/* Backplate */}
        <mesh castShadow>
          <boxGeometry args={[0.035, 0.12, 0.005]} />
          <meshStandardMaterial color={metalSilver} metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Lever Handle */}
        <mesh position={[0, 0, 0.02]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.09, 8]} />
          <meshStandardMaterial color={metalSilver} metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0.04, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.025, 8]} />
          <meshStandardMaterial color={metalSilver} metalness={0.9} />
        </mesh>
      </group>

      {/* Cable conduit — routed forward, not into the wall */}
      <group position={[0.16, 0.05, 0.08]}>
        <mesh rotation={[0.1, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
          <meshStandardMaterial color="#374151" roughness={0.65} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.038, 0.038, 0.03, 6]} />
          <meshStandardMaterial color="#9CA3AF" metalness={0.8} />
        </mesh>
      </group>
      <group position={[-0.16, 0.05, 0.08]}>
        <mesh rotation={[-0.05, 0, -0.12]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#374151" roughness={0.65} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.03, 6]} />
          <meshStandardMaterial color="#9CA3AF" metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
};
