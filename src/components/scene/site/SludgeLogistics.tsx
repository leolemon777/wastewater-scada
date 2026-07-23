import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Shared procedural woven texture. A canvas texture avoids missing asset fallbacks and
// gives the ton bags a consistent khaki polypropylene weave in every deployment.
let sharedTexture: THREE.Texture | null = null;
const textureCallbacks: ((tex: THREE.Texture) => void)[] = [];

const getSharedTexture = (callback: (tex: THREE.Texture) => void) => {
  if (sharedTexture) {
    callback(sharedTexture);
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  textureCallbacks.push(callback);
  if (textureCallbacks.length > 1) return;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#b9a27b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? 'rgba(236, 221, 189, 0.42)' : 'rgba(117, 92, 55, 0.28)';
      ctx.fillRect(0, y, canvas.width, 3);
    }
    for (let x = 0; x < canvas.width; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? 'rgba(234, 216, 178, 0.35)' : 'rgba(98, 75, 43, 0.24)';
      ctx.fillRect(x, 0, 3, canvas.height);
    }
    ctx.strokeStyle = 'rgba(255, 246, 221, 0.22)';
    ctx.lineWidth = 1;
    for (let d = -256; d < 512; d += 18) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + 256, 256);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8, 2.8);
  texture.colorSpace = THREE.SRGBColorSpace;
  sharedTexture = texture;
  while (textureCallbacks.length > 0) {
    const cb = textureCallbacks.shift();
    if (cb) cb(texture);
  }
};

interface WoodenPalletProps {
  position?: [number, number, number];
  scale?: [number, number, number] | number;
}

export const WoodenPallet: React.FC<WoodenPalletProps> = ({
  position = [0, 0, 0],
  scale = 1,
}) => {
  const color = "#b45309"; // Realistic wood brown
  const roughness = 0.92;

  // Render a detailed industrial pallet
  return (
    <group position={position} scale={scale}>
      {/* Bottom Slats */}
      <mesh position={[-0.45, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.02, 1.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.02, 1.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0.45, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.02, 1.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      
      {/* Middle stringer blocks */}
      <mesh position={[-0.45, 0.05, -0.45]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[-0.45, 0.05, 0]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[-0.45, 0.05, 0.45]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      
      <mesh position={[0, 0.05, -0.45]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.05, 0.45]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>

      <mesh position={[0.45, 0.05, -0.45]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0.45, 0.05, 0]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0.45, 0.05, 0.45]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>

      {/* Top slats */}
      <mesh position={[0, 0.09, -0.45]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.09]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.09, -0.225]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.09]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.09]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.09, 0.225]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.09]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0.09, 0.45]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.09]} />
        <meshStandardMaterial color={color} roughness={roughness} />
      </mesh>
    </group>
  );
};

interface WovenTonBagProps {
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  width?: number;
  height?: number;
  depth?: number;
  sludgeLevel?: number; // 0 to 100
  showSludge?: boolean;
}

export const WovenTonBag: React.FC<WovenTonBagProps> = ({
  position = [0, 0, 0],
  scale = 1,
  width = 0.86,
  height = 0.9,
  depth = 0.86,
  sludgeLevel = 100,
  showSludge = true,
}) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const fill = Math.max(0, Math.min(100, sludgeLevel)) / 100;

  useEffect(() => {
    getSharedTexture((tex) => setTexture(tex));
  }, []);

  // Deform a standard box geometry to look like a sagging, bulging ton bag filled with heavy sludge
  const bagGeometry = useMemo(() => {
    const geom = new THREE.BoxGeometry(width, height, depth, 12, 12, 12);
    const pos = geom.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      const y = pos.getY(i);
      let z = pos.getZ(i);
      
      const ny = y / height; // range [-0.5, 0.5]
      
      // Bulge more at the lower-middle section due to gravity
      const bulgeCenter = -0.12;
      const distFromCenter = ny - bulgeCenter;
      const bulgeFactor = Math.cos(Math.min(Math.max(distFromCenter * Math.PI * 0.95, -Math.PI/2), Math.PI/2));
      
      // Interpolate towards a cylinder to round out the corners of a box
      const radius = Math.sqrt(x * x + z * z);
      if (radius > 0.001) {
        // Blend towards a cylinder shape in the middle of the bag (ny between -0.4 and 0.4)
        const blend = Math.cos(ny * Math.PI) * 0.65; // Round the box corners by blending 65% with cylinder
        const targetRadius = (width / 2) * (1.0 + bulgeFactor * 0.18);
        const currentScale = (1.0 + bulgeFactor * 0.18) * (1.0 - blend) + (targetRadius / radius) * blend;
        
        x *= currentScale;
        z *= currentScale;
      }
      
      // Add subtle noise/jitter based on position to simulate fabric folds/creases.
      const foldNoise = Math.sin(x * 14) * Math.cos(z * 14) * Math.sin(ny * 12) * 0.012;
      x += foldNoise * (0.55 - Math.abs(ny));
      z += foldNoise * (0.55 - Math.abs(ny));
      
      // Make the bottom slightly wider (sagging onto the pallet)
      if (ny < -0.4) {
        const bottomSettle = (ny + 0.5) * 10.0; // 0 at bottom, 1 at ny = -0.4
        const factor = Math.max(0, 1.0 - bottomSettle);
        x *= (1.0 + factor * 0.06);
        z *= (1.0 + factor * 0.06);
      }
      
      // Under-filled bags sag inward near the top; full bags bulge and square out.
      const fillLine = -0.48 + fill * 0.96;
      if (ny > fillLine) {
        const loose = Math.min(1, (ny - fillLine) * 2.2);
        x *= 1 - loose * 0.12;
        z *= 1 - loose * 0.12;
      }

      pos.setXYZ(i, x, y, z);
    }
    
    geom.computeVertexNormals();
    return geom;
  }, [fill, width, height, depth]);

  const seamMaterial = texture ? (
    <meshStandardMaterial map={texture} color="#a78958" roughness={0.9} metalness={0.02} />
  ) : (
    <meshStandardMaterial color="#a78958" roughness={0.9} />
  );
  const strapMaterial = <meshStandardMaterial color="#9a7a45" roughness={0.88} metalness={0.02} />;
  const bagColor = '#c4ad82';

  return (
    <group position={position} scale={scale}>
      {/* Bag Body */}
      <mesh castShadow receiveShadow geometry={bagGeometry}>
        {texture ? (
          <meshStandardMaterial map={texture} color={bagColor} roughness={0.88} metalness={0.02} bumpMap={texture} bumpScale={0.018} />
        ) : (
          <meshStandardMaterial color={bagColor} roughness={0.9} />
        )}
      </mesh>

      {/* Reinforced stitched seams and woven bands */}
      {[-1, 1].map((side) => (
        <React.Fragment key={`side-seam-${side}`}>
          <mesh position={[side * (width / 2 + 0.008), 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.035, height * 0.92, depth * 0.88]} />
            {seamMaterial}
          </mesh>
          <mesh position={[0, 0, side * (depth / 2 + 0.008)]} castShadow receiveShadow>
            <boxGeometry args={[width * 0.88, height * 0.92, 0.035]} />
            {seamMaterial}
          </mesh>
        </React.Fragment>
      ))}
      <mesh position={[0, height * 0.08, depth / 2 + 0.018]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.92, 0.055, 0.035]} />
        {strapMaterial}
      </mesh>
      <mesh position={[0, height * 0.08, -depth / 2 - 0.018]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.92, 0.055, 0.035]} />
        {strapMaterial}
      </mesh>

      {/* Top Collar / Filling Spout */}
      <mesh position={[0, height / 2 + 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.16, 24, 2, true]} />
        {texture ? (
          <meshStandardMaterial map={texture} color={bagColor} roughness={0.9} metalness={0.02} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial color={bagColor} roughness={0.9} side={THREE.DoubleSide} />
        )}
      </mesh>
      <mesh position={[0, height / 2 + 0.145, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.22, 0.018, 8, 32]} />
        {strapMaterial}
      </mesh>

      {/* 4 woven lifting loops */}
      <group position={[0, height / 2, 0]}>
        <mesh position={[-width / 2.2, 0.04, depth / 2.2]} rotation={[0, 0, 0.12]} castShadow>
          <torusGeometry args={[0.085, 0.018, 8, 18, Math.PI]} />
          {strapMaterial}
        </mesh>
        <mesh position={[width / 2.2, 0.04, depth / 2.2]} rotation={[0, 0, -0.12]} castShadow>
          <torusGeometry args={[0.085, 0.018, 8, 18, Math.PI]} />
          {strapMaterial}
        </mesh>
        <mesh position={[-width / 2.2, 0.04, -depth / 2.2]} rotation={[0, 0, 0.12]} castShadow>
          <torusGeometry args={[0.085, 0.018, 8, 18, Math.PI]} />
          {strapMaterial}
        </mesh>
        <mesh position={[width / 2.2, 0.04, -depth / 2.2]} rotation={[0, 0, -0.12]} castShadow>
          <torusGeometry args={[0.085, 0.018, 8, 18, Math.PI]} />
          {strapMaterial}
        </mesh>
      </group>

      {/* Sludge inside the bag (growing heaping cone) */}
      {showSludge && (
        <group position={[0, height / 2 + 0.02, 0]}>
          <mesh position={[0, 0.03 + fill * 0.045, 0]} scale={[0.85 + fill * 0.35, 0.35 + fill * 0.9, 0.85 + fill * 0.35]} castShadow>
            <coneGeometry args={[0.23, 0.18, 24]} />
            <meshStandardMaterial color="#3a2416" roughness={0.99} metalness={0.01} />
          </mesh>
          <mesh position={[0, -0.01, 0]} castShadow>
            <cylinderGeometry args={[0.24 + fill * 0.07, 0.24 + fill * 0.07, 0.035, 24]} />
            <meshStandardMaterial color="#3a2416" roughness={0.99} metalness={0.01} />
          </mesh>
          {Array.from({ length: 8 }).map((_, idx) => {
            const angle = (idx / 8) * Math.PI * 2;
            const r = 0.06 + (idx % 3) * 0.045;
            return (
              <mesh key={idx} position={[Math.cos(angle) * r, 0.04 + (idx % 2) * 0.015, Math.sin(angle) * r]} rotation={[idx, angle, 0]} castShadow>
                <dodecahedronGeometry args={[0.025 + (idx % 3) * 0.006, 0]} />
                <meshStandardMaterial color="#2a170d" roughness={1} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
};
