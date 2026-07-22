import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, Instances, Instance } from '@react-three/drei';
import { FloatingPoolLabel3D } from '../shared/FloatingPoolLabel3D';
import * as THREE from 'three';
import { type TankData, useScadaStore } from '../../../store/useScadaStore';
import { Materials } from '../shared/Materials';
import { WaterShader, updateWaterLighting } from '../shared/WaterShader';
import { MixerDrive3D } from './MixerDrive3D';
import { PoolLadder3D } from '../site/PoolLadder3D';
import { pickLadderLateral, pickLadderWall } from '../site/poolLadderPlacement';

/**
 * Instanced railing kit — collapses the dozens of identical post / base / bar
 * meshes a single tank generates into a handful of InstancedMesh draw calls.
 *
 * Each Tank3D still builds its own instance set (so geometry matches its
 * dimensions), but instead of N <mesh> elements the set renders as ONE draw
 * call per geometry/material pair. With ~30 tanks this drops railing draw calls
 * from ~1500 to ~30.
 *
 * Instances use safetyGuard (yellow) for bars/posts and castIron for bases,
 * matching the original material assignments.
 */

interface InstanceXform {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

const InstancedCylinder: React.FC<{
  args: [number, number, number, number];
  material: THREE.Material;
  instances: InstanceXform[];
}> = ({ args, material, instances }) => (
  <Instances limit={instances.length} castShadow>
    <cylinderGeometry args={args} />
    <primitive object={material} attach="material" />
    {instances.map((x, i) => (
      <Instance key={i} position={x.position} rotation={x.rotation} scale={x.scale} />
    ))}
  </Instances>
);

const InstancedBox: React.FC<{
  args: [number, number, number];
  material: THREE.Material;
  instances: InstanceXform[];
}> = ({ args, material, instances }) => (
  <Instances limit={instances.length} castShadow>
    <boxGeometry args={args} />
    <primitive object={material} attach="material" />
    {instances.map((x, i) => (
      <Instance key={i} position={x.position} rotation={x.rotation} scale={x.scale} />
    ))}
  </Instances>
);

// Shared material for the instanced catwalk grating bars (defined once so every
// tank's bars render against the same material instance).
const gratingBarMaterial = new THREE.MeshStandardMaterial({ color: '#7F8D9B', roughness: 0.52, metalness: 0.58 });

/**
 * Build a pool-coping BoxGeometry with a VERTEX-COLOUR water-stain ring baked
 * in. The coping's top edge (where splash/overflow accumulates) is darkened to
 * a damp-stain colour and the colour fades back to the coping's dry concrete
 * shade further down — implemented purely as a per-vertex colour attribute so
 * the stain reads through a single vertex-coloured material (no extra mesh,
 * no separate stain material). This satisfies the spec's "顶点色实现" requirement.
 *
 * The stain is driven by each vertex's LOCAL y position (top vertices darkest),
 * so the same builder works for every coping box regardless of its dimensions.
 */
const COPING_DRY = new THREE.Color('#9CA4AD');
const COPING_STAIN = new THREE.Color('#606B66');
function makeStainedCopingGeometry(size: [number, number, number]): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const halfH = size[1] / 2;
  for (let i = 0; i < pos.count; i++) {
    const ny = THREE.MathUtils.clamp((pos.getY(i) + halfH) / (2 * halfH || 1), 0, 1);
    // stain strength: 0 at the bottom, ~0.85 at the top (downward falloff)
    const s = ny * ny * 0.85;
    colors[i * 3] = COPING_DRY.r + (COPING_STAIN.r - COPING_DRY.r) * s;
    colors[i * 3 + 1] = COPING_DRY.g + (COPING_STAIN.g - COPING_DRY.g) * s;
    colors[i * 3 + 2] = COPING_DRY.b + (COPING_STAIN.b - COPING_DRY.b) * s;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
// One shared vertex-coloured material for every stained coping piece.
const copingStainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 });

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const getWastewaterColor = (id: string, isAlarm: boolean) => {
  if (isAlarm) {
    return {
      color: "#dc2626", // Red for alarms
      emissive: "#b91c1c",
      opacity: 0.75,
      roughness: 0.2
    };
  }

  switch (id) {
    // 1. Raw Sewage — deepest turbid brown (start of process, most opaque)
    case 'tk-collection-1':
    case 'tk-collection-2':
      return {
        color: '#5a4936', // 曝气/原水 深褐
        emissive: '#332619',
        opacity: 0.88,
        roughness: 0.65
      };

    // 2. Fenton Reaction & pH1 (rusty brown from iron catalysts, slightly lighter)
    case 'tk-ph1':
    case 'tk-fenton':
      return {
        color: '#63462f',
        emissive: '#3A2718',
        opacity: 0.84,
        roughness: 0.55
      };

    // 3. Coagulation & Flocculation & pH2 (muddy brown full of sludge flocs)
    case 'tk-ph2':
    case 'tk-coagulation':
    case 'tk-flocculation':
      return {
        color: '#5d4a39',
        emissive: '#37291D',
        opacity: 0.88,
        roughness: 0.7
      };

    // 4. Clarifier — 墨绿 #3e564e (二沉池, biology has taken over, green tint)
    case 'tk-clarifier':
      return {
        color: '#3e564e', // 二沉池 墨绿
        emissive: '#243731',
        opacity: 0.82,
        roughness: 0.4
      };

    // 4b. pH3 (settling — transition between muddy and green)
    case 'tk-ph3':
      return {
        color: '#4a5b4f',
        emissive: '#2C3931',
        opacity: 0.78,
        roughness: 0.4
      };

    // 5. Sludge Storage (concentrated dark sludge)
    case 'tk-sludge':
      return {
        color: '#2c2017',
        emissive: '#160E0A',
        opacity: 0.95,
        roughness: 0.9
      };

    // 6. Intermediate Pool (clarified — shifting toward clean teal-green)
    case 'tk-intermediate':
      return {
        color: '#45655C',
        emissive: '#182420',
        opacity: 0.72,
        roughness: 0.32
      };

    // 7. Mixing Pool (deep treatment, semi-clean teal)
    case 'tk-mixing':
      return {
        color: '#4A7078',
        emissive: '#182428',
        opacity: 0.68,
        roughness: 0.28
      };

    // 8. Drainage / Outfall Pool — treated water, still slightly turbid
    case 'tk-drainage':
    case 'tk-outfall':
      return {
        color: '#4A7078',
        emissive: '#152022',
        opacity: 0.62,
        roughness: 0.34
      };

    default:
      return {
        color: '#4A7078',
        emissive: '#152022',
        opacity: 0.65,
        roughness: 0.32
      };
  }
};

interface TankProps {
  position: [number, number, number];
  size: [number, number, number]; // Outer dimensions [width, height, depth]
  id: string;
  wallThickness?: number;
  hasAgitator?: boolean;
  overflowRight?: boolean;
  overflowLeft?: boolean;
}

export const Tank3D: React.FC<TankProps> = ({ 
  position, 
  size, 
  id, 
  wallThickness = 0.3,
  hasAgitator = false,
  overflowRight = false,
  overflowLeft = false
}) => {
  const innerRef = useRef<THREE.Mesh>(null);
  const vortexLayer1Ref = useRef<THREE.Mesh>(null);
  const vortexLayer2Ref = useRef<THREE.Mesh>(null);
  const waterMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const tank = useScadaStore((state) => state.equipments[id] as TankData);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);

  const [w, h, d] = size;
  const t = wallThickness;

  // Per-tank agitator phasing. Previously every agitator rotated off the shared global
  // clock at the same speed, so all paddles turned in lockstep and looked artificial.
  // Hash the tank id into a stable seed so each agitator gets its own speed (0.7–1.3×)
  // and starting angle (0–2π). The values are deterministic per id, so re-renders /
  // reloads stay consistent instead of randomly reshuffling.
  const agitatorParams = useMemo(() => {
    const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const speedMul = 0.7 + seededUnit(seed * 1.7) * 0.6;   // 0.7 ~ 1.3
    const startPhase = seededUnit(seed * 3.1) * Math.PI * 2; // 0 ~ 2π
    return { speedMul, startPhase };
  }, [id]);

  const ladderWall = useMemo(() => pickLadderWall(id, overflowLeft, overflowRight), [id, overflowLeft, overflowRight]);
  const ladderLateral = useMemo(() => pickLadderLateral(id), [id]);

  // Seed the paddles' initial rotation so the first frame already shows staggered angles,
  // not all aligned at 0°. (Handed off to MixerDrive3D via startPhase prop.)

  // Catwalk logic: Only for tanks wide or deep enough. Crosses the shorter dimension to save steel.
  const hasCatwalk = w > 2 && d > 2;
  const catwalkLength = Math.max(1.6, Math.min(w - 2 * t, d - 2 * t)); // keep bridge and rails inside the basin walls
  // Let's force catwalk along Z axis (crossing depth) for simplicity unless it's a very specific shape.
  // Actually, crossing the depth (Z axis) is typical in this layout.

  // Calculate visual level height based on levelValue and max
  const maxVisualLevel = h - 0.2;
  const maxStorage = (tank?.highHigh || h) * 1.05;
  const liquidHeight = tank ? (tank.levelValue / maxStorage) * maxVisualLevel : maxVisualLevel * 0.5;

  useFrame((state) => {
    if (innerRef.current) {
      // Scale vertically from the bottom
      innerRef.current.scale.y = Math.max(0.01, liquidHeight);
      innerRef.current.position.y = (-h / 2) + t + (liquidHeight / 2);
    }
    // Agitator shaft/impeller spin is now driven inside MixerDrive3D; the tank
    // frame loop keeps ownership of the water-surface vortex layers (which read
    // from the same per-tank phase) and the water-shader uniforms.
    const { speedMul, startPhase } = agitatorParams;
    const elapsed = state.clock.elapsedTime;
    if (vortexLayer1Ref.current && tank?.agitatorRunning) {
      vortexLayer1Ref.current.rotation.z = startPhase + elapsed * 0.75 * speedMul;
    }
    if (vortexLayer2Ref.current && tank?.agitatorRunning) {
      vortexLayer2Ref.current.rotation.z = -startPhase - elapsed * 1.25 * speedMul;
    }
    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      waterMaterialRef.current.uniforms.uTurbulence.value = tank?.aerationRunning ? 1.25 : 0.0;
      waterMaterialRef.current.uniforms.uRainIntensity.value = 0;
      // Drive the water specular/fresnel from the real sun direction and camera.
      updateWaterLighting(waterMaterialRef.current, state.camera.position);
    }
  });

  const isAlarm = tank?.alarmState !== 'none';
  const labelColor = isAlarm ? '#ef4444' : '#38bdf8';
  const surfaceVortexSize = Math.min(Math.max(Math.min(w, d) * 0.26, 0.75), 1.45);
  const bubbleColumnSize = Math.min(Math.max(Math.min(w, d) * 0.22, 0.6), 1.25);

  const waterProfile = useMemo(() => getWastewaterColor(id, isAlarm), [id, isAlarm]);

  const shaderArgs = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(waterProfile.color) },
        uEmissive: { value: new THREE.Color(waterProfile.emissive) },
        uOpacity: { value: waterProfile.opacity },
        uWaveIntensity: { value: (hasAgitator && tank?.agitatorRunning) || tank?.aerationRunning ? 1.25 : 0.25 },
        uTurbulence: { value: tank?.aerationRunning ? 1.25 : 0.0 },
        uRainIntensity: { value: 0 },
        // Light/view uniforms: seeded from the shared WaterShader defaults and
        // refreshed each frame in useFrame (see updateWaterLighting).
        uLightDir: { value: (WaterShader.uniforms.uLightDir.value as THREE.Vector3).clone() },
        uCameraPos: { value: (WaterShader.uniforms.uCameraPos.value as THREE.Vector3).clone() },
      },
      vertexShader: WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
    };
  }, [waterProfile, hasAgitator, tank?.agitatorRunning, tank?.aerationRunning]);

  // Procedural spiral vortex canvas texture
  const vortexTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      
      const cx = 128;
      const cy = 128;
      
      // Draw 4 soft-edged spiral arms
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        const offset = (arm * Math.PI) / 2;
        for (let angle = 0; angle < Math.PI * 2.2; angle += 0.05) {
          const radius = 6 + angle * 16;
          const x = cx + Math.cos(angle + offset) * radius;
          const y = cy + Math.sin(angle + offset) * radius;
          const alpha = Math.max(0, 0.4 * (1 - angle / (Math.PI * 2.2)));
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 15 * (1 - angle / (Math.PI * 2.2)) + 1.5;
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      
      // Draw random bubbling foam dots
      for (let i = 0; i < 50; i++) {
        const angle = seededUnit(i + 1) * Math.PI * 2;
        const radius = 10 + seededUnit(i + 51) * 85;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const size = 1.2 + seededUnit(i + 101) * 3.5;
        const alpha = seededUnit(i + 151) * 0.25 * (1 - radius / 110);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  // Build the catwalk rails geometry once — collected into instance sets so each
  // geometry/material pair renders as a single InstancedMesh draw call.
  const rails = useMemo(() => {
    if (!hasCatwalk) return null;
    const steps = Math.max(3, Math.floor(catwalkLength / 1.0));
    const zStart = -catwalkLength / 2;
    const zEnd = catwalkLength / 2;
    const railTopY = 1.08;
    const railMidY = 0.58;
    const toeY = 0.16;
    const sideX = 0.66;

    const posts: InstanceXform[] = [];
    const endRails: InstanceXform[] = [];
    for (const side of [-1, 1]) {
      const xPos = side * sideX;
      for (let i = 0; i <= steps; i++) {
        const zPos = zStart + (i * catwalkLength) / steps;
        posts.push({ position: [xPos, 0.55, zPos] });
      }
    }
    for (const z of [zStart, zEnd]) {
      for (const y of [railTopY, railMidY]) {
        endRails.push({ position: [0, y, z], rotation: [0, 0, Math.PI / 2] });
      }
    }

    // Top/mid/toe bars have a per-tank length so they stay individual meshes —
    // only 6 of them per tank, and instancing variable-length cylinders needs
    // scale hacks that hurt readability. The 80% win is the posts + end rails.
    return (
      <group>
        <InstancedCylinder args={[0.038, 0.038, 1.1, 10]} material={Materials.safetyGuard} instances={posts} />
        <InstancedCylinder args={[0.025, 0.025, sideX * 2 + 0.08, 12]} material={Materials.safetyGuard} instances={endRails} />
        {[-1, 1].map((side) => {
          const xPos = side * sideX;
          return (
            <React.Fragment key={side}>
              <mesh position={[xPos, railTopY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.032, 0.032, catwalkLength + 0.08, 12]} />
                <primitive object={Materials.safetyGuard} attach="material" />
              </mesh>
              <mesh position={[xPos, railMidY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.025, 0.025, catwalkLength + 0.08, 12]} />
                <primitive object={Materials.safetyGuard} attach="material" />
              </mesh>
              <mesh position={[xPos, toeY, 0]} castShadow>
                <boxGeometry args={[0.045, 0.12, catwalkLength - 0.12]} />
                <primitive object={Materials.safetyGuard} attach="material" />
              </mesh>
            </React.Fragment>
          );
        })}
      </group>
    );
  }, [hasCatwalk, catwalkLength]);

  // Perimeter safety rails for the top of concrete walls (Safety Yellow).
  // Posts + bases are instanced (one draw call each); the variable-length
  // horizontal rails stay as individual meshes (8 per tank).
  const perimeterRails = useMemo(() => {
    const railHeight = 1.1;
    const postRadius = 0.03;
    const barRadius = 0.02;

    const postPositions: InstanceXform[] = [];
    const basePositions: InstanceXform[] = [];
    const addPost = (x: number, z: number) => {
      basePositions.push({ position: [x, h / 2 + 0.11, z] });
      postPositions.push({ position: [x, h / 2 + railHeight / 2, z] });
    };

    // 1. Vertical posts at corners
    const corners = [
      [-w / 2 + t / 2, -d / 2 + t / 2],
      [w / 2 - t / 2, -d / 2 + t / 2],
      [w / 2 - t / 2, d / 2 - t / 2],
      [-w / 2 + t / 2, d / 2 - t / 2],
    ];
    corners.forEach(([x, z]) => addPost(x, z));

    // Intermediate posts along width (X)
    const xSteps = Math.floor(w / 2);
    if (xSteps > 1) {
      for (let i = 1; i < xSteps; i++) {
        const pct = i / xSteps;
        const x = -w / 2 + t / 2 + pct * (w - t);
        for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) addPost(x, z);
      }
    }
    // Intermediate posts along depth (Z)
    const zSteps = Math.floor(d / 2);
    if (zSteps > 1) {
      for (let i = 1; i < zSteps; i++) {
        const pct = i / zSteps;
        const z = -d / 2 + t / 2 + pct * (d - t);
        for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) {
          if (overflowRight && x > 0) continue;
          if (overflowLeft && x < 0) continue;
          addPost(x, z);
        }
      }
    }

    // 2. Horizontal rails (variable length — keep individual, 8 total)
    const heights = [railHeight, railHeight / 2];

    return (
      <group>
        <InstancedCylinder args={[postRadius, postRadius, railHeight, 10]} material={Materials.safetyGuard} instances={postPositions} />
        <InstancedBox args={[0.22, 0.035, 0.22]} material={Materials.castIron} instances={basePositions} />
        {heights.map((ry, hIdx) => (
          <React.Fragment key={hIdx}>
            {[-d / 2 + t / 2, d / 2 - t / 2].map((z) => (
              <mesh key={`p-rail-x-${hIdx}-${z}`} position={[0, h / 2 + ry, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[barRadius, barRadius, w - t, 12]} />
                <primitive object={Materials.safetyGuard} attach="material" />
              </mesh>
            ))}
            {[-w / 2 + t / 2, w / 2 - t / 2].map((x) => (
              (overflowRight && x > 0) || (overflowLeft && x < 0) ? null : (
              <mesh key={`p-rail-z-${hIdx}-${x}`} position={[x, h / 2 + ry, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[barRadius, barRadius, d - t, 12]} />
                <primitive object={Materials.safetyGuard} attach="material" />
              </mesh>
              )
            ))}
          </React.Fragment>
        ))}
      </group>
    );
  }, [w, h, d, t, overflowLeft, overflowRight]);

  const fwStart = overflowLeft ? -w/2 : -w/2 + t;
  const fwEnd = overflowRight ? w/2 : w/2 - t;
  const fwWidth = fwEnd - fwStart;
  const fwCenterX = (fwStart + fwEnd) / 2;
  const leftWallDepth = overflowLeft ? d - 2*t : d;
  const rightWallDepth = overflowRight ? d - 2*t : d;

  // Coping box geometries with a baked vertex-colour water-stain gradient.
  // Built once per tank (two shapes: left/right side rails + front/back rails)
  // and disposed on unmount. The stain lives entirely in the vertex colours.
  const copingGeometries = useMemo(() => ({
    leftRight: makeStainedCopingGeometry([t + 0.12, 0.09, d + 0.12]),
    frontBack: makeStainedCopingGeometry([fwWidth, 0.09, t + 0.12]),
  }), [d, t, fwWidth]);
  useEffect(() => () => { copingGeometries.leftRight.dispose(); copingGeometries.frontBack.dispose(); }, [copingGeometries]);

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}>
      
      {/* --- SOLID CONCRETE BASIN --- */}
      <group>
        {/* Floor */}
        <mesh position={[0, -h/2 + t/2, 0]} receiveShadow castShadow>
          <boxGeometry args={[w, t, d]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Left Wall */}
        {overflowLeft ? (
          <mesh position={[-w/2 + t/2, (-h/2 + t/2) + (h * 0.55)/2, 0]} receiveShadow castShadow>
            <boxGeometry args={[t, h * 0.55, leftWallDepth]} />
            <primitive object={Materials.poolWall} attach="material" />
          </mesh>
        ) : (
          <mesh position={[-w/2 + t/2, 0, 0]} receiveShadow castShadow>
            <boxGeometry args={[t, h, leftWallDepth]} />
            <primitive object={Materials.poolWall} attach="material" />
          </mesh>
        )}
        {/* Right Wall */}
        {overflowRight ? (
          <mesh position={[w/2 - t/2, (-h/2 + t/2) + (h * 0.55)/2, 0]} receiveShadow castShadow>
            <boxGeometry args={[t, h * 0.55, rightWallDepth]} />
            <primitive object={Materials.poolWall} attach="material" />
          </mesh>
        ) : (
          <mesh position={[w/2 - t/2, 0, 0]} receiveShadow castShadow>
            <boxGeometry args={[t, h, rightWallDepth]} />
            <primitive object={Materials.poolWall} attach="material" />
          </mesh>
        )}
        {/* Front Wall */}
        <mesh position={[fwCenterX, 0, d/2 - t/2]} receiveShadow castShadow>
          <boxGeometry args={[fwWidth, h, t]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Back Wall */}
        <mesh position={[fwCenterX, 0, -d/2 + t/2]} receiveShadow castShadow>
          <boxGeometry args={[fwWidth, h, t]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>

        {/* Overflow weir troughs — when a side wall is a low overflow weir (only
            55% of tank height), water spilling over the weir edge needs a
            collection trough to flow into instead of vanishing into a flat
            notch. The trough sits on the outer face of the weir wall, spanning
            the full basin depth, opening upward at the weir-crest height. */}
        {overflowLeft && (
          <mesh
            position={[-w/2 - 0.18, -h/2 + t/2 + h * 0.55 - 0.08, 0]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[0.36, 0.16, d]} />
            <primitive object={Materials.poolWall} attach="material" />
          </mesh>
        )}
        {overflowRight && (
          <mesh
            position={[w/2 + 0.18, -h/2 + t/2 + h * 0.55 - 0.08, 0]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[0.36, 0.16, d]} />
            <primitive object={Materials.poolWall} attach="material" />
          </mesh>
        )}
      </group>

      {/* TODO(overflow-weir): water body z-fighting. When liquidHeight exceeds
          the weir crest (h*0.55), the flat water box would visually punch
          through the lowered weir wall. Not triggered in demo scenarios (all
          agitator tanks sit at liquidHeight ≈ 1.0m < crest 1.1m), but a real
          high-level data feed could expose it. Fix would be to clip the water
          box's height on the overflow side, or sink the surface below the
          crest and route the excess through the trough above. */}

      {/* Concrete coping */}
      <group>
        {!overflowLeft && (
          <mesh position={[-w/2 + t/2, h/2 + 0.045, 0]} receiveShadow castShadow>
            <primitive object={copingGeometries.leftRight} attach="geometry" />
            <primitive object={copingStainMaterial} attach="material" />
          </mesh>
        )}
        {!overflowRight && (
          <mesh position={[w/2 - t/2, h/2 + 0.045, 0]} receiveShadow castShadow>
            <primitive object={copingGeometries.leftRight} attach="geometry" />
            <primitive object={copingStainMaterial} attach="material" />
          </mesh>
        )}
        <mesh position={[fwCenterX, h/2 + 0.045, d/2 - t/2]} receiveShadow castShadow>
          <primitive object={copingGeometries.frontBack} attach="geometry" />
          <primitive object={copingStainMaterial} attach="material" />
        </mesh>
        <mesh position={[fwCenterX, h/2 + 0.045, -d/2 + t/2]} receiveShadow castShadow>
          <primitive object={copingGeometries.frontBack} attach="geometry" />
          <primitive object={copingStainMaterial} attach="material" />
        </mesh>

        {[-0.28, 0.28].map((offset) => (
          <React.Fragment key={`tank-wall-joint-${offset}`}>
            <mesh position={[offset * w, 0, d/2 + 0.006]} receiveShadow>
              <boxGeometry args={[0.024, h - 0.24, 0.012]} />
              <meshBasicMaterial color="#6F7672" transparent opacity={0.26} />
            </mesh>
            <mesh position={[offset * w, 0, -d/2 - 0.006]} receiveShadow>
              <boxGeometry args={[0.024, h - 0.24, 0.012]} />
              <meshBasicMaterial color="#6F7672" transparent opacity={0.26} />
            </mesh>
          </React.Fragment>
        ))}
      </group>

      {/* --- REALISTIC WATER BODY --- */}
      {/* Slightly smaller than inner volume to prevent Z-fighting with walls.
          transparent + depthWrite=false is the standard Three.js choice for
          translucent liquids: writing depth would make the water box's own
          faces (top + sides) fail depth-sort and shimmer. The trade-off is
          that when two overlapping tanks line up exactly, a far tank's water
          can show through a near tank's wall during certain camera angles —
          but the near tank's opaque wall normally occludes it. Kept as-is
          after evaluation; depthWrite=true reintroduces surface shimmer. */}
      <mesh
        ref={innerRef}
        receiveShadow
        // In HQ mode the water shader animates (uTime/turbulence) so it must stay
        // out of the static baker. In PERF mode water is a flat shared material
        // with no per-frame uniform work, so we let the baker merge same-colour
        // water bodies into one draw call (the level-scale animation still runs
        // via scale.y on this mesh — but after bake the merged mega-mesh no
        // longer scales, which is the accepted PERF-mode trade-off).
        userData={{ bakeExclude: true }}
        renderOrder={1}
      >
        <boxGeometry args={[w - 2*t - 0.02, 1, d - 2*t - 0.02, 32, 1, 32]} />
        <shaderMaterial
          ref={waterMaterialRef}
          args={[shaderArgs]}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* --- CATWALK (Optional based on size) --- */}
      {hasCatwalk && (
        <group position={[0, h/2, 0]}>
          {/* Steel Grating Floor */}
          <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.28, 0.05, catwalkLength]} />
            <meshStandardMaterial color="#A5B0BA" roughness={0.48} metalness={0.62} />
          </mesh>
          {/* Grating bars — instanced into one draw call per tank */}
          {(() => {
            const barCount = Math.max(4, Math.floor(catwalkLength / 0.45));
            const barPositions: InstanceXform[] = [];
            for (let i = 0; i < barCount; i++) {
              const z = -catwalkLength / 2 + 0.25 + (i * (catwalkLength - 0.5)) / Math.max(1, barCount - 1);
              barPositions.push({ position: [0, 0.058, z] });
            }
            return <InstancedBox args={[1.18, 0.018, 0.03]} material={gratingBarMaterial} instances={barPositions} />;
          })()}
          {/* Safety Rails */}
          {rails}
          {/* Center Mounting Plate for Agitator */}
          {hasAgitator && (
            <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.98, 0.055, 1.02]} />
              <meshStandardMaterial color="#B8C2CC" roughness={0.42} metalness={0.68} />
            </mesh>
          )}
        </group>
      )}

      {/* --- HIGH-FIDELITY MIXER DRIVE --- */}
      {/* MixerDrive3D carries its own per-surface PBR materials (painted enamel
          casing + clearcoat, cast-iron gearbox, galvanized base, stainless hex
          hardware, brass cable gland, rubber conduit, machined shaft, aluminium
          nameplate) so the assembly reads as a physical machine rather than a
          single-coloured lump. The drive spins itself from the store's run flag
          using the tank's per-id speed/phase so the fleet stays out of lockstep. */}
      {hasAgitator && (
        <group position={[0, h/2 + (hasCatwalk ? 0.08 : 0), 0]}>
          <MixerDrive3D
            id={id}
            tankHeight={h}
            wallThickness={t}
            // Visible but controlled impeller blade length. This keeps the
            // rotor clearly readable as rotating blades while staying well
            // inside the basin and away from the walls.
            bladeLength={Math.min(Math.max(Math.min(w, d) * 0.14, 0.34), 0.58)}
            // Inner clear dimensions (outer size minus two wall thicknesses) so
            // the compact steady-bearing yoke can stay proportional to the pool.
            innerWidth={w - 2 * t}
            innerDepth={d - 2 * t}
            speedMul={agitatorParams.speedMul}
            startPhase={agitatorParams.startPhase}
          />
        </group>
      )}

      {/* --- PERIMETER SAFETY RAILS --- */}
      {perimeterRails}

      {/* --- MAINTENANCE ACCESS LADDER --- */}
      <PoolLadder3D
        poolWidth={w}
        poolHeight={h}
        poolDepth={d}
        wallThickness={t}
        wall={ladderWall}
        lateral={ladderLateral}
      />

      {/* --- WATER SURFACE VORTEX / RIPPLES (UPGRADED HIGH-FIDELITY FLUID HYBRID SWIRL) --- */}
      {hasAgitator && tank?.agitatorRunning && (
        <group position={[0, -h/2 + t + liquidHeight + 0.015, 0]} userData={{ bakeExclude: true }}>
          {/* Layer 1: Slow Clockwise Spiral */}
          <mesh ref={vortexLayer1Ref} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[surfaceVortexSize, surfaceVortexSize]} />
            <meshBasicMaterial 
              map={vortexTexture} 
              transparent={true} 
              opacity={0.24} 
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* Layer 2: Fast Counter-Clockwise Spiral (smaller, offset) */}
          <mesh ref={vortexLayer2Ref} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} scale={[0.75, 0.75, 1]}>
            <planeGeometry args={[surfaceVortexSize, surfaceVortexSize]} />
            <meshBasicMaterial 
              map={vortexTexture} 
              transparent={true} 
              opacity={0.12} 
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* --- RISING BUBBLE TURBULENCE COLUMN --- */}
      {hasAgitator && tank?.agitatorRunning && (
        <Sparkles 
          count={10} 
          scale={[bubbleColumnSize, Math.max(0.4, liquidHeight * 0.72), bubbleColumnSize]} 
          size={0.68} 
          speed={0.45} 
          position={[0, -h/2 + t + (liquidHeight / 2), 0]} 
          color="#ffffff" 
          opacity={0.22} 
        />
      )}

      {/* --- STEAM / VAPOR ABOVE WATER SURFACE (for chemical/reaction tanks like Fenton or Sludge) --- */}
      {(id === 'tk-fenton' || id === 'tk-sludge' || id === 'tk-coagulation') && (tank?.agitatorRunning || tank?.aerationRunning) && (
        <Sparkles 
          count={12} 
          scale={[w - 2*t - 0.2, 1.2, d - 2*t - 0.2]} 
          size={2.0} 
          speed={0.35} 
          position={[0, -h/2 + t + liquidHeight + 0.8, 0]} 
          color="#E8EAED" 
          opacity={0.07} 
        />
      )}

      {/* --- SELECTION OUTLINE --- */}
      {isSelected && (
        <group position={[0, h / 2 + 0.055, 0]}>
          <mesh position={[0, 0, -d / 2 - 0.035]} renderOrder={2}>
            <boxGeometry args={[w + 0.12, 0.035, 0.045]} />
            <meshBasicMaterial color={labelColor} transparent opacity={0.78} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, d / 2 + 0.035]} renderOrder={2}>
            <boxGeometry args={[w + 0.12, 0.035, 0.045]} />
            <meshBasicMaterial color={labelColor} transparent opacity={0.78} depthWrite={false} />
          </mesh>
            {!overflowLeft && (
              <mesh position={[-w / 2 - 0.035, 0, 0]} renderOrder={2}>
                <boxGeometry args={[0.045, 0.035, d + 0.12]} />
                <meshBasicMaterial color={labelColor} transparent opacity={0.78} depthWrite={false} />
              </mesh>
            )}
            {!overflowRight && (
              <mesh position={[w / 2 + 0.035, 0, 0]} renderOrder={2}>
                <boxGeometry args={[0.045, 0.035, d + 0.12]} />
                <meshBasicMaterial color={labelColor} transparent opacity={0.78} depthWrite={false} />
              </mesh>
            )}
        </group>
      )}

      <FloatingPoolLabel3D
        position={[0, h / 2 + 2.6, 0]}
        name={tank?.name || '未知池体'}
        equipmentId={id}
        selected={isSelected}
        alarm={isAlarm}
      />

    </group>
  );
};
