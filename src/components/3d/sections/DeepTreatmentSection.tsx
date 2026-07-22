import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html, Sparkles } from '@react-three/drei';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { PIPE_COLORS } from '../pipes/pipeRouting';
import { Platform3D } from '../site/Platform3D';
import { DAFTank3D } from '../equipment/DAFTank3D';
import { useScadaStore } from '../../../store/useScadaStore';
import { getTank } from '../../../store/equipmentUtils';
import { PoolLadder3D } from '../site/PoolLadder3D';

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
    {/* The single top flange is supplied by ProcessAndSludgePipeNetwork3D at
        the exact nozzle endpoint. Keeping it in one place avoids stacked discs. */}
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

      {/* ── 标准化排污口自动监测站 / 环保检测中心 ── */}
      <group position={[16.5, 0.5, 2.5]}>
        {/* 1. 监测房基础地板 */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.1, 2.6]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>

        {/* 2. 钢架立柱 */}
        <mesh position={[-1.55, 1.15, 1.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 2.2, 0.08]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[1.55, 1.15, 1.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 2.2, 0.08]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[-1.55, 1.15, -1.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 2.2, 0.08]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[1.55, 1.15, -1.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 2.2, 0.08]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* 3. 房顶 */}
        <mesh position={[0, 2.3, 0]} castShadow>
          <boxGeometry args={[3.3, 0.15, 2.7]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* 4. 钢化玻璃墙体 */}
        <mesh position={[-1.58, 1.15, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.46, 2.2]} />
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.15} roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.1} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[1.58, 1.15, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.46, 2.2]} />
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.15} roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.1} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.15, 1.28]} rotation={[0, 0, 0]}>
          <planeGeometry args={[3.06, 2.2]} />
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.1} roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.1} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.15, -1.28]} rotation={[0, 0, 0]}>
          <planeGeometry args={[3.06, 2.2]} />
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.1} roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.1} side={THREE.DoubleSide} />
        </mesh>

        {/* 5. 在线监测分析仪柜 */}
        {/* 5.1 在线监测柜 A (pH/COD 自动分析仪) */}
        <group position={[-0.7, 0.1, -0.3]}>
          <mesh castShadow receiveShadow position={[0, 0.8, 0]}>
            <boxGeometry args={[0.65, 1.6, 0.55]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.1, 0.28]}>
            <planeGeometry args={[0.48, 0.35]} />
            <meshStandardMaterial color="#020617" roughness={0.08} metalness={0.9} />
          </mesh>
          <Html position={[0, 1.1, 0.29]} center transform distanceFactor={3.5} zIndexRange={[45, 0]}>
            <div style={{
              color: '#34d399', fontFamily: 'monospace', fontSize: '6px',
              textShadow: '0 0 4px #34d399', textAlign: 'left', width: '70px',
              background: 'rgba(2, 6, 23, 0.85)', padding: '3px', borderRadius: '2px',
              border: '1px solid #1e293b', pointerEvents: 'none', lineHeight: '1.2'
            }}>
              <div style={{ color: '#94a3b8', fontSize: '4px', borderBottom: '1px solid #334155', paddingBottom: '1px', marginBottom: '2px' }}>COD / pH MONITOR</div>
              <div>COD: <span className="digit-font">24.8</span> <span style={{fontSize:'4px'}}>mg/L</span></div>
              <div>pH:  <span className="digit-font">7.22</span></div>
              <div style={{ fontSize: '4px', color: '#10b981', marginTop: '2px' }}>● 状态: 正常运行</div>
            </div>
          </Html>
        </group>

        {/* 5.2 在线监测柜 B (氨氮 / 总磷分析仪) */}
        <group position={[0.1, 0.1, -0.3]}>
          <mesh castShadow receiveShadow position={[0, 0.8, 0]}>
            <boxGeometry args={[0.65, 1.6, 0.55]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.1, 0.28]}>
            <planeGeometry args={[0.48, 0.35]} />
            <meshStandardMaterial color="#020617" roughness={0.08} metalness={0.9} />
          </mesh>
          <Html position={[0, 1.1, 0.29]} center transform distanceFactor={3.5} zIndexRange={[45, 0]}>
            <div style={{
              color: '#60a5fa', fontFamily: 'monospace', fontSize: '6px',
              textShadow: '0 0 4px #60a5fa', textAlign: 'left', width: '70px',
              background: 'rgba(2, 6, 23, 0.85)', padding: '3px', borderRadius: '2px',
              border: '1px solid #1e293b', pointerEvents: 'none', lineHeight: '1.2'
            }}>
              <div style={{ color: '#94a3b8', fontSize: '4px', borderBottom: '1px solid #334155', paddingBottom: '1px', marginBottom: '2px' }}>NH3-N / TP MONITOR</div>
              <div>NH3: <span className="digit-font">0.85</span> <span style={{fontSize:'4px'}}>mg/L</span></div>
              <div>TP:  <span className="digit-font">0.12</span> <span style={{fontSize:'4px'}}>mg/L</span></div>
              <div style={{ fontSize: '4px', color: '#10b981', marginTop: '2px' }}>● 状态: 正常运行</div>
            </div>
          </Html>
        </group>

        {/* 6. 水质自动采样器 */}
        <group position={[-0.8, 0.1, 0.6]}>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.8, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.1, 24]} />
            <meshStandardMaterial color="#0284c7" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.5, 0.21]} castShadow>
            <boxGeometry args={[0.16, 0.2, 0.02]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>

        {/* 7. 中控数据数采仪及工作台 */}
        <group position={[0.9, 0.1, 0.5]} rotation={[0, -Math.PI / 6, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.7, 0.5]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <boxGeometry args={[0.84, 0.04, 0.54]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.42, 0.32, 0.04]} />
            <meshStandardMaterial color="#020617" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.81, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.14, 8]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
          </mesh>
          <Html position={[0, 0.95, 0.025]} center transform distanceFactor={3.0} zIndexRange={[45, 0]}>
            <div style={{
              color: '#38bdf8', fontFamily: 'monospace', fontSize: '5px',
              textAlign: 'left', width: '64px', height: '48px',
              background: 'rgba(15, 23, 42, 0.9)', padding: '2px', borderRadius: '1px',
              border: '1px solid #0f172a', pointerEvents: 'none', lineHeight: '1.2',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '3px', color: '#64748b' }}>数采传输仪 (RTU-301)</div>
                <div style={{ fontSize: '3px', color: '#4ade80' }}>● 数据上传中 (ONLINE)</div>
              </div>
              <div style={{ fontSize: '3.5px', color: '#e2e8f0', borderTop: '1px solid #334155', paddingTop: '1px' }}>
                <div>累计排放: <span className="digit-font" style={{color:'#f59e0b'}}>40827</span> m³</div>
                <div>当前流速: <span className="digit-font" style={{color:'#38bdf8'}}>51.2</span> m³/h</div>
              </div>
            </div>
          </Html>
        </group>
      </group>

      {/* ── 8. 标准环境保护图形标志牌 ── */}
      <group position={[19.0, 0.5, 2.2]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 1.6, 12]} />
          <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.03]} />
          <meshStandardMaterial color="#15803d" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.5, -0.02]}>
          <boxGeometry args={[0.74, 0.54, 0.015]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
        <Html position={[0, 1.5, 0.018]} center transform distanceFactor={4} zIndexRange={[45, 0]}>
          <div style={{
            background: '#ffffff', color: '#1f2937', padding: '3px 4px',
            borderRadius: '2px', border: '1px solid #166534',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: '84px', height: '58px', boxSizing: 'border-box',
            pointerEvents: 'none', userSelect: 'none'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              borderBottom: '1.5px solid #166534', width: '100%',
              paddingBottom: '2px', justifyContent: 'center'
            }}>
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#166534', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#ffffff', fontSize: '8px', fontWeight: 'bold'
              }}>
                水
              </div>
              <div style={{ fontSize: '5px', fontWeight: 'bold', color: '#166534', letterSpacing: '0.5px' }}>
                废 水 排 放 口
              </div>
            </div>
            <div style={{
              fontSize: '3.5px', color: '#374151', alignSelf: 'stretch',
              marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '1px'
            }}>
              <div><strong>排放口编号：</strong>DW-001</div>
              <div><strong>排放口名称：</strong>标准化总排口</div>
              <div><strong>主要污染物：</strong>pH, COD, 氨氮</div>
              <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: '1px', marginTop: '1px', fontSize: '3px', color: '#9ca3af', textAlign: 'center' }}>
                中华人民共和国生态环境部监制
              </div>
            </div>
          </div>
        </Html>
      </group>

      <OutfallInfoPanel />
    </group>
  );
};
