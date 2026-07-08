import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCursor, Html, Instances, Instance } from '@react-three/drei';
import { FloatingPoolLabel3D } from './FloatingPoolLabel3D';
import { useScadaStore, type TankData } from '../../store/useScadaStore';
import { Materials } from './Materials';
import { WaterShader, updateWaterLighting } from './WaterShader';
import { PoolLadder3D, pickLadderLateral } from './PoolLadder3D';

interface DAFTankProps {
  id: string;
  position: [number, number, number];
  size?: [number, number, number];
}

function seededBubbleValue(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface ScumDischargeAssemblyProps {
  width: number;
  height: number;
  depth: number;
  active: boolean;
}

const ScumDischargeAssembly: React.FC<ScumDischargeAssemblyProps> = ({
  width,
  height,
  depth,
  active,
}) => {
  const sludgeClumps = useMemo(() => {
    const count = 14;
    return Array.from({ length: count }, (_, i) => {
      const x = (seededBubbleValue(i + 21) - 0.5) * 1.05;
      const y = -height / 2 + 0.46 + seededBubbleValue(i + 41) * 0.22;
      const z = -depth / 2 - 1.35 + (seededBubbleValue(i + 61) - 0.5) * 0.46;
      const sx = 0.18 + seededBubbleValue(i + 81) * 0.2;
      const sy = 0.08 + seededBubbleValue(i + 101) * 0.08;
      const sz = 0.16 + seededBubbleValue(i + 121) * 0.18;
      return {
        position: [x, y, z] as [number, number, number],
        scale: [sx, sy, sz] as [number, number, number],
      };
    });
  }, [depth, height]);

  const troughY = height / 2 - 0.34;
  const wallZ = -depth / 2 + 0.03;
  const outletZ = -depth / 2 - 0.9;
  const binZ = -depth / 2 - 1.42;
  const floorY = -height / 2 + 0.03;

  return (
    <group>
      {/* Full-width scum trough at the DAF discharge edge */}
      <group position={[0, troughY, wallZ]}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[width - 0.8, 0.16, 0.16]} />
          <primitive object={Materials.brushedMetal} attach="material" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.14, -0.11]}>
          <boxGeometry args={[width - 0.9, 0.08, 0.08]} />
          <primitive object={Materials.brushedMetal} attach="material" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.14, 0.11]}>
          <boxGeometry args={[width - 0.9, 0.08, 0.08]} />
          <primitive object={Materials.brushedMetal} attach="material" />
        </mesh>
        <mesh position={[0, 0.19, -0.01]}>
          <boxGeometry args={[width - 1.05, 0.035, 0.18]} />
          <meshStandardMaterial color="#6B4E2E" roughness={0.88} metalness={0.05} />
        </mesh>
      </group>

      {/* Sloped discharge chute outside the wall */}
      <group position={[0, height / 2 - 0.86, -depth / 2 - 0.55]} rotation={[0.34, 0, 0]}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1.45, 0.1, 1.15]} />
          <meshStandardMaterial color="#9CA3AF" roughness={0.5} metalness={0.75} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.76, 0.18, 0]}>
          <boxGeometry args={[0.08, 0.42, 1.12]} />
          <meshStandardMaterial color="#8B939E" roughness={0.5} metalness={0.75} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.76, 0.18, 0]}>
          <boxGeometry args={[0.08, 0.42, 1.12]} />
          <meshStandardMaterial color="#8B939E" roughness={0.5} metalness={0.75} />
        </mesh>
        <mesh position={[0, 0.08, -0.02]}>
          <boxGeometry args={[1.05, 0.035, 0.92]} />
          <meshStandardMaterial color="#7C4A1D" roughness={0.92} metalness={0.02} />
        </mesh>
      </group>

      <mesh position={[0, height / 2 - 0.93, outletZ]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 1.08, 24]} />
        <meshStandardMaterial color="#8B939E" roughness={0.48} metalness={0.8} />
      </mesh>

      {active && (
        <>
          <mesh position={[0, -0.08, outletZ - 0.04]} castShadow>
            <cylinderGeometry args={[0.07, 0.12, height - 1.25, 14]} />
            <meshStandardMaterial color="#8A4F1E" roughness={0.95} metalness={0.02} />
          </mesh>
          <mesh position={[0.12, height / 2 - 1.55, outletZ - 0.02]} castShadow>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshStandardMaterial color="#B36B24" roughness={0.96} metalness={0.01} />
          </mesh>
        </>
      )}

      {/* Open collection skip below the chute */}
      <group position={[0, -height / 2 + 0.08, binZ]}>
        <mesh castShadow receiveShadow position={[0, 0.06, 0]}>
          <boxGeometry args={[1.65, 0.12, 1.05]} />
          <meshStandardMaterial color="#374151" roughness={0.45} metalness={0.78} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.45, -0.52]}>
          <boxGeometry args={[1.65, 0.72, 0.08]} />
          <meshStandardMaterial color="#4B5563" roughness={0.44} metalness={0.74} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.45, 0.52]}>
          <boxGeometry args={[1.65, 0.72, 0.08]} />
          <meshStandardMaterial color="#4B5563" roughness={0.44} metalness={0.74} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.83, 0.45, 0]}>
          <boxGeometry args={[0.08, 0.72, 1.05]} />
          <meshStandardMaterial color="#4B5563" roughness={0.44} metalness={0.74} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.83, 0.45, 0]}>
          <boxGeometry args={[0.08, 0.72, 1.05]} />
          <meshStandardMaterial color="#4B5563" roughness={0.44} metalness={0.74} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[1.25, 0.18, 0.68]} />
          <meshStandardMaterial color="#6B3F1B" roughness={0.96} metalness={0.02} />
        </mesh>
        <mesh position={[-0.92, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.17, 0.025, 8, 18]} />
          <meshStandardMaterial color="#9CA3AF" roughness={0.42} metalness={0.82} />
        </mesh>
        <mesh position={[0.92, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.17, 0.025, 8, 18]} />
          <meshStandardMaterial color="#9CA3AF" roughness={0.42} metalness={0.82} />
        </mesh>
      </group>

      {sludgeClumps.map((clump, index) => (
        <mesh key={index} position={clump.position} scale={clump.scale} castShadow>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={index % 3 === 0 ? '#9A5B20' : '#6F421D'} roughness={0.98} metalness={0.01} />
        </mesh>
      ))}

      <mesh position={[0, height / 2 - 1.15, -depth / 2 - 0.012]}>
        <planeGeometry args={[1.5, 1.15]} />
        <meshBasicMaterial color="#6B3F1B" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, floorY, binZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.25, 1.45]} />
        <meshBasicMaterial color="#4A341E" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const SurfaceSkimmerAssembly: React.FC<ScumDischargeAssemblyProps> = ({
  width,
  height,
  depth,
  active,
}) => {
  const scraperBladeRef = useRef<THREE.Group>(null);
  const cycleRef = useRef(0);
  const driveShaftRef = useRef<THREE.Group>(null);

  const waterY = height / 2 - 0.23;
  const sideX = width / 2 - 0.46;
  const zStart = -depth / 2 + 0.58;
  const zEnd = depth / 2 - 0.58;
  const travelSpan = Math.max(1, zEnd - zStart);
  const pushSeconds = 5.2;
  const returnSeconds = 1.9;
  const cycleSeconds = pushSeconds + returnSeconds;

  const chainLinks = useMemo(() => {
    const count = 18;
    const links: { position: [number, number, number]; rotation: [number, number, number] }[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const z = zStart + (i / Math.max(1, count - 1)) * travelSpan;
        links.push({
          position: [side * sideX, waterY + 0.13, z],
          rotation: [0, i % 2 === 0 ? 0 : Math.PI / 2, 0],
        });
      }
    }
    return links;
  }, [sideX, travelSpan, waterY, zStart]);

  useFrame((_, delta) => {
    cycleRef.current = (cycleRef.current + delta * (active ? 1 : 0.42)) % cycleSeconds;
    const phase = cycleRef.current;
    if (scraperBladeRef.current) {
      const returning = phase > pushSeconds;
      const raw = returning ? (phase - pushSeconds) / returnSeconds : phase / pushSeconds;
      const t = THREE.MathUtils.smoothstep(raw, 0, 1);
      scraperBladeRef.current.position.z = returning
        ? THREE.MathUtils.lerp(zStart, zEnd, t)
        : THREE.MathUtils.lerp(zEnd, zStart, t);
      scraperBladeRef.current.position.y = waterY + (returning ? 0.24 : 0);
    }
    if (driveShaftRef.current) {
      driveShaftRef.current.rotation.x -= delta * (active ? 4.8 : 1.4);
    }
  });

  return (
    <group userData={{ bakeExclude: true }}>
      {([-1, 1] as const).map((side) => (
        <React.Fragment key={`skimmer-side-${side}`}>
          <mesh position={[side * sideX, waterY + 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, travelSpan + 0.7, 16]} />
            <primitive object={Materials.polishedSteel} attach="material" />
          </mesh>
          <mesh position={[side * sideX, waterY + 0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, travelSpan + 0.62, 12]} />
            <primitive object={Materials.brushedMetal} attach="material" />
          </mesh>
        </React.Fragment>
      ))}

      <Instances limit={chainLinks.length}>
        <boxGeometry args={[0.15, 0.055, 0.1]} />
        <meshStandardMaterial color="#2563eb" roughness={0.48} metalness={0.25} />
        {chainLinks.map((link, index) => (
          <Instance key={`daf-chain-${index}`} position={link.position} rotation={link.rotation} />
        ))}
      </Instances>

      <group ref={driveShaftRef} position={[0, waterY + 0.18, zStart]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, width - 0.85, 18]} />
          <primitive object={Materials.polishedSteel} attach="material" />
        </mesh>
        {([-1, 1] as const).map((side) => (
          <mesh key={`daf-sprocket-${side}`} position={[side * sideX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.19, 0.035, 8, 22]} />
            <meshStandardMaterial color="#1f2937" roughness={0.42} metalness={0.72} />
          </mesh>
        ))}
      </group>
      <group position={[width / 2 + 0.28, waterY + 0.22, zStart]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.28, 0.38]} />
          <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.48} />
        </mesh>
        <mesh position={[0.34, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
          <meshStandardMaterial color="#2563eb" roughness={0.5} metalness={0.28} />
        </mesh>
      </group>

      <group ref={scraperBladeRef} position={[0, waterY, zEnd]}>
        <group>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[width - 1.02, 0.08, 0.1]} />
              <primitive object={Materials.brushedMetal} attach="material" />
            </mesh>
            <mesh position={[0, -0.1, -0.045]}>
              <boxGeometry args={[width - 1.2, 0.28, 0.045]} />
              <meshStandardMaterial color="#111827" roughness={0.78} metalness={0.04} />
            </mesh>
          </group>
      </group>
    </group>
  );
};

export const DAFTank3D: React.FC<DAFTankProps> = ({ id, position, size = [8, 4, 8] }) => {
  const [width, height, depth] = size;
  const tankData = useScadaStore((state) => state.equipments[id] as TankData);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);
  const bubbleMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useCursor(hovered, 'pointer', 'auto');
  const waterMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const postRadius = 0.03;
  const railHeight = 1.1;
  const barRadius = 0.02;
  const t = 0.3;

  const postInstances = useMemo(() => {
    const corners = [
      [-width/2 + t/2, -depth/2 + t/2],
      [width/2 - t/2, -depth/2 + t/2],
      [width/2 - t/2, depth/2 - t/2],
      [-width/2 + t/2, depth/2 - t/2],
    ];
    
    const list: { pos: [number, number, number], scale: [number, number, number] }[] = [];
    
    corners.forEach(([x, z]) => {
      list.push({
        pos: [x, height/2 + railHeight/2, z],
        scale: [postRadius, railHeight, postRadius]
      });
    });

    const xSteps = Math.floor(width / 2);
    if (xSteps > 1) {
      for (let i = 1; i < xSteps; i++) {
        const pct = i / xSteps;
        const x = -width/2 + t/2 + pct * (width - t);
        for (const z of [-depth/2 + t/2, depth/2 - t/2]) {
          list.push({
            pos: [x, height/2 + railHeight/2, z],
            scale: [postRadius, railHeight, postRadius]
          });
        }
      }
    }

    const zSteps = Math.floor(depth / 2);
    if (zSteps > 1) {
      for (let i = 1; i < zSteps; i++) {
        const pct = i / zSteps;
        const z = -depth/2 + t/2 + pct * (depth - t);
        for (const x of [-width/2 + t/2, width/2 - t/2]) {
          list.push({
            pos: [x, height/2 + railHeight/2, z],
            scale: [postRadius, railHeight, postRadius]
          });
        }
      }
    }
    
    return list;
  }, [width, height, depth]);

  const railInstances = useMemo(() => {
    const heights = [railHeight, railHeight / 2];
    const list: { pos: [number, number, number], scale: [number, number, number] }[] = [];

    heights.forEach((ry) => {
      for (const z of [-depth/2 + t/2, depth/2 - t/2]) {
        list.push({
          pos: [0, height/2 + ry, z],
          scale: [width - t, barRadius * 2, barRadius * 2]
        });
      }
      for (const x of [-width/2 + t/2, width/2 - t/2]) {
        list.push({
          pos: [x, height/2 + ry, 0],
          scale: [barRadius * 2, barRadius * 2, depth - t]
        });
      }
    });

    return list;
  }, [width, height, depth]);

  const shaderArgs = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#3E736E') },
        uEmissive: { value: new THREE.Color('#234542') },
        uOpacity: { value: 0.6 },
        uWaveIntensity: { value: tankData.aerationRunning ? 1.3 : 0.2 },
        // Light/view uniforms: seeded from the shared WaterShader defaults and
        // refreshed each frame in useFrame (see updateWaterLighting).
        uLightDir: { value: (WaterShader.uniforms.uLightDir.value as THREE.Vector3).clone() },
        uCameraPos: { value: (WaterShader.uniforms.uCameraPos.value as THREE.Vector3).clone() },
      },
      vertexShader: WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
    };
  }, [tankData.aerationRunning]);

  const bubbleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(80, 105, 100, 0.35)'; // Turbid grey-green aerated water
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for(let i=0; i<300; i++) {
        const x = seededBubbleValue(i + 1) * 256;
        const y = seededBubbleValue(i + 301) * 256;
        const radius = seededBubbleValue(i + 601) * 3 + 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);

  useFrame((state, delta) => {
    const map = bubbleMatRef.current?.map;
    if (map && tankData.aerationRunning) {
      map.offset.y -= delta * 0.2;
    }
    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      // Drive the water specular/fresnel from the real sun direction and camera.
      updateWaterLighting(waterMaterialRef.current, state.camera.position);
    }
  });

  if (!tankData) return null;

  return (
    <group position={position}>
      <mesh 
        visible={false} 
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <boxGeometry args={[width + 0.5, height + 0.5, depth + 0.5]} />
      </mesh>

      {/* --- SOLID CONCRETE BASIN --- */}
      <group>
        {/* Floor */}
        <mesh position={[0, -height/2 + 0.15, 0]} receiveShadow castShadow>
          <boxGeometry args={[width, 0.3, depth]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Left Wall */}
        <mesh position={[-width/2 + 0.15, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.3, height, depth]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Right Wall */}
        <mesh position={[width/2 - 0.15, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.3, height, depth]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Front Wall */}
        <mesh position={[0, 0, depth/2 - 0.15]} receiveShadow castShadow>
          <boxGeometry args={[width - 0.6, height, 0.3]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Back Wall */}
        <mesh position={[0, 0, -depth/2 + 0.15]} receiveShadow castShadow>
          <boxGeometry args={[width - 0.6, height, 0.3]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
      </group>

      {/* Aeration Bubbles Layer */}
      <mesh position={[0, -height/4, 0]}>
        <boxGeometry args={[width - 0.65, height/2, depth - 0.65]} />
        <meshStandardMaterial ref={bubbleMatRef} map={bubbleTexture} transparent opacity={tankData.aerationRunning ? 0.48 : 0.12} depthWrite={false} />
      </mesh>

      {/* Dynamic Water Surface with Ripple Shader */}
      <mesh position={[0, height/2 - 0.42, 0]} receiveShadow>
        <boxGeometry args={[width - 0.65, 0.05, depth - 0.65, 32, 1, 32]} />
        <shaderMaterial
          ref={waterMaterialRef}
          args={[shaderArgs]}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Surface Sludge Layer (Floc) */}
      <mesh position={[0, height/2 - 0.4, 0]} material={Materials.waterMuddy}>
        <boxGeometry args={[width - 0.65, 0.2, depth - 0.65]} />
      </mesh>

      <SurfaceSkimmerAssembly
        width={width}
        height={height}
        depth={depth}
        active={Boolean(tankData.scraperRunning)}
      />

      <ScumDischargeAssembly
        width={width}
        height={height}
        depth={depth}
        active={Boolean(tankData.scraperRunning)}
      />

      {/* --- INSTANCED SAFETY RAILS --- */}
      <Instances limit={100} castShadow>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial color="#E5A900" metalness={0.1} roughness={0.55} />
        {postInstances.map((post, idx) => (
          <Instance key={`post-${idx}`} position={post.pos} scale={post.scale} />
        ))}
      </Instances>

      <Instances limit={100} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#E5A900" metalness={0.1} roughness={0.55} />
        {railInstances.map((rail, idx) => (
          <Instance key={`rail-${idx}`} position={rail.pos} scale={rail.scale} />
        ))}
      </Instances>

      <PoolLadder3D
        poolWidth={width}
        poolHeight={height}
        poolDepth={depth}
        wall="front"
        lateral={pickLadderLateral(id) * 0.35}
      />

      <FloatingPoolLabel3D
        position={[0, height / 2 + 2.6, 0]}
        name={tankData.name}
        equipmentId={id}
        selected={isSelected}
        alarm={tankData.alarmState !== 'none'}
      />

      <Html position={[0, height/2 + 0.5, -depth / 2 + 0.1]} center zIndexRange={[34, 0]} distanceFactor={18}>
        <div className="process-marker-3d warning">排渣方向</div>
      </Html>

      {(hovered || isSelected) && (
        <Html position={[0, height / 2 + 0.65, depth / 2 + 0.9]} center zIndexRange={[58, 0]} distanceFactor={22}>
          <div className="daf-control-panel-3d">
            <div className="daf-control-row-3d">
               <span className="daf-control-label-3d">实时 pH</span>
               <span className="digit-font daf-control-value-3d">{tankData.pH?.toFixed(2) || '7.20'}</span>
            </div>
            <div className="daf-control-divider-3d" />
            <div className="daf-control-row-3d">
              <span className="daf-control-label-3d">曝气系统</span>
              <button 
                onClick={(e) => { e.stopPropagation(); useScadaStore.getState().toggleAeration(id); }}
                style={{
                  background: tankData.aerationRunning ? '#10b981' : '#475569'
                }}
                className="daf-control-button-3d"
              >
                {tankData.aerationRunning ? '运行中' : '已停止'}
              </button>
            </div>
            <div className="daf-control-row-3d">
              <span className="daf-control-label-3d">刮沫系统</span>
              <button 
                onClick={(e) => { e.stopPropagation(); useScadaStore.getState().toggleScraper(id); }}
                style={{
                  background: tankData.scraperRunning ? '#10b981' : '#475569'
                }}
                className="daf-control-button-3d"
              >
                {tankData.scraperRunning ? '运行中' : '已停止'}
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
