import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sparkles } from '@react-three/drei';

interface OverflowCascadeProps {
  position: [number, number, number];
  width: number; // width of the water flow (depth of the tank)
  dropHeight: number; // thickness of the water block
  colorHex?: string;
  isAlarm?: boolean;
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export const OverflowCascade3D: React.FC<OverflowCascadeProps> = ({
  position,
  width,
  dropHeight,
  colorHex = '#4a7d88',
  isAlarm = false,
}) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Generate a scrolling water texture
  const waterTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 64, 256);

      for (let i = 0; i < 40; i++) {
        const x = seededUnit(i, 1) * 64;
        const y = seededUnit(i, 2) * 256;
        const w = 1 + seededUnit(i, 3) * 2;
        const h = 10 + seededUnit(i, 4) * 50;
        const alpha = 0.1 + seededUnit(i, 5) * 0.3;
        ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
        ctx.fillRect(x, y, w, h);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.map!.offset.x = -(state.clock.elapsedTime * 0.5) % 1;
    }
  });

  const materialColor = isAlarm ? '#dc2626' : colorHex;

  return (
    <group position={position}>
      {/* Waterfall block bridging the two tanks */}
      <mesh receiveShadow>
        {/* x=0.6 (gap width), y=dropHeight (thickness), z=width (tank depth) */}
        <boxGeometry args={[0.6, dropHeight, width]} />
        <meshStandardMaterial
          ref={materialRef}
          color={materialColor}
          transparent
          opacity={0.85}
          roughness={0.1}
          metalness={0.1}
          map={waterTexture}
        />
      </mesh>

      {/* Splash effect over the weir */}
      <Sparkles
          count={15}
          scale={[0.6, dropHeight * 2, width - 0.5]}
          size={1.5}
          speed={1.0}
          position={[0, dropHeight / 2 + 0.1, 0]}
          color="#ffffff"
          opacity={0.5}
      />
    </group>
  );
};
