import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html, Sparkles } from '@react-three/drei';
import { Tank3D } from '../Tank3D';
import { Pump3D } from '../Pump3D';
import { PIPE_COLORS } from '../pipeRouting';
import { Platform3D } from '../Platform3D';
import { DAFTank3D } from '../DAFTank3D';
import { useScadaStore } from '../../../store/useScadaStore';
import { getTank } from '../../../store/equipmentUtils';
import { PoolLadder3D } from '../PoolLadder3D';

const DEEP_ORIGIN: [number, number, number] = [20, 0, -15];

const OUTFALL_POOL_W = 2.8;
const OUTFALL_POOL_D = 1.8;
const OUTFALL_POOL_WALL_H = 0.9;
const OUTFALL_POOL_WALL_T = 0.16;
const OUTFALL_WATER_Y = 0.42;
const OUTFALL_DROP_NOZZLE_Y = 0.82;

const INTER_PUMP_1: [number, number, number] = [-2, 0.5, 7];
const INTER_PUMP_2: [number, number, number] = [-4, 0.5, 7];

const PulsingTargetRing: React.FC<{ position: [number, number, number]; activeColor: string }> = ({
  position,
  activeColor,
}) => {
  const ringRef = React.useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.elapsedTime;
      ringRef.current.scale.set(1 + (t % 1.5) * 0.4, 1 + (t % 1.5) * 0.4, 1);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.45 * (1 - (t % 1.5) / 1.5);
    }
  });
  return (
    <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.5, 1.56, 32]} />
      <meshBasicMaterial color={activeColor} transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

const MixingPHPanel: React.FC = () => {
  const pH1 = useScadaStore((s) => getTank(s.equipments, 'tk-mixing')?.pH1);
  const pH2 = useScadaStore((s) => getTank(s.equipments, 'tk-mixing')?.pH2);
  return (
    <Html position={[-2, 2.4, 0]} center zIndexRange={[62, 0]} distanceFactor={18}>
      <div className="mixing-ph-panel-3d">
        <div className="mixing-ph-card-3d">
          <div className="mixing-ph-label-3d">pH1</div>
          <div className="digit-font mixing-ph-value-3d">{pH1?.toFixed(2) ?? '0.00'}</div>
        </div>
        <div className="mixing-ph-card-3d">
          <div className="mixing-ph-label-3d">pH2</div>
          <div className="digit-font mixing-ph-value-3d">{pH2?.toFixed(2) ?? '0.00'}</div>
        </div>
      </div>
    </Html>
  );
};

const OutfallInfoPanel: React.FC = () => {
  const pH = useScadaStore((s) => getTank(s.equipments, 'tk-outfall')?.pH);
  const alarmState = useScadaStore((s) => getTank(s.equipments, 'tk-outfall')?.alarmState);
  return (
    <Html position={[21.25, 1.02, 0.86]} center zIndexRange={[42, 0]} distanceFactor={24}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        pointerEvents: 'none',
        background: 'rgba(15, 23, 42, 0.72)',
        padding: '2px 4px',
        borderRadius: '4px',
        border: '1px solid rgba(56, 189, 248, 0.85)',
        boxShadow: '0 3px 8px rgba(0,0,0,0.24)',
        transform: 'scale(0.24)',
        transformOrigin: 'center',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 700 }}>管口 pH</span>
        <span className="digit-font" style={{ color: alarmState === 'critical' ? '#ef4444' : '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>
          {pH?.toFixed(2) ?? '7.00'}
        </span>
      </div>
    </Html>
  );
};

const OutfallProbeSign3D: React.FC = () => {
  const pH = useScadaStore((s) => getTank(s.equipments, 'tk-outfall')?.pH);
  const alarmState = useScadaStore((s) => getTank(s.equipments, 'tk-outfall')?.alarmState);
  const valueColor = alarmState === 'critical' ? '#ef4444' : '#4ade80';
  const texture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 44px Microsoft YaHei, SimHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('市政管口 pH', canvas.width / 2, 72);
    ctx.fillStyle = valueColor;
    ctx.font = 'bold 74px JetBrains Mono, Consolas, monospace';
    ctx.fillText((pH ?? 7).toFixed(2), canvas.width / 2, 158);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [pH, valueColor]);

  React.useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <group position={[0.78, 1.12, -0.52]}>
      <Billboard follow>
        <mesh castShadow>
          <planeGeometry args={[0.58, 0.28]} />
          <meshBasicMaterial map={texture ?? undefined} color={texture ? '#ffffff' : '#0f172a'} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
};

const OutfallDropNozzle3D: React.FC<{ active: boolean }> = ({ active }) => (
  <group position={[0, 0, 0]}>
    <mesh position={[0, OUTFALL_DROP_NOZZLE_Y, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.2, 0.2, 0.42, 28]} />
      <meshStandardMaterial color={PIPE_COLORS.treatedWater} roughness={0.48} metalness={0.08} />
    </mesh>
    <mesh position={[0, OUTFALL_DROP_NOZZLE_Y + 0.24, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.31, 0.31, 0.08, 32]} />
      <meshStandardMaterial color="#B6C2CC" roughness={0.36} metalness={0.68} />
    </mesh>
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <mesh
          key={`outfall-flange-bolt-${i}`}
          position={[Math.cos(a) * 0.26, OUTFALL_DROP_NOZZLE_Y + 0.29, Math.sin(a) * 0.26]}
          castShadow
        >
          <cylinderGeometry args={[0.025, 0.025, 0.035, 8]} />
          <meshStandardMaterial color="#64748b" roughness={0.42} metalness={0.8} />
        </mesh>
      );
    })}
    {active && (
      <mesh position={[0, OUTFALL_WATER_Y + 0.12, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 0.28, 16]} />
        <meshStandardMaterial color="#5A8FA8" transparent opacity={0.62} emissive="#1E3A45" emissiveIntensity={0.08} />
      </mesh>
    )}
  </group>
);

interface DeepTreatmentSectionProps {
  isInterRunning: boolean;
  isDrainRunning: boolean;
  mainFlowActive: boolean;
}

export const DeepTreatmentSection: React.FC<DeepTreatmentSectionProps> = ({ isDrainRunning }) => {
  const selectedId = useScadaStore((s) => s.selectedEquipmentId);
  const outfallAlarmState = useScadaStore((s) => getTank(s.equipments, 'tk-outfall')?.alarmState);

  return (
    <group position={DEEP_ORIGIN}>
      <Platform3D position={[0, 0, 0]} size={[46, 0.5, 12]} showRailings={false} />
      <Pump3D id="p-inter-1" position={INTER_PUMP_1} rotation={[0, Math.PI, 0]} />
      <Pump3D id="p-inter-2" position={INTER_PUMP_2} rotation={[0, Math.PI, 0]} />

      <DAFTank3D id="tk-daf" position={[-12, 0.5, 0]} size={[8, 2, 8]} />
      <Tank3D id="tk-mixing" position={[-2, 0.5, 0]} size={[6, 2, 6]} hasAgitator />
      <MixingPHPanel />
      <Tank3D id="tk-drainage" position={[7, 0.5, 0]} size={[6, 2, 6]} />

      <Pump3D id="p-drain-1" position={[12, 0.5, -2]} rotation={[0, Math.PI / 2, 0]} />
      <Pump3D id="p-drain-2" position={[12, 0.5, 2]} rotation={[0, Math.PI / 2, 0]} />

      <PulsingTargetRing
        position={[20, 0.02, 0]}
        activeColor={selectedId === 'tk-outfall' ? '#38bdf8' : outfallAlarmState === 'critical' ? '#ef4444' : PIPE_COLORS.treatedWater}
      />
      <mesh position={[20, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.45, 32]} />
        <meshBasicMaterial
          color={selectedId === 'tk-outfall' ? '#38bdf8' : outfallAlarmState === 'critical' ? '#ef4444' : PIPE_COLORS.treatedWater}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group
        position={[20, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          useScadaStore.getState().setSelectedEquipment('tk-outfall');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
          <boxGeometry args={[OUTFALL_POOL_W, 0.16, OUTFALL_POOL_D]} />
          <meshStandardMaterial color={selectedId === 'tk-outfall' ? '#dce6ef' : '#8D98A3'} roughness={0.78} />
        </mesh>
        <mesh position={[0, OUTFALL_POOL_WALL_H / 2, -OUTFALL_POOL_D / 2]} castShadow receiveShadow>
          <boxGeometry args={[OUTFALL_POOL_W, OUTFALL_POOL_WALL_H, OUTFALL_POOL_WALL_T]} />
          <meshStandardMaterial color="#A7B1BB" roughness={0.76} />
        </mesh>
        <mesh position={[0, OUTFALL_POOL_WALL_H / 2, OUTFALL_POOL_D / 2]} castShadow receiveShadow>
          <boxGeometry args={[OUTFALL_POOL_W, OUTFALL_POOL_WALL_H, OUTFALL_POOL_WALL_T]} />
          <meshStandardMaterial color="#A7B1BB" roughness={0.76} />
        </mesh>
        <mesh position={[-OUTFALL_POOL_W / 2, OUTFALL_POOL_WALL_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[OUTFALL_POOL_WALL_T, OUTFALL_POOL_WALL_H, OUTFALL_POOL_D]} />
          <meshStandardMaterial color="#A7B1BB" roughness={0.76} />
        </mesh>
        <mesh position={[OUTFALL_POOL_W / 2, OUTFALL_POOL_WALL_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[OUTFALL_POOL_WALL_T, OUTFALL_POOL_WALL_H, OUTFALL_POOL_D]} />
          <meshStandardMaterial color="#A7B1BB" roughness={0.76} />
        </mesh>
        <mesh position={[0, OUTFALL_WATER_Y, 0]}>
          <boxGeometry args={[OUTFALL_POOL_W - OUTFALL_POOL_WALL_T * 2.2, 0.08, OUTFALL_POOL_D - OUTFALL_POOL_WALL_T * 2.2]} />
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.5} roughness={0.08} metalness={0.05} clearcoat={0.65} />
        </mesh>
        <OutfallDropNozzle3D active={isDrainRunning} />
        <PoolLadder3D
          poolWidth={OUTFALL_POOL_W}
          poolHeight={OUTFALL_POOL_WALL_H + 0.12}
          poolDepth={OUTFALL_POOL_D}
          wallThickness={OUTFALL_POOL_WALL_T}
          wall="front"
          lateral={0.42}
        />
        {isDrainRunning && (
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 0.55, 12]} />
            <meshStandardMaterial color="#5A8FA8" transparent opacity={0.68} emissive="#1E3A45" emissiveIntensity={0.1} />
          </mesh>
        )}
        <group position={[0.62, 0.85, -0.28]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.72, 12]} />
            <meshStandardMaterial color="#1f2937" roughness={0.42} metalness={0.35} />
          </mesh>
          <mesh position={[0, -0.6, 0]} castShadow>
            <sphereGeometry args={[0.08, 16, 12]} />
            <meshStandardMaterial color={outfallAlarmState === 'critical' ? '#ef4444' : '#22c55e'} emissive={outfallAlarmState === 'critical' ? '#7f1d1d' : '#14532d'} emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <boxGeometry args={[0.18, 0.12, 0.1]} />
            <meshStandardMaterial color="#0f172a" roughness={0.45} metalness={0.25} />
          </mesh>
        </group>
        <OutfallProbeSign3D />
        {isDrainRunning && (
          <Sparkles count={20} scale={[0.8, 0.18, 0.8]} size={3} speed={1.5} position={[0, OUTFALL_WATER_Y + 0.05, 0]} color="#e0f2fe" opacity={0.8} />
        )}
      </group>

      <group position={[18, 0.5, 1.8]} rotation={[0, Math.PI / 4, 0]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[1.0, 0.1, 1.0]} />
          <meshStandardMaterial color="#5A6068" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.8, 1.0, 0.8]} />
          <meshStandardMaterial color="#8B9099" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.65, 0.41]}>
          <boxGeometry args={[0.5, 0.5, 0.02]} />
          <meshStandardMaterial color="#4A8A9A" emissive="#1A3A42" emissiveIntensity={0.15} />
        </mesh>
      </group>

      <OutfallInfoPanel />
    </group>
  );
};
