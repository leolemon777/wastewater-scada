import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor, Html, Instances, Instance } from '@react-three/drei';
import { FloatingPoolLabel3D } from './FloatingPoolLabel3D';
import * as THREE from 'three';
import { useScadaStore, type TankData } from '../../store/useScadaStore';
import { Materials } from './Materials';
import { WaterShader, updateWaterLighting } from './WaterShader';
import { PoolLadder3D, pickLadderLateral } from './PoolLadder3D';

interface ClarifierProps {
  id: string;
  position: [number, number, number];
  size?: [number, number, number];
}

export const Clarifier3D: React.FC<ClarifierProps> = ({ id, position, size = [8, 2, 8] }) => {
  const [w, h, d] = size;
  const t = 0.3; // Wall thickness
  
  const tankData = useScadaStore((state) => state.equipments[id] as TankData);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);
  const scraperRef = useRef<THREE.Group>(null);
  const scraperRunning = Boolean(tankData?.scraperRunning);
  const armReach = w / 2 - t - 0.2;
  const scraperBladeY = -h + t + 0.35;
  
  useCursor(hovered, 'pointer', 'auto');
  const waterMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const postRadius = 0.03;
  const railHeight = 1.1;
  const barRadius = 0.02;
  const bridgePostXs = useMemo(() => {
    const start = 0.22;
    const end = w / 2 - t - 0.22;
    const steps = Math.max(2, Math.floor((end - start) / 1.05));
    const half = Array.from({ length: steps + 1 }, (_, i) => start + ((end - start) * i) / steps);
    // Mirror across the center so posts line the full bridge span (both ±X).
    return [...half, ...half.map((x) => -x)];
  }, [w]);

  const postInstances = useMemo(() => {
    const corners = [
      [-w/2 + t/2, -d/2 + t/2],
      [w/2 - t/2, -d/2 + t/2],
      [w/2 - t/2, d/2 - t/2],
      [-w/2 + t/2, d/2 - t/2],
    ];
    
    const list: { pos: [number, number, number], scale: [number, number, number] }[] = [];
    
    // Corners
    corners.forEach(([cx, cz]) => {
      list.push({
        pos: [cx, h/2 + railHeight/2, cz],
        scale: [postRadius, railHeight, postRadius]
      });
    });

    // Intermediate posts along width (X)
    const xSteps = Math.floor(w / 2);
    if (xSteps > 1) {
      for (let i = 1; i < xSteps; i++) {
        const pct = i / xSteps;
        const cx = -w/2 + t/2 + pct * (w - t);
        for (const cz of [-d/2 + t/2, d/2 - t/2]) {
          list.push({
            pos: [cx, h/2 + railHeight/2, cz],
            scale: [postRadius, railHeight, postRadius]
          });
        }
      }
    }

    // Intermediate posts along depth (Z)
    const zSteps = Math.floor(d / 2);
    if (zSteps > 1) {
      for (let i = 1; i < zSteps; i++) {
        const pct = i / zSteps;
        const cz = -d/2 + t/2 + pct * (d - t);
        for (const cx of [-w/2 + t/2, w/2 - t/2]) {
          // Skip post on the right wall near catwalk opening
          if (cx > 0 && Math.abs(cz) < 0.6) continue;

          list.push({
            pos: [cx, h/2 + railHeight/2, cz],
            scale: [postRadius, railHeight, postRadius]
          });
        }
      }
    }
    
    return list;
  }, [w, h, d]);

  const railInstances = useMemo(() => {
    const heights = [railHeight, railHeight / 2];
    const list: { pos: [number, number, number], scale: [number, number, number] }[] = [];

    heights.forEach((ry) => {
      // Along X - Front & Back
      for (const cz of [-d/2 + t/2, d/2 - t/2]) {
        list.push({
          pos: [0, h/2 + ry, cz],
          scale: [w - t, barRadius * 2, barRadius * 2]
        });
      }
      // Along Z - Left
      list.push({
        pos: [-w/2 + t/2, h/2 + ry, 0],
        scale: [barRadius * 2, barRadius * 2, d - t]
      });

      // Along Z - Right (with opening for catwalk)
      const segmentLength = (d - t)/2 - 0.5;
      const segment1Center = -d/4 - 0.25;
      const segment2Center = d/4 + 0.25;

      list.push({
        pos: [w/2 - t/2, h/2 + ry, segment1Center],
        scale: [barRadius * 2, barRadius * 2, segmentLength]
      });
      list.push({
        pos: [w/2 - t/2, h/2 + ry, segment2Center],
        scale: [barRadius * 2, barRadius * 2, segmentLength]
      });
    });

    return list;
  }, [w, h, d]);

  const shaderArgs = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#718B86') },
        uEmissive: { value: new THREE.Color('#4F6964') },
        uOpacity: { value: 0.6 },
        uWaveIntensity: { value: scraperRunning ? 1.0 : 0.2 },
        // Light/view uniforms: seeded from the shared WaterShader defaults and
        // refreshed each frame in useFrame (see updateWaterLighting).
        uLightDir: { value: (WaterShader.uniforms.uLightDir.value as THREE.Vector3).clone() },
        uCameraPos: { value: (WaterShader.uniforms.uCameraPos.value as THREE.Vector3).clone() },
      },
      vertexShader: WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
    };
  }, [scraperRunning]);

  useFrame((state, delta) => {
    if (scraperRef.current && scraperRunning) {
      scraperRef.current.rotation.y -= delta * 0.1;
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
        <boxGeometry args={[w + 0.5, h + 0.5, d + 0.5]} />
      </mesh>

      {/* --- SOLID CONCRETE BASIN (SQUARE) --- */}
      <group>
        {/* Floor */}
        <mesh position={[0, -h/2 + t/2, 0]} receiveShadow castShadow>
          <boxGeometry args={[w, t, d]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Left Wall */}
        <mesh position={[-w/2 + t/2, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[t, h, d]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Right Wall */}
        <mesh position={[w/2 - t/2, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[t, h, d]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Front Wall */}
        <mesh position={[0, 0, d/2 - t/2]} receiveShadow castShadow>
          <boxGeometry args={[w - 2*t, h, t]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
        {/* Back Wall */}
        <mesh position={[0, 0, -d/2 + t/2]} receiveShadow castShadow>
          <boxGeometry args={[w - 2*t, h, t]} />
          <primitive object={Materials.poolWall} attach="material" />
        </mesh>
      </group>

      {/* --- REALISTIC WATER BODY (SQUARE) --- */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[w - 2*t - 0.02, h - 0.4, d - 2*t - 0.02, 32, 1, 32]} />
        <shaderMaterial
          ref={waterMaterialRef}
          args={[shaderArgs]}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Fixed center pier + drive — half-bridge truss rotates separately below. */}
      <group position={[0, h/2, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.38, 0.42, 24]} />
          <meshStandardMaterial color="#C5CED6" roughness={0.46} metalness={0.58} />
        </mesh>

        {/* Center-drive scraper gearbox assembly (static). */}
        <group position={[0, 0.08, 0]} userData={{ bakeExclude: true }}>
          <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.26, 0.08, 1.0]} />
            <meshStandardMaterial color="#EAF0F5" roughness={0.32} metalness={0.7} />
          </mesh>
          {[
            [-0.48, -0.4],
            [0.48, -0.4],
            [-0.48, 0.4],
            [0.48, 0.4],
          ].map(([x, z], i) => (
            <mesh key={`clarifier-drive-bolt-${i}`} position={[x, 0.08, z]} castShadow receiveShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.04, 10]} />
              <meshStandardMaterial color="#F4F7FA" roughness={0.22} metalness={0.92} />
            </mesh>
          ))}

          <mesh position={[0, 0.135, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.46, 0.5, 0.12, 36]} />
            <meshStandardMaterial color="#DDE7EF" roughness={0.32} metalness={0.78} />
          </mesh>
          <mesh position={[0, 0.225, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.68, 0.18, 0.62]} />
            <meshStandardMaterial color="#C9D5DE" roughness={0.38} metalness={0.72} />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.54, 0.26, 0.52]} />
            <meshStandardMaterial color="#EEF4F9" roughness={0.3} metalness={0.76} />
          </mesh>
          <mesh position={[0, 0.59, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.08, 0.4]} />
            <meshStandardMaterial color="#B9C7D2" roughness={0.42} metalness={0.66} />
          </mesh>

          <group position={[-0.76, 0.48, 0]}>
            <mesh position={[-0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.92, 32]} />
              <meshPhysicalMaterial color="#62D69A" roughness={0.26} metalness={0.38} clearcoat={0.62} clearcoatRoughness={0.14} />
            </mesh>
            {Array.from({ length: 9 }).map((_, i) => (
              <mesh key={`clarifier-motor-fin-${i}`} position={[-0.7 + i * 0.085, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[0.245, 0.245, 0.018, 32]} />
                <meshStandardMaterial color="#35A875" roughness={0.34} metalness={0.5} />
              </mesh>
            ))}
            <mesh position={[-0.84, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.225, 0.225, 0.08, 24]} />
              <meshStandardMaterial color="#B9C5D0" roughness={0.5} metalness={0.52} />
            </mesh>
            <mesh position={[0.18, 0, 0]} castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.12, 0.12, 0.24, 24]} />
              <meshStandardMaterial color="#D8E0E8" roughness={0.34} metalness={0.72} />
            </mesh>
            <mesh position={[-0.32, 0.24, 0.12]} castShadow receiveShadow>
              <boxGeometry args={[0.3, 0.12, 0.24]} />
              <meshStandardMaterial color="#57C58C" roughness={0.34} metalness={0.42} />
            </mesh>
            <mesh position={[-0.32, -0.25, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.72, 0.08, 0.34]} />
              <meshStandardMaterial color="#B7C2CC" roughness={0.46} metalness={0.58} />
            </mesh>
            <mesh position={[0.38, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.24, 16]} />
              <primitive object={Materials.polishedSteel} attach="material" />
            </mesh>
          </group>

          <mesh position={[0.33, 0.68, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.01, 8, 22]} />
            <meshStandardMaterial
              color={scraperRunning ? "#10b981" : "#ef4444"}
              emissive={scraperRunning ? "#10b981" : "#ef4444"}
              emissiveIntensity={0.24}
            />
          </mesh>
        </group>
      </group>

      {/* Fixed half-bridge catwalk + handrails. The bridge is a maintenance
          walkway to the center drive and must NOT rotate — only the underwater
          scraper arm in the next group rotates with the drive. */}
      <group position={[0, h/2, 0]} userData={{ bakeExclude: true }}>
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.055, 1.08]} />
          <meshStandardMaterial color="#D7E0E8" roughness={0.38} metalness={0.72} />
        </mesh>
        {[-0.55, 0.55].map((z) => (
          <mesh key={`clarifier-bridge-stringer-${z}`} position={[0, 0.095, z]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.07, 0.08]} />
            <meshStandardMaterial color="#AEBAC5" roughness={0.44} metalness={0.7} />
          </mesh>
        ))}
        {Array.from({ length: Math.max(8, Math.floor(w / 0.7) * 2) }).map((_, i, arr) => {
          const x = -(w / 2 - 0.18) + ((w - 0.36) * i) / Math.max(1, arr.length - 1);
          return (
            <mesh key={`clarifier-bridge-grate-${i}`} position={[x, 0.062, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.035, 0.02, 0.96]} />
              <meshStandardMaterial color="#8795A3" roughness={0.48} metalness={0.64} />
            </mesh>
          );
        })}

        {[-0.48, 0.48].map((z) => (
          <React.Fragment key={`clarifier-bridge-rail-${z}`}>
            <mesh position={[0, 0.92, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.028, 0.028, w - 0.18, 16]} />
              <primitive object={Materials.safetyGuard} attach="material" />
            </mesh>
            <mesh position={[0, 0.55, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.023, 0.023, w - 0.18, 16]} />
              <primitive object={Materials.safetyGuard} attach="material" />
            </mesh>
            <mesh position={[0, 0.17, z]} castShadow receiveShadow>
              <boxGeometry args={[w - 0.16, 0.09, 0.03]} />
              <primitive object={Materials.safetyGuard} attach="material" />
            </mesh>
            {bridgePostXs.map((x) => (
              <mesh key={`clarifier-bridge-post-${z}-${x.toFixed(2)}`} position={[x, 0.5, z]} castShadow receiveShadow>
                <cylinderGeometry args={[0.027, 0.027, 0.82, 14]} />
                <primitive object={Materials.safetyGuard} attach="material" />
              </mesh>
            ))}
          </React.Fragment>
        ))}
        {[0.92, 0.55].flatMap((y) => [1, -1].map((sign) => (
          <mesh key={`clarifier-bridge-end-rail-${y}-${sign}`} position={[(w/2 - t - 0.08) * sign, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[y > 0.8 ? 0.028 : 0.023, y > 0.8 ? 0.028 : 0.023, 1.02, 16]} />
            <primitive object={Materials.safetyGuard} attach="material" />
          </mesh>
        )))}
      </group>

      {/* Rotating underwater scraper arm — sweeps the basin floor. The bridge
          above stays fixed; only this arm + its center coupling spin. */}
      <group ref={scraperRef} position={[0, h/2, 0]} userData={{ bakeExclude: true }}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.22, 16]} />
          <primitive object={Materials.castIron} attach="material" />
        </mesh>
        <mesh position={[0, scraperBladeY, 0]} castShadow>
          <boxGeometry args={[armReach * 2, 0.12, 0.14]} />
          <primitive object={Materials.brushedMetal} attach="material" />
        </mesh>
        {[1, -1].map((sign) => (
          <mesh key={`clarifier-scraper-blade-${sign}`} position={[(armReach - 0.08) * sign, scraperBladeY - 0.08, 0]} castShadow>
            <boxGeometry args={[0.42, 0.22, 0.18]} />
            <meshStandardMaterial color="#8A949E" roughness={0.52} metalness={0.62} />
          </mesh>
        ))}
        <mesh position={[0, scraperBladeY - 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 0.16, 20]} />
          <meshStandardMaterial color="#6E7A84" roughness={0.58} metalness={0.48} />
        </mesh>
      </group>

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
        poolWidth={w}
        poolHeight={h}
        poolDepth={d}
        wallThickness={t}
        wall="back"
        lateral={pickLadderLateral(id) * 0.4}
      />

      <FloatingPoolLabel3D
        position={[0, h / 2 + 2.6, 0]}
        name={tankData.name}
        equipmentId={id}
        selected={isSelected}
        alarm={tankData.alarmState !== 'none'}
      />

      <Html position={[0, -h/2 - 0.5, 0]} center zIndexRange={[34, 0]} distanceFactor={18}>
         <div className="process-marker-3d warning">⇩ 底部中心排泥</div>
      </Html>

    </group>
  );
};
