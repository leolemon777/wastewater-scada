import React from 'react';
import { Sparkles, Instances, Instance, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/** Instanced fence/railing post — one draw call for N posts sharing a geometry. */
const InstancedFencePost: React.FC<{
  args: [number, number, number];
  color: string;
  positions: [number, number, number][];
}> = ({ args, color, positions }) => (
  <Instances limit={positions.length} castShadow>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} roughness={0.55} metalness={0.22} />
    {positions.map((p, i) => (
      <Instance key={i} position={p} />
    ))}
  </Instances>
);

// Clear bright daylight sky — pale blue zenith, light horizon (not stylised neon).
const SKY_TOP = new THREE.Color('#92C8EB');
const SKY_HORIZON = new THREE.Color('#F2F6FA');
const SKY_HORIZON_WARM = new THREE.Color('#F8F6F2');

function SkyGradientDome() {
  const { geometry, material } = React.useMemo(() => {
    // Pre-bake the top→horizon gradient into the dome's vertex colors so we pay
    // no per-frame cost and stay MeshBasicMaterial-friendly for low-end GPUs.
    const geo = new THREE.SphereGeometry(300, 24, 12);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // normalize height: y from -300..300 → 0..1, then bias so the horizon band lands near 0.5
      const ny = THREE.MathUtils.clamp((pos.getY(i) / 300 + 1) / 2, 0, 1);
      const t = ny < 0.5 ? 0 : (ny - 0.5) * 2;
      const horizon = SKY_HORIZON.clone().lerp(SKY_HORIZON_WARM, 0.35);
      const c = horizon.lerp(SKY_TOP, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false });
    return { geometry: geo, material: mat };
  }, []);
  return (
    <mesh args={[geometry, material]} frustumCulled={false} />
  );
}

import { useScadaStore } from '../../store/useScadaStore';
import { SCENE_VISUAL } from './shared/sceneVisualDefaults';
import { ConcreteNoiseTexture, Materials } from './shared/Materials';
import { isPumpRunning } from '../../store/equipmentUtils';
import { IntakeSection } from './sections/IntakeSection';
import { MainProcessSection } from './sections/MainProcessSection';
import { DeepTreatmentSection } from './sections/DeepTreatmentSection';
import { SludgeSection } from './sections/SludgeSection';
import { ChemicalDosingSection } from './sections/ChemicalDosingSection';
import { PureWaterSection } from './sections/PureWaterSection';
import { IndustrialPipeNetwork3D } from './sections/IndustrialPipeNetwork3D';
import { ChemicalPipeRouting } from './sections/ChemicalPipeRouting';
import { ProcessAndSludgePipeNetwork3D } from './sections/ProcessAndSludgePipeNetwork3D';
import { StaticGeometryBaker } from './shared/StaticGeometryBaker';
import { SunLight } from './shared/WaterShader';
import { resolveSiteGroundSurfaceColor, resolveSitePoolWallColor } from './site/siteGround';
import { HazardousWasteDeliveryBay3D, HazardousWasteWarehouse3D, HazwasteStagingBags3D } from './site/HazardousWasteWarehouse3D';
import { AreaSign3D } from './site/AreaSign3D';
import { DistributionCabinet3D } from './equipment/DistributionCabinet3D';
import { Forklift3D } from './site/Forklift3D';
import {
  HAZWASTE_DOOR_X,
  HAZWASTE_INTERIOR_UNLOAD_Z,
  HAZWASTE_NORTH_LANE_Z,
  HAZWASTE_WEST_LANE_X,
  SLUDGE_ACCESS_RAMP,
  SLUDGE_DEWATERING_DOOR_APPROACH_Z,
  SLUDGE_DEWATERING_DOOR_X,
  SLUDGE_LOAD_X,
  SLUDGE_LOAD_Z,
  SLUDGE_PLATFORM_DECK_Y,
  SLUDGE_RUNOUT_Z,
  SLUDGE_SOUTH_ROAD_Z,
  SLUDGE_SOUTH_RUNOUT_X,
} from './site/sludgePlatformLayout';
import { PatrolOffice3D } from './site/PatrolOffice3D';
import { InspectorPreview3D } from './shared/InspectorPreview3D';



function seededUnit(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}


// Rain particles component for rainy weather
const RainParticles: React.FC = () => {
  const count = 400;
  const pointsRef = React.useRef<THREE.Points>(null);

  // Generate random positions for rain drops
  const positions = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (seededUnit(i * 3 + 1) - 0.5) * 160;     // X: -80 to 80
      pos[i * 3 + 1] = seededUnit(i * 3 + 2) * 55;          // Y: 0 to 55
      pos[i * 3 + 2] = (seededUnit(i * 3 + 3) - 0.5) * 160; // Z: -80 to 80
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Fast falling rain drops
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= delta * 38; // fall speed
      arr[i * 3] -= delta * 4;      // blow slightly in wind
      
      // Recycle drops when they hit floor level
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 45 + Math.random() * 10;
        arr[i * 3] = (Math.random() - 0.5) * 160;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 160;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#93C5FD" // Cyan-blue raindrop
        size={0.16}
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

// Industrial Streetlamp Component for night lighting
const StreetLamp: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 1. Pole post — center at Y=3, so it spans Y=0..6 */}
      <mesh castShadow receiveShadow position={[0, 3, 0]}>
        <cylinderGeometry args={[0.04, 0.07, 6, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* 2. Arm — a cylinder tilted 22.5° downward, rooted at the pole top (0,6,0).
          Length 0.8, so its end sits at (sin22.5·0.8, 6−cos22.5·0.8) ≈ (0.306, 5.26).
          The mesh position is the midpoint between root and end. */}
      {(() => {
        const armLen = 0.8;
        const armAngle = Math.PI / 8; // 22.5°
        const endX = Math.sin(armAngle) * armLen;
        const endY = 6 - Math.cos(armAngle) * armLen;
        return (
          <mesh castShadow position={[endX / 2, 6 + (endY - 6) / 2, 0]} rotation={[0, 0, armAngle]}>
            <cylinderGeometry args={[0.035, 0.035, armLen, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.6} />
          </mesh>
        );
      })()}

      {/* 3. Lamp fixture head — sits exactly at the arm's end, flush against it. */}
      <mesh castShadow position={[0.306, 5.26, 0]}>
        <boxGeometry args={[0.26, 0.1, 0.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.5} />
      </mesh>

      {/* 4. Glowing bulb face (underside of the head) */}
      <mesh position={[0.306, 5.2, 0]}>
        <boxGeometry args={[0.2, 0.01, 0.32]} />
        <meshBasicMaterial color="#5A6578" />
      </mesh>
    </group>
);

const GroundRamp: React.FC<{
  position: [number, number, number];
  size: [number, number];
  color: string;
  angle: number;
}> = ({ position, size, color, angle }) => (
  <mesh position={position} rotation={[0, 0, angle]} receiveShadow>
    <boxGeometry args={[size[0], 0.012, size[1]]} />
    <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} />
  </mesh>
);

const GroundRect: React.FC<{
  position: [number, number, number];
  size: [number, number];
  color: string;
  roughness?: number;
  metalness?: number;
}> = ({ position, size, color, roughness = 0.82, metalness = 0.02 }) => (
  <mesh position={position} receiveShadow>
    <boxGeometry args={[size[0], 0.012, size[1]]} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  </mesh>
);

const SiteLine: React.FC<{
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity?: number;
}> = ({ position, size, color, opacity = 1 }) => (
  <mesh position={position} receiveShadow>
    <boxGeometry args={[size[0], 0.018, size[1]]} />
    <meshBasicMaterial color={color} transparent opacity={opacity} />
  </mesh>
);

const SiteCurb: React.FC<{
  position: [number, number, number];
  size: [number, number];
  color: string;
}> = ({ position, size, color }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={[size[0], 0.08, size[1]]} />
    <meshStandardMaterial color={color} roughness={0.78} metalness={0.02} />
  </mesh>
);

const SafetyCone3D: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.42, 0.07, 0.42]} />
      <meshStandardMaterial color="#1F2937" roughness={0.72} metalness={0.02} />
    </mesh>
    <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
      <coneGeometry args={[0.18, 0.62, 20]} />
      <meshStandardMaterial color="#EA580C" roughness={0.62} metalness={0.03} />
    </mesh>
    <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.138, 0.152, 0.035, 20]} />
      <meshStandardMaterial color="#F8FAFC" roughness={0.48} metalness={0.02} />
    </mesh>
    <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.075, 0.095, 0.03, 20]} />
      <meshStandardMaterial color="#F8FAFC" roughness={0.48} metalness={0.02} />
    </mesh>
  </group>
);

const SafetyBarrier3D: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  length?: number;
}> = ({ position, rotationY = 0, length = 2.3 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[-length / 2, 0.48, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.08, 0.92, 0.08]} />
      <meshStandardMaterial color="#B45309" roughness={0.46} metalness={0.04} />
    </mesh>
    <mesh position={[length / 2, 0.48, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.08, 0.92, 0.08]} />
      <meshStandardMaterial color="#B45309" roughness={0.46} metalness={0.04} />
    </mesh>
    <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
      <boxGeometry args={[length + 0.18, 0.12, 0.08]} />
      <meshStandardMaterial color="#F59E0B" roughness={0.52} metalness={0.03} />
    </mesh>
    <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
      <boxGeometry args={[length + 0.18, 0.12, 0.08]} />
      <meshStandardMaterial color="#F8FAFC" roughness={0.52} metalness={0.03} />
    </mesh>
    <mesh position={[-length / 2, 0.03, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.42, 0.06, 0.32]} />
      <meshStandardMaterial color="#475569" roughness={0.68} metalness={0.08} />
    </mesh>
    <mesh position={[length / 2, 0.03, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.42, 0.06, 0.32]} />
      <meshStandardMaterial color="#475569" roughness={0.68} metalness={0.08} />
    </mesh>
  </group>
);

const PipeStorageRack3D: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => {
  const pipeRows = React.useMemo(
    () => [
      [-0.34, 0.18, -0.18],
      [0, 0.18, -0.18],
      [0.34, 0.18, -0.18],
      [-0.18, 0.39, 0.08],
      [0.18, 0.39, 0.08],
    ] as [number, number, number][],
    []
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.12, 0.86]} />
        <meshStandardMaterial color="#7C6A55" roughness={0.82} metalness={0.02} />
      </mesh>
      {pipeRows.map((pipe, index) => (
        <mesh key={`pipe-rack-${index}`} position={pipe} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.105, 0.105, 2.9, 24]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#CBD5E1' : '#94A3B8'} roughness={0.38} metalness={0.55} />
        </mesh>
      ))}
    </group>
  );
};



const SiteFenceX3D: React.FC<{
  position: [number, number, number];
  length: number;
  postCount: number;
  color: string;
}> = ({ position, length, postCount, color }) => {
  const postPositions = React.useMemo<[number, number, number][]>(
    () => Array.from({ length: postCount }, (_, index) => {
      const t = postCount <= 1 ? 0.5 : index / (postCount - 1);
      return [-length / 2 + t * length, 0.68, 0];
    }),
    [length, postCount],
  );

  return (
    <group position={position}>
      <InstancedFencePost args={[0.08, 1.36, 0.08]} color={color} positions={postPositions} />
      {[0.34, 0.78, 1.16].map((y) => (
        <mesh key={`fence-x-rail-${y}`} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[length, 0.035, 0.045]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.22} />
        </mesh>
      ))}
    </group>
  );
};

const SiteFenceZ3D: React.FC<{
  position: [number, number, number];
  length: number;
  postCount: number;
  color: string;
}> = ({ position, length, postCount, color }) => {
  const postPositions = React.useMemo<[number, number, number][]>(
    () => Array.from({ length: postCount }, (_, index) => {
      const t = postCount <= 1 ? 0.5 : index / (postCount - 1);
      return [0, 0.68, -length / 2 + t * length];
    }),
    [length, postCount],
  );

  return (
    <group position={position}>
      <InstancedFencePost args={[0.08, 1.36, 0.08]} color={color} positions={postPositions} />
      {[0.34, 0.78, 1.16].map((y) => (
        <mesh key={`fence-z-rail-${y}`} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.045, 0.035, length]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.22} />
        </mesh>
      ))}
    </group>
  );
};

const SiteSignBoard3D: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.9, 0.86, 0.06]} />
      <meshStandardMaterial color="#F8FAFC" roughness={0.58} metalness={0.05} />
    </mesh>
    <mesh position={[0, 1.09, -0.035]} castShadow receiveShadow>
      <boxGeometry args={[1.74, 0.14, 0.02]} />
      <meshStandardMaterial color="#2563EB" roughness={0.5} metalness={0.05} />
    </mesh>
    <mesh position={[-0.44, 0.8, -0.035]} castShadow receiveShadow>
      <boxGeometry args={[0.62, 0.24, 0.02]} />
      <meshStandardMaterial color="#F59E0B" roughness={0.5} metalness={0.05} />
    </mesh>
    <mesh position={[0.44, 0.8, -0.035]} castShadow receiveShadow>
      <boxGeometry args={[0.62, 0.24, 0.02]} />
      <meshStandardMaterial color="#10B981" roughness={0.5} metalness={0.05} />
    </mesh>
    <mesh position={[-0.62, 0.36, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.06, 0.72, 0.06]} />
      <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.22} />
    </mesh>
    <mesh position={[0.62, 0.36, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.06, 0.72, 0.06]} />
      <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.22} />
    </mesh>
  </group>
);

const SiteContext3D: React.FC<{
  isBrightPalette: boolean;
  isNight: boolean;
  groundSurfaceColor: string;
}> = ({
  isBrightPalette,
  isNight,
  groundSurfaceColor,
}) => {
  // Roads and service pads share the main ground tone so they don't read as floating black slabs.
  const roadColor = isNight ? '#2A2A2A' : isBrightPalette ? '#666666' : '#555555';
  const servicePadColor = isNight ? '#555555' : isBrightPalette ? '#C4C4C4' : '#A6A6A6';
  const trenchColor = isNight ? '#111827' : isBrightPalette ? '#59646A' : '#3E474C';
  const curbColor = isNight ? '#5B626C' : isBrightPalette ? '#B8BBBE' : '#8F9296';
  const paintColor = isNight ? '#9CA3AF' : isBrightPalette ? '#F0F2F3' : '#E2E5E7';
  const jointColor = isNight ? '#2E3742' : isBrightPalette ? '#84888C' : '#65696D';
  const roadY = -0.036;
  const padY = -0.024;
  const lineY = -0.012;
  const curbY = 0.0;
  const jointOpacity = 0.32;
  const fenceColor = isNight ? '#9CA3AF' : '#78838A';

  const expansionJoints = React.useMemo(() => {
    const joints: React.ReactNode[] = [];
    for (let x = -92; x <= 52; x += 12) {
      joints.push(
        <SiteLine
          key={`joint-x-${x}`}
          position={[x, lineY, -0.4]}
          size={[0.02, 56]}
          color={jointColor}
          opacity={jointOpacity}
        />
      );
    }
    for (let z = -28; z <= 26; z += 12) {
      joints.push(
        <SiteLine
          key={`joint-z-${z}`}
          position={[-19.5, lineY, z]}
          size={[149, 0.02]}
          color={jointColor}
          opacity={jointOpacity}
        />
      );
    }
    return joints;
  }, [jointColor, jointOpacity, lineY]);

  return (
    <group>
      {/* Main paved base inside the factory fence (lowered to avoid z-fighting with roads).
          Extended west (x −94…56) for the pure-water RO house. */}
      <GroundRect position={[-19, -0.048, -0.4]} size={[150, 58]} color={groundSurfaceColor} roughness={0.95} />

      {/* Darker asphalt service roads break up the large gray slab and describe operator circulation. */}
      <GroundRect position={[-20.5, roadY, 8.3]} size={[145, 3.4]} color={roadColor} roughness={0.92} />
      <GroundRect position={[29, roadY, -3]} size={[3.4, 50]} color={roadColor} roughness={0.92} />
      <GroundRect position={[-18, roadY, -23.4]} size={[60, 2.8]} color={roadColor} roughness={0.9} />
      <GroundRect position={[39, roadY, -23.4]} size={[26, 2.8]} color={roadColor} roughness={0.9} />
      {/* West spur + duty-office pad — replaces former sand pile yard (left southwest). */}
      <GroundRect position={[-55, roadY, -23.4]} size={[16, 2.8]} color={roadColor} roughness={0.9} />
      <GroundRect position={[-56, padY, -21.5]} size={[12, 8.5]} color={roadColor} roughness={0.88} />
      {/* 
        This road intersects the Deep Treatment pad (X: 4 to 30).
        We split it into left, middle, right segments, and use ramps (斜坡) to smooth the transition.
      */}
      {/* Sludge south service road (Z=22.4): tinted to match the main ground
          surface instead of the darker roadColor. The dark asphalt tone here
          read as a persistent "shadow" slab in front of the sludge platform
          (it sat under the platform's cast shadow, doubling the darkening).
          Matching the surrounding ground removes the flat dark base while the
          directional platform shadow still gives the scene its depth. */}
      <GroundRect position={[-2.6, roadY, 22.4]} size={[10.8, 2.8]} color={groundSurfaceColor} roughness={0.9} />
      <GroundRamp position={[3.4, -0.029, 22.4]} size={[1.2, 2.8]} color={groundSurfaceColor} angle={0.0116} />
      <GroundRect position={[17, padY + 0.002, 22.4]} size={[26, 2.8]} color={groundSurfaceColor} roughness={0.9} />
      <GroundRamp position={[30.6, -0.029, 22.4]} size={[1.2, 2.8]} color={groundSurfaceColor} angle={-0.0116} />
      <GroundRect position={[31.6, roadY, 22.4]} size={[0.8, 2.8]} color={groundSurfaceColor} roughness={0.9} />

      {/* Slightly warmer concrete pads around high-maintenance areas.
          Note: the sludge south service pad (formerly [17, padY, 22.0]) was
          removed — it overlapped the asphalt road at [17, padY+0.002, 22.4]
          (only 2mm apart) and caused heavy z-fighting (the "flickering slab"
          in front of the sludge platform). The road alone covers that area. */}
      <GroundRect position={[40.7, padY, -14.8]} size={[20, 6.2]} color={servicePadColor} roughness={0.86} />
      <GroundRect position={[-19, padY, -9.2]} size={[42, 2.2]} color={servicePadColor} roughness={0.86} />
      {/* Pure-water house service pad — covers the building footprint and the
          east-door approach, meeting the main road edge. */}
      <GroundRect position={[-75, padY, 4]} size={[22, 15]} color={servicePadColor} roughness={0.86} />

      {/* Perimeter and road curbs give the site a real boundary instead of an infinite plane. */}
      <SiteCurb position={[-19.5, curbY, 27.6]} size={[149, 0.18]} color={curbColor} />
      <SiteCurb position={[-19.5, curbY, -28.4]} size={[149, 0.18]} color={curbColor} />
      <SiteCurb position={[-93, curbY, -0.4]} size={[0.18, 56]} color={curbColor} />
      <SiteCurb position={[55, curbY, -0.4]} size={[0.18, 56]} color={curbColor} />
      <SiteCurb position={[-4, curbY, 10.1]} size={[112, 0.12]} color={curbColor} />
      <SiteCurb position={[-4, curbY, 6.5]} size={[112, 0.12]} color={curbColor} />
      <SiteCurb position={[30.8, curbY, -3]} size={[0.12, 50]} color={curbColor} />
      <SiteCurb position={[27.2, curbY, -3]} size={[0.12, 50]} color={curbColor} />

      {/* Narrow drainage channels along service roads. */}
      <SiteLine position={[-4, lineY, 5.8]} size={[108, 0.12]} color={trenchColor} opacity={0.72} />
      <SiteLine position={[-4, lineY, 10.8]} size={[108, 0.12]} color={trenchColor} opacity={0.72} />
      <SiteLine position={[26.4, lineY, -3]} size={[0.12, 48]} color={trenchColor} opacity={0.72} />
      <SiteLine position={[31.6, lineY, -3]} size={[0.12, 48]} color={trenchColor} opacity={0.72} />
      <SiteLine position={[-18, lineY, -21.7]} size={[58, 0.1]} color={trenchColor} opacity={0.68} />
      <SiteLine position={[39, lineY, -21.7]} size={[24, 0.1]} color={trenchColor} opacity={0.68} />

      {/* Muted lane markings: enough to read as a plant road without becoming decorative. */}
      <SiteLine position={[-4, lineY + 0.002, 8.3]} size={[82, 0.045]} color={paintColor} opacity={0.42} />
      <SiteLine position={[29, lineY + 0.002, -3]} size={[0.045, 35]} color={paintColor} opacity={0.38} />
      <SiteLine position={[-18, lineY + 0.002, -23.4]} size={[40, 0.045]} color={paintColor} opacity={0.36} />

      {expansionJoints}

      <>
          <SiteFenceX3D position={[-19.5, 0.0, 28.5]} length={149} postCount={19} color={fenceColor} />
          <SiteFenceX3D position={[-19.5, 0.0, -29.3]} length={149} postCount={19} color={fenceColor} />
          <SiteFenceZ3D position={[-93.8, 0.0, -0.4]} length={58} postCount={9} color={fenceColor} />
          <SiteFenceZ3D position={[55.8, 0.0, -0.4]} length={58} postCount={9} color={fenceColor} />

          <HazardousWasteWarehouse3D isNight={isNight} />
          <PatrolOffice3D isNight={isNight} />
          {/* Static Meshy inspector mesh — visual scale check only (no rig/walk yet). */}
          <InspectorPreview3D position={[-50, 0, -16]} rotationY={Math.PI * 0.35} />
          <HazardousWasteDeliveryBay3D />
          <HazwasteStagingBags3D />

          {/* 功能分区大标牌(Billboard,永远正向可读):一眼分清污水/危废/纯水。 */}
          <AreaSign3D position={[0, 5, 6]} name="污水处理区" en="WASTEWATER TREATMENT" tone="wastewater" />
          <AreaSign3D position={[43.5, 5, 21]} name="危废处理区" en="HAZARDOUS WASTE" tone="hazwaste" />
          <AreaSign3D position={[-76, 5, 0]} name="纯水产水区" en="PURE WATER (RO)" tone="purewater" />
          <PipeStorageRack3D position={[52.2, 0.02, 24.0]} rotationY={Math.PI / 2} />
          <PipeStorageRack3D position={[47.8, 0.02, -24.2]} rotationY={0} />
          <SiteSignBoard3D position={[53.5, 0.03, 10.8]} rotationY={-Math.PI / 2} />

          <SafetyCone3D position={[-37.5, 0.02, 6.2]} rotationY={0.2} />
          <SafetyCone3D position={[-30.5, 0.02, 10.6]} rotationY={-0.4} />
          <SafetyCone3D position={[25.8, 0.02, 7.0]} rotationY={0.5} />
          <SafetyCone3D position={[31.9, 0.02, -13.6]} rotationY={-0.2} />
          {/* Sludge-platform cone: seat on the raised deck and keep its full
              0.42 m base clear of the south coping / ramp retaining wall. */}
          <SafetyCone3D
            position={[15.2, SLUDGE_PLATFORM_DECK_Y + 0.01, 20.3]}
            rotationY={0.9}
          />
          <SafetyCone3D position={[38.2, 0.02, -21.8]} rotationY={-0.7} />

          <SafetyBarrier3D position={[-41.0, 0.03, 5.7]} rotationY={0.05} />
          <SafetyBarrier3D position={[25.6, 0.03, -20.3]} rotationY={Math.PI / 2} />
          <SafetyBarrier3D position={[42.0, 0.03, -9.4]} rotationY={0.03} length={2.8} />
        </>
    </group>
  );
};

/**
 * Static shadow optimisation — the wastewater scene's shadow casters (tanks,
 * pumps, buildings) are essentially stationary, so re-rendering the 1024 shadow
 * map every frame is pure waste on an integrated GPU.
 *
 * We let the shadow map render normally for the first few frames (so the first
 * deterministic update lands), then flip `gl.shadowMap.autoUpdate = false` and
 * mark `needsUpdate = true` once more to bake the final static map. If the sun
 * direction or palette changes (day/night, weather), the effect resets the
 * counter so a fresh static map is baked.
 */
function updateShadowMap(renderer: THREE.WebGLRenderer, autoUpdate: boolean) {
  renderer.shadowMap.autoUpdate = autoUpdate;
  renderer.shadowMap.needsUpdate = true;
}

const StaticShadowController: React.FC<{ trigger: string }> = ({ trigger }) => {
  const { gl, scene } = useThree();
  const frameCount = React.useRef(0);
  React.useEffect(() => {
    // Re-enable auto-update and reset the bake counter whenever the lighting
    // config changes (encoded in `trigger`).
    frameCount.current = 0;
    updateShadowMap(gl, true);
    if (typeof window !== 'undefined') (window as unknown as { __scadaScene?: THREE.Scene }).__scadaScene = scene;
  }, [gl, trigger, scene]);
  useFrame(() => {
    if (gl.shadowMap.autoUpdate) {
      frameCount.current += 1;
      // After ~60 frames the shadow map has fully settled; freeze it.
      if (frameCount.current > 60) {
        updateShadowMap(gl, false);
      }
    }
  });
  return null;
};

export const SCADAScene: React.FC = () => {
  // Subscribe to derived booleans only — re-rendering the whole scene graph on
  // every equipments-map update (each 3s demo tick) causes visible frame hitches.
  const anyLiftRunning = useScadaStore((s) => isPumpRunning(
    s.equipments,
    'p-lift-1',
    'p-lift-2',
    'p-lift-3',
    'p-lift-4',
    'p-gas-lift-1',
    'p-gas-lift-2',
  ));
  const isInterRunning = useScadaStore((s) => isPumpRunning(s.equipments, 'p-inter-1', 'p-inter-2'));
  const isDrainRunning = useScadaStore((s) => isPumpRunning(s.equipments, 'p-drain-1', 'p-drain-2'));
  const isClarSludgeRunning = useScadaStore((s) => isPumpRunning(s.equipments, 'p-sludge-clar-1', 'p-sludge-clar-2'));
  const isDafSludgeRunning = useScadaStore((s) => isPumpRunning(s.equipments, 'p-sludge-daf-1', 'p-sludge-daf-2'));
  const isOutSludgeRunning = useScadaStore((s) => isPumpRunning(s.equipments, 'p-sludge-out-1', 'p-sludge-out-2'));
  const totalInflow = useScadaStore((s) => s.totalInflow);
  const { isBrightPalette, isNight, isDaylight, isSunny, isCloudy, isRainy } = SCENE_VISUAL;

  // Dynamic concrete wetness PBR reaction (stays anchored to the warm-grey #a8a49a base)
  React.useEffect(() => {
    if (isRainy) {
      Materials.concrete.roughness = isBrightPalette ? 0.74 : 0.34;
      Materials.concrete.metalness = isBrightPalette ? 0.03 : 0.18;
      Materials.concrete.color.set(isNight ? '#3A3A3A' : isBrightPalette ? '#999999' : '#888888');
    } else {
      Materials.concrete.roughness = isBrightPalette ? 0.9 : 0.84;
      Materials.concrete.metalness = isBrightPalette ? 0.02 : 0.04;
      Materials.concrete.color.set(isNight ? '#555555' : isBrightPalette ? '#D4D4D4' : '#A8ABAE');
    }
  }, [isRainy, isNight, isBrightPalette]);

  React.useEffect(() => {
    const poolWallColor = resolveSitePoolWallColor({ isNight, isRainy, isBrightPalette });
    if (isRainy) {
      Materials.poolWall.roughness = isBrightPalette ? 0.72 : 0.38;
      Materials.poolWall.metalness = isBrightPalette ? 0.04 : 0.14;
    } else {
      Materials.poolWall.roughness = isBrightPalette ? 0.88 : 0.84;
      Materials.poolWall.metalness = isBrightPalette ? 0.03 : 0.04;
    }
    Materials.poolWall.color.set(poolWallColor);
  }, [isRainy, isNight, isBrightPalette]);

  React.useEffect(() => {
    Materials.brushedMetal.metalness = 0.68;
    Materials.brushedMetal.roughness = 0.34;
    Materials.brushedMetal.color.set('#BCC7CD');
    Materials.motorCasing.metalness = 0.18;
    Materials.motorCasing.color.set('#2563EB');
    Materials.castIron.metalness = 0.28;
    Materials.castIron.color.set('#6F7476');
    Materials.polishedSteel.metalness = 0.76;
    Materials.polishedSteel.color.set('#DCE2E5');
    Materials.agitatorBlade.metalness = 0.58;
  }, []);

  // Dynamic sun/moon angle based on weather and dayNightMode
  const sunPos = React.useMemo(() => {
    if (isNight) return [0, -35, 0] as [number, number, number]; // sun sets completely below horizon
    if (isSunny) return [80, 55, 50] as [number, number, number];
    if (isCloudy) return [80, 42, 50] as [number, number, number];
    return [80, 35, 50] as [number, number, number];
  }, [isSunny, isCloudy, isNight]);

  // Publish the current sun direction (world space, normalised) to the water
  // shader's shared SunLight holder so every tank surface's specular highlight
  // tracks the actual directional light instead of a hardcoded constant. At
  // night the sun is below the horizon; we keep a faint downward vector so water
  // still catches a glint from the (moonless) ambient fill rather than going
  // dead flat.
  React.useEffect(() => {
    const [sx, sy, sz] = sunPos;
    SunLight.dir.set(sx, sy, sz).normalize();
  }, [sunPos]);

  const sunIntensity = isSunny ? 2.55 : isCloudy ? 1.2 : 0.95;
  const sunColor = isNight
    ? '#1A1A1A'
    : isSunny
      ? '#FFF4E8'
      : isCloudy
        ? '#ECECEC'
        : '#D8D8D8';

  const fogColor = isNight
    ? '#1A2433'
    : isSunny
      ? '#E4EAF0'
      : isCloudy
        ? '#D0D8E0'
        : '#C4CCD4';
  // Sunny haze removed entirely — even 0.00055 greyed the far half of the
  // site and read as "blur". Weather moods keep their fog.
  // Sunny haze: very light aerial perspective so distant structures read at depth
  // without washing the scene (the old 0.00055+ values looked like blur/smoke).
  const fogDensity = isNight
    ? 0.0028
    : isSunny
      ? 0.00032
      : isCloudy
        ? 0.0025
        : 0.0018;

  const ambientIntensity = 0.62;
  const ambientColor = '#F5F5F5';
  const hemiIntensity = isNight
    ? 0.12
    : isSunny
      ? 0.58
      : 0.52;
  const hemiGround = isNight
    ? '#2A2A2A'
    : isSunny
      ? '#D8D8D8'
      : '#B5B5B5';

  const sparklesCount = 0;
  const sparklesOpacity = 0;

  // Wet concrete floor parameters
  const factoryAsphaltColor = resolveSiteGroundSurfaceColor({ isNight, isRainy, isBrightPalette });
  const outsideTerrainColor = isNight ? '#2A2A2A' : isBrightPalette ? '#DDDDDD' : '#E6E6E6';
  const groundRoughness = isBrightPalette ? (isRainy ? 0.72 : 0.92) : isRainy ? 0.28 : 0.82;
  const groundMetalness = isBrightPalette ? (isRainy ? 0.04 : 0.015) : isRainy ? 0.12 : 0.04; 

  const groundBumpMap = React.useMemo(() => {
    const tex = ConcreteNoiseTexture.clone();
    tex.repeat.set(32, 32);
    return tex;
  }, []);

  const hasInflow = totalInflow > 0;
  const mainFlowActive = anyLiftRunning;

  return (
    <>
      <color attach="background" args={['#D4E9F9']} />

      {/* ===== SKY DOME (soft daylight gradient, replaces flat gray + physical sky) ===== */}
      {isDaylight && <SkyGradientDome />}

      {/* ===== ATMOSPHERIC FOG & SUN-DUST SPARKLES ===== */}
      {fogDensity > 0 && <fogExp2 attach="fog" args={[fogColor, fogDensity]} />}
      {sparklesCount > 0 && (
        <Sparkles
          count={sparklesCount}
          scale={160}
          size={3.2}
          speed={0.45}
          color="#E8ECF0"
          opacity={sparklesOpacity}
        />
      )}

      {/* ===== RAIN PARTICLES ===== */}
      {isRainy && <RainParticles />}

      {/* ===== LIGHTING (aligned with sun direction) ===== */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <hemisphereLight args={[isDaylight && isSunny ? '#F2F2F2' : '#737373', hemiGround, hemiIntensity]} />

      {/* Main sunlight — bright neutral daylight. Shadow map is a single 2048
          static texture (see StaticShadowController): casters are stationary, so
          we bake once and skip the per-frame shadow pass for integrated GPUs.
          2048 over the 140m frustum gives ~7 texels/metre so tank/pump contact
          shadows stay crisp instead of blocky; the one-time bake cost is paid
          only while the StaticShadowController is still filling the map. */}
      <directionalLight
        position={sunPos}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.015}
      >
        <orthographicCamera attach="shadow-camera" args={[-70, 70, 70, -70, 0.1, 260]} />
      </directionalLight>
      {/* Cool fill light from opposite side (sky bounce) */}
      <directionalLight
        position={[-40, 40, -30]}
        intensity={isSunny ? 0.28 : 0.16}
        color="#D8E4EE"
      />
      {/* Subtle ground bounce light */}
      <directionalLight
        position={[0, -10, 50]}
        intensity={isSunny ? 0.22 : 0.12}
        color="#E2E8F0"
      />

      {/* ===== IMAGE-BASED LIGHTING / ENVIRONMENT REFLECTIONS =====
          Without an environment map, every metal surface (metalness>0) reflects
          nothing and renders flat/dark. We add a CHEAP procedural environment: a
          few <Lightformer> rectangles inside a small <Environment> capture, which
          drei blits into a low-res PMREM cubemap and assigns to scene.environment
          so all MeshStandardMaterials pick up reflections automatically. Gated on
          !performanceMode (PERF mode stays without it — metals are dulled there
          already via the clear-mode effect above). The Lightformer set is small
          (5 rects) so the PMREM bake is a one-time sub-frame cost, not a per-frame
          one.

          INTENSITY NOTE: the Lightformers here are tuned to provide REFLECTION
          CONTENT only (so metals show a sky/horizon/ground gradient in their
          highlights), NOT to act as a primary light source. IBL contributes to
          surface lighting in proportion to its intensity, so keeping these well
          below 1.0 prevents the wash-out / over-exposure that happens when strong
          IBL stacks on top of the already-bright directional sun (3.45) +
          ambient (0.72). If you raise these, the scene blows out to white. */}
      <Environment resolution={64} frames={1} background={false}>
          {/* Sky-bright overhead panel — drives the dominant top reflection on
              horizontal steel/concrete surfaces. */}
          <Lightformer
            form="rect"
            intensity={isNight ? 0.35 : isSunny ? 0.55 : 0.4}
            color={isNight ? '#2A3A55' : isSunny ? '#F7FAFD' : '#D8E0E8'}
            position={[0, 12, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
          {/* Neutral horizon glow from the sun side (+X) — kept achromatic so
              metals don't pick up a yellow cast (the previous warm #FFE9CC
              tinted the whole scene). */}
          <Lightformer
            form="rect"
            intensity={isNight ? 0.15 : 0.3}
            color={isNight ? '#1A2438' : '#F2F5F8'}
            position={[18, 6, 4]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[30, 14, 1]}
          />
          {/* Cool sky bounce from the opposite side (-X) */}
          <Lightformer
            form="rect"
            intensity={isNight ? 0.12 : 0.25}
            color="#C2D4E4"
            position={[-18, 6, -4]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[30, 14, 1]}
          />
          {/* Dim ground/floor reflection so downward-facing metal edges pick up a
              neutral grey instead of black. */}
          <Lightformer
            form="rect"
            intensity={0.15}
            color={isNight ? '#1E2228' : '#94989C'}
            position={[0, -8, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
        </Environment>

      {/* ===== GROUND PLANE (OUTSIDE WORLD TERRAIN) ===== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial
          color={outsideTerrainColor}
          roughness={groundRoughness}
          metalness={groundMetalness}
          bumpMap={groundBumpMap}
          bumpScale={0.015}
        />
      </mesh>

      <SiteContext3D
        isBrightPalette={isBrightPalette}
        isNight={isNight}
        groundSurfaceColor={factoryAsphaltColor}
      />

      {/* ===== FACTORY STREETLAMPS ===== */}
      <>
        <StreetLamp position={[-32, 0, 12]} rotationY={Math.PI / 2} />
        <StreetLamp position={[-20, 0, -8]} rotationY={-Math.PI / 4} />
        <StreetLamp position={[-8, 0, 8]} rotationY={0} />
        <StreetLamp position={[26, 0, -10]} rotationY={Math.PI / 4} />
        <StreetLamp position={[22, 0, 10]} rotationY={Math.PI} />
        <StreetLamp position={[38, 0, -10]} rotationY={-Math.PI / 2} />
      </>

      {/* ===== PROCESS SECTIONS ===== */}
      <StaticShadowController trigger="hq-bright-day" />
      <StaticGeometryBaker rebuildKey="hq-bright-day" />
      <IntakeSection hasInflow={hasInflow} anyLiftRunning={anyLiftRunning} />
      <MainProcessSection mainFlowActive={mainFlowActive} clarSludgeActive={isClarSludgeRunning} />
      <DeepTreatmentSection isInterRunning={isInterRunning} isDrainRunning={isDrainRunning} mainFlowActive={mainFlowActive} />
      <SludgeSection isDafSludgeRunning={isDafSludgeRunning} isOutSludgeRunning={isOutSludgeRunning} />
      <ChemicalDosingSection />
      {/* 纯水房(二级 RO)— 独立系统工艺段,含建筑/设备/全管路。 */}
      <PureWaterSection />
      <IndustrialPipeNetwork3D />
      {/* Chemical dosing delivery (tank → gallery → basin) */}
      <ChemicalPipeRouting />
      <ProcessAndSludgePipeNetwork3D />

      {/* ===== REALISTIC DISTRIBUTION CABINETS ===== */}
      {/* 1. Intake Pumps Cabinet (stands on Intake platform) */}
      <DistributionCabinet3D position={[-29.5, 0.5, 19.0]} rotation={[0, 0, 0]} cabinetName="1# 进水提升控制柜" />
      <DistributionCabinet3D position={[5.5, 0.5, 5.0]} rotation={[0, 0, 0]} cabinetName="2# 沉淀回流控制柜" />
      <DistributionCabinet3D position={[13.5, 0.5, 19.2]} rotation={[0, 0, 0]} cabinetName="4# 污泥脱水控制柜" />

      <group userData={{ bakeExclude: true }}>
          {/* Sludge ton-bag forklift: enters/exits the dewatering house only on
              the south roll-up door centreline, loads at the screw press, then
              runs down the ramp → service road → hazardous-waste warehouse.
              Y values are nominal — getSludgeForkliftSurfaceY re-grounds the
              chassis every frame from the platform/ramp/road bounds. */}
          <Forklift3D
            position={[SLUDGE_DEWATERING_DOOR_X, 0.5, SLUDGE_DEWATERING_DOOR_APPROACH_Z]}
            patrolPath={[
              // Dewatering house: approach → enter → load → leave through the
              // same clear door opening. The movement controller travels X
              // first and then Z, so these aligned points are intentional.
              [SLUDGE_DEWATERING_DOOR_X, 0.5, SLUDGE_DEWATERING_DOOR_APPROACH_Z], // 0. outside standby
              [SLUDGE_DEWATERING_DOOR_X, 0.5, SLUDGE_LOAD_Z], // 1. inside door aisle
              [SLUDGE_LOAD_X, 0.5, SLUDGE_LOAD_Z], // 2. ton-bag loading stop ← LOAD
              [SLUDGE_DEWATERING_DOOR_X, 0.5, SLUDGE_LOAD_Z], // 3. return to door aisle
              [SLUDGE_DEWATERING_DOOR_X, 0.5, SLUDGE_DEWATERING_DOOR_APPROACH_Z], // 4. exit room
              [SLUDGE_ACCESS_RAMP.x, 0.5, SLUDGE_DEWATERING_DOOR_APPROACH_Z], // 5. align with ramp
              [SLUDGE_ACCESS_RAMP.x, 0, SLUDGE_ACCESS_RAMP.zGround], // 6. descend ramp
              [SLUDGE_ACCESS_RAMP.x, 0, SLUDGE_RUNOUT_Z], // 7. clear ramp toe
              [SLUDGE_SOUTH_RUNOUT_X, 0, SLUDGE_RUNOUT_Z], // 8. clear retaining walls
              [HAZWASTE_WEST_LANE_X, 0, SLUDGE_SOUTH_ROAD_Z], // 9. east to warehouse west lane
              [HAZWASTE_WEST_LANE_X, 0, HAZWASTE_NORTH_LANE_Z], // 10. north up west lane
              [HAZWASTE_DOOR_X, 0, HAZWASTE_NORTH_LANE_Z], // 11. warehouse door centreline
              [HAZWASTE_DOOR_X, 0.08, HAZWASTE_INTERIOR_UNLOAD_Z], // 12. unload inside ← UNLOAD
              [HAZWASTE_DOOR_X, 0, HAZWASTE_NORTH_LANE_Z], // 13. reverse out
              [HAZWASTE_WEST_LANE_X, 0, HAZWASTE_NORTH_LANE_Z], // 14. west along north lane
              [HAZWASTE_WEST_LANE_X, 0, SLUDGE_SOUTH_ROAD_Z], // 15. south to service road
              [SLUDGE_SOUTH_RUNOUT_X, 0, SLUDGE_RUNOUT_Z], // 16. return toward ramp
              [SLUDGE_ACCESS_RAMP.x, 0, SLUDGE_RUNOUT_Z], // 17. centre on ramp
              [SLUDGE_ACCESS_RAMP.x, 0, SLUDGE_ACCESS_RAMP.zGround], // 18. ramp foot
              [SLUDGE_ACCESS_RAMP.x, 0.5, SLUDGE_DEWATERING_DOOR_APPROACH_Z], // 19. deck apron; loop to 0
            ]}
            pauseAtIndices={[2, 12]}
            speed={1.6}
            pauseTime={4.0}
          />

        </group>

    </>
  );
};
