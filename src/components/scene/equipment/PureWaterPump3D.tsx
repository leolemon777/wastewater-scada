import React, { useRef } from 'react';
import * as THREE from 'three';
import { useCursor } from '@react-three/drei';
import { PumpIndicator3D } from '../shared/IndustrialParts';
import { useScadaStore, type PumpData } from '../../../store/useScadaStore';

interface PureWaterPump3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** 整机 scale,需与 pumpPorts 计算用的 scale 一致(默认 0.65,放大版)。 */
  scale?: number;
}

const STAINLESS = '#C5CDD4';
const STAINLESS_DARK = '#9AA4AD';
const HEAD_DARK = '#3E4752';

/**
 * 不锈钢立式多级离心泵(纯水房专用造型,与污水卧式蓝漆 Pump3D 区分)。
 * 端口锚点与 Pump3D 完全一致(吸 [0,0.78,-1.14]/排 [0,1.58,-0.78],
 * 整体 scale 0.5),保证 PureWaterSection 现有管路法兰面不断。
 * 形态:立式多级泵筒体 + 顶部立式电机 + 联轴器 + 不锈钢机座。
 */
export const PureWaterPump3D: React.FC<PureWaterPump3DProps> = ({ id, position, rotation = [0, 0, 0], scale = 0.65 }) => {
  const pumpData = useScadaStore((state) => state.equipments[id] as PumpData);
  // WP6.7：工控机运行模式禁用装饰微震，电机总成并入静态 bake。
  const performanceMode = useScadaStore((state) => state.performanceMode);
  const pureWaterConnectionState = useScadaStore((state) => state.pureWaterPlcConnection.state);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);
  // 对标 Pump3D:电机外壳静止(只微震),只有顶部风扇/转子旋转。
  // SPEC-PLAN WP1：runStatus 由 PLC Y 指令驱动（逻辑输出），不驱动风扇/微震动画；
  // refs 仅保留造型锚点，物理运行未验证时组件静止。
  const motorShakeRef = useRef<THREE.Group>(null);
  const fanRef = useRef<THREE.Group>(null);

  useCursor(hovered, 'pointer', 'auto');

  const telemetryIsCurrent = pureWaterConnectionState === 'live' || pureWaterConnectionState === 'demo';

  if (!pumpData) return null;

  const bodyColor = isSelected ? '#E2E8F0' : STAINLESS;
  const accentColor = isSelected ? '#38BDF8' : HEAD_DARK;
  // SPEC-PLAN WP1：Y 指令不得点亮"运行"灯；仅故障红与停止灰。
  const indicatorStatus: 'running' | 'stopped' | 'fault' =
    pumpData.runStatus === 'fault' ? 'fault' : 'stopped';

  return (
    <group position={position} rotation={rotation} userData={{ bakeExclude: !performanceMode }}>
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        position={[0, 1.0, 0]}
      >
        <cylinderGeometry args={[0.55, 0.55, 2.4, 12]} />
      </mesh>

      <group scale={[scale, scale, scale]}>
        <group>
          {/* 机座 */}
          <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[1.15, 0.2, 1.0]} />
            <meshStandardMaterial color={STAINLESS_DARK} roughness={0.45} metalness={0.55} />
          </mesh>
          {[-0.45, 0.45].flatMap((x) => [-0.38, 0.38].map((z) => (
            <mesh key={`basebolt-${x}-${z}`} castShadow position={[x, 0.22, z]}>
              <cylinderGeometry args={[0.045, 0.045, 0.06, 8]} />
              <meshStandardMaterial color="#7A848D" roughness={0.35} metalness={0.7} />
            </mesh>
          )))}

          {/* 吸入喷嘴(与 Pump3D 锚点一致) */}
          <group position={[0, 0.78, -1.14]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.165, 0.165, 0.32, 32]} />
              <meshStandardMaterial color={bodyColor} roughness={0.34} metalness={0.78} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, -0.018, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.04, 36]} />
              <meshStandardMaterial color={STAINLESS_DARK} roughness={0.36} metalness={0.82} />
            </mesh>
            {/* 外密封盘 — 对齐 Pump3D 几何,使吸入面世界坐标与 pumpPorts.ts 契约一致 */}
            <mesh castShadow receiveShadow position={[0, -0.047, 0]}>
              <cylinderGeometry args={[0.175, 0.175, 0.018, 32]} />
              <meshStandardMaterial color={STAINLESS_DARK} roughness={0.36} metalness={0.82} />
            </mesh>
          </group>
          {/* 排出喷嘴 */}
          <group position={[0, 1.58, -0.78]}>
            <mesh castShadow receiveShadow position={[0, -0.08, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.2, 32]} />
              <meshStandardMaterial color={bodyColor} roughness={0.34} metalness={0.78} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, 0.004, 0]}>
              <cylinderGeometry args={[0.224, 0.224, 0.04, 36]} />
              <meshStandardMaterial color={STAINLESS_DARK} roughness={0.36} metalness={0.82} />
            </mesh>
          </group>

          {/* 多级泵筒体 */}
          <mesh castShadow receiveShadow position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.34, 0.36, 1.4, 36]} />
            <meshStandardMaterial color={bodyColor} roughness={0.32} metalness={0.82} />
          </mesh>
          {[0.55, 0.95, 1.35].map((y, i) => (
            <mesh key={`stage-${i}`} castShadow receiveShadow position={[0, y, 0]}>
              <cylinderGeometry args={[0.37, 0.37, 0.045, 36]} />
              <meshStandardMaterial color={STAINLESS_DARK} roughness={0.4} metalness={0.78} />
            </mesh>
          ))}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
            <mesh key={`bodybolt-${i}`} castShadow position={[Math.sin(a) * 0.345, 0.95, Math.cos(a) * 0.345]} rotation={[0, a, 0]}>
              <boxGeometry args={[0.018, 1.3, 0.018]} />
              <meshStandardMaterial color="#6E7881" roughness={0.35} metalness={0.8} />
            </mesh>
          ))}

          <mesh castShadow receiveShadow position={[0, 0.27, 0]} scale={[1, 0.5, 1]}>
            <sphereGeometry args={[0.36, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={STAINLESS_DARK} roughness={0.36} metalness={0.8} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.66, 0]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[0.34, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={STAINLESS_DARK} roughness={0.36} metalness={0.8} />
          </mesh>

          {/* 联轴器 + 罩 */}
          <mesh castShadow receiveShadow position={[0, 1.85, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.18, 24]} />
            <meshStandardMaterial color={accentColor} roughness={0.5} metalness={0.45} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.85, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.24, 24, 1, true]} />
            <meshStandardMaterial color="#E5A020" roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>

          {/* 立式电机 — 静止外壳 + 微震(机座/泵筒体/联轴器不在此组,接口保持刚性) */}
          <group ref={motorShakeRef} position={[0, 0, 0]} userData={{ bakeExclude: !performanceMode }}>
            <mesh castShadow receiveShadow position={[0, 2.35, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.85, 36]} />
              <meshStandardMaterial color={accentColor} roughness={0.4} metalness={0.4} />
            </mesh>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <mesh key={`fin-${i}`} castShadow position={[Math.sin(a) * 0.345, 2.35, Math.cos(a) * 0.345]} rotation={[0, a, 0]}>
                  <boxGeometry args={[0.04, 0.78, 0.06]} />
                  <meshStandardMaterial color={STAINLESS_DARK} roughness={0.42} metalness={0.55} />
                </mesh>
              );
            })}
            <mesh castShadow receiveShadow position={[0, 2.82, 0]}>
              <cylinderGeometry args={[0.33, 0.32, 0.08, 36]} />
              <meshStandardMaterial color={STAINLESS_DARK} roughness={0.4} metalness={0.55} />
            </mesh>
            {/* 风扇罩(静止) */}
            <mesh castShadow receiveShadow position={[0, 2.95, 0]}>
              <cylinderGeometry args={[0.3, 0.32, 0.16, 24, 1, true]} />
              <meshStandardMaterial color="#4A535E" roughness={0.5} metalness={0.5} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 3.04, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.012, 24]} />
              <meshStandardMaterial color="#2A3138" roughness={0.6} metalness={0.4} />
            </mesh>
            {/* 接线盒 */}
            <group position={[0.36, 2.6, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.22, 0.22, 0.32]} />
                <meshStandardMaterial color={STAINLESS_DARK} roughness={0.42} metalness={0.5} />
              </mesh>
              <mesh castShadow position={[0.14, 0, 0]}>
                <boxGeometry args={[0.06, 0.12, 0.16]} />
                <meshStandardMaterial color="#1B1C1E" roughness={0.7} metalness={0.3} />
              </mesh>
            </group>
            {/* 顶部风扇/转子 — 运行时绕 Y 轴旋转 */}
            <group ref={fanRef} position={[0, 3.12, 0]} userData={{ bakeExclude: true }}>
              <mesh castShadow>
                <torusGeometry args={[0.07, 0.014, 8, 16]} />
                <meshStandardMaterial color="#7A8894" roughness={0.3} metalness={0.85} />
              </mesh>
              {/* 风扇叶片,让旋转可见 */}
              {Array.from({ length: 6 }, (_, i) => {
                const a = (i / 6) * Math.PI * 2;
                return (
                  <mesh key={`blade-${i}`} castShadow position={[Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]} rotation={[Math.PI / 2, 0, a]}>
                    <boxGeometry args={[0.008, 0.11, 0.022]} />
                    <meshStandardMaterial color="#5A6470" roughness={0.4} metalness={0.7} />
                  </mesh>
                );
              })}
            </group>
          </group>

          {/* 压力表 */}
          <group position={[0.42, 1.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.07, 0.07, 0.05, 20]} />
              <meshStandardMaterial color={STAINLESS_DARK} roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh position={[0.026, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.006, 20]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.2} metalness={0.1} />
            </mesh>
          </group>

          {telemetryIsCurrent && <PumpIndicator3D position={[-0.4, 1.5, 0.2]} status={indicatorStatus} />}

          <mesh position={[0, 1.0, 0.355]}>
            <boxGeometry args={[0.42, 0.14, 0.006]} />
            <meshStandardMaterial color="#E8EDF1" roughness={0.3} metalness={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
