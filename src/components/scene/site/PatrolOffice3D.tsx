import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useScadaStore } from '../../../store/useScadaStore';
import { getTank } from '../../../store/equipmentUtils';
import {
  PATROL_OFFICE_ORIGIN,
  PATROL_OFFICE_SIZE,
} from './patrolOfficeLayout';

interface PatrolOffice3DProps {
  isNight?: boolean;
}

const WALL_T = 0.14;
const DOOR_W = 1.6;
const DOOR_H = 2.2;

const OfficeStatusPanel: React.FC<{ side: 'rear' | 'east' | 'west' }> = ({ side }) => {
  const totalInflow = useScadaStore((s) => s.totalInflow);
  const totalOutflow = useScadaStore((s) => s.totalOutflow);
  const totalPower = useScadaStore((s) => s.totalPower);
  const alarms = useScadaStore((s) => s.alarms);
  const equipments = useScadaStore((s) => s.equipments);
  const patrolLogs = useScadaStore((s) => s.patrolLogs);

  const unacked = alarms.filter((a) => !a.acknowledged).length;
  const onlineCount = useMemo(
    () =>
      Object.values(equipments).filter(
        (equipment) => 'runStatus' in equipment && equipment.runStatus === 'running',
      ).length,
    [equipments],
  );
  const totalCount = Object.keys(equipments).length;
  const ph1 = getTank(equipments, 'tk-ph1')?.pH;
  const clarifierLevel = getTank(equipments, 'tk-clarifier')?.levelValue;

  const sideTitle =
    side === 'rear' ? '厂区运行 KPI' : side === 'east' ? '水质 · 液位' : '巡检 · 告警';

  return (
    <div className="patrol-office-status panel-solid" style={{ minWidth: side === 'rear' ? 220 : 190 }}>
      <div className="patrol-office-status__title">{sideTitle}</div>
      {side === 'rear' && (
        <div className="patrol-office-status__grid">
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">进水流量</span>
            <span className="patrol-office-status__value digit-font">{totalInflow.toFixed(1)} m³/h</span>
          </div>
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">出水流量</span>
            <span className="patrol-office-status__value digit-font">{totalOutflow.toFixed(1)} m³/h</span>
          </div>
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">总电耗</span>
            <span className="patrol-office-status__value digit-font">{totalPower.toFixed(0)} kW</span>
          </div>
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">设备在线</span>
            <span className="patrol-office-status__value digit-font">
              {onlineCount}/{totalCount}
            </span>
          </div>
        </div>
      )}
      {side === 'east' && (
        <div className="patrol-office-status__grid">
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">调节池 pH</span>
            <span className="patrol-office-status__value digit-font">
              {ph1 !== undefined ? ph1.toFixed(2) : '—'}
            </span>
          </div>
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">沉淀池液位</span>
            <span className="patrol-office-status__value digit-font">
              {clarifierLevel !== undefined ? `${clarifierLevel.toFixed(2)} m` : '—'}
            </span>
          </div>
          <div className="patrol-office-status__item patrol-office-status__item--wide">
            <span className="patrol-office-status__label">处理负荷</span>
            <span className="patrol-office-status__value digit-font">
              {totalInflow > 0 ? `${((totalOutflow / totalInflow) * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
        </div>
      )}
      {side === 'west' && (
        <div className="patrol-office-status__grid">
          <div className="patrol-office-status__item">
            <span className="patrol-office-status__label">未确认告警</span>
            <span
              className="patrol-office-status__value digit-font"
              style={{ color: unacked > 0 ? '#f87171' : '#4ade80' }}
            >
              {unacked}
            </span>
          </div>
          <div className="patrol-office-status__item patrol-office-status__item--wide">
            <span className="patrol-office-status__label">最近巡检</span>
            <span className="patrol-office-status__log">
              {patrolLogs[0] ? patrolLogs[0].slice(11, 48) + '…' : '等待巡检上报…'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Patrol duty office — north-facing entry (+Z direction, faces the default camera).
 * Gabled roof, facade pilasters, horizontal window ribbon, prominent entry canopy,
 * AC outdoor units on the rear (south) wall.
 */
export const PatrolOffice3D: React.FC<PatrolOffice3DProps> = ({ isNight = false }) => {
  const [w, h, d] = PATROL_OFFICE_SIZE;

  // Colour palette
  const wallColor   = isNight ? '#BFC6D0' : '#D9E2EC';
  const baseColor   = isNight ? '#8A9099' : '#A8B4C0';
  const roofColor   = isNight ? '#3B4655' : '#506070';
  const ridgeCap    = isNight ? '#2E3847' : '#3D4F60';
  const pillarColor = isNight ? '#CBD5E1' : '#EEF2F7';
  const trimColor   = isNight ? '#94A3B8' : '#B0BBC8';
  const windowColor = isNight ? '#5A8FBF' : '#8FC7E8';
  const doorFrColor = '#334155';
  const doorLeafCol = '#1A2535';
  const glassColor  = isNight ? '#7DD3FC' : '#BAE6FD';
  const acColor     = '#64748B';

  // +Z = north (faces camera) ← ENTRY DOOR side
  // -Z = south (rear)
  const frontZ = d / 2;    // north / front face — door here
  const rearZ  = -d / 2;   // south / rear face

  const sideWallW = (w - DOOR_W) / 2;
  const lintelH   = Math.max(0.18, h - DOOR_H);
  const roofRise  = 0.65;
  const statusY   = h + roofRise + 0.55;

  const wallMat = { color: wallColor, roughness: 0.70, metalness: 0.06 };

  return (
    <group position={PATROL_OFFICE_ORIGIN}>

      {/* ── FOUNDATION / PLINTH ── */}
      <mesh position={[0, 0.10, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.60, 0.20, d + 0.60]} />
        <meshStandardMaterial color={baseColor} roughness={0.88} metalness={0.04} />
      </mesh>

      {/* ── LOWER CLADDING BAND ── */}
      <mesh position={[0, 0.50, 0]} castShadow>
        <boxGeometry args={[w + 0.04, 1.00, d + 0.04]} />
        <meshStandardMaterial color={baseColor} roughness={0.82} metalness={0.04} />
      </mesh>

      {/* ── PERIMETER WALLS ── */}
      {/* Rear wall (solid, −Z) */}
      <mesh position={[0, h / 2, rearZ]} castShadow receiveShadow>
        <boxGeometry args={[w, h, WALL_T]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* East wall */}
      <mesh position={[w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_T, h, d]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* West wall */}
      <mesh position={[-w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_T, h, d]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Front wall — left panel (split for door opening, +Z face) */}
      <mesh position={[-(DOOR_W / 2 + sideWallW / 2), h / 2, frontZ]} castShadow receiveShadow>
        <boxGeometry args={[sideWallW, h, WALL_T]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Front wall — right panel */}
      <mesh position={[DOOR_W / 2 + sideWallW / 2, h / 2, frontZ]} castShadow receiveShadow>
        <boxGeometry args={[sideWallW, h, WALL_T]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Front wall — lintel above door */}
      <mesh position={[0, DOOR_H + lintelH / 2, frontZ]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_W, lintelH, WALL_T]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>

      {/* Interior floor */}
      <mesh position={[0, 0.14, 0.06]} receiveShadow>
        <boxGeometry args={[w - WALL_T * 2.4, 0.06, d - WALL_T * 2.4]} />
        <meshStandardMaterial color="#C8CDD4" roughness={0.80} metalness={0.02} />
      </mesh>

      {/* ── FACADE PILASTERS on front (+Z) face ── */}
      {([-w / 2 + 0.18, -DOOR_W / 2 - 0.18, DOOR_W / 2 + 0.18, w / 2 - 0.18] as number[]).map((x, i) => (
        <mesh key={i} position={[x, h / 2, frontZ + 0.12]} castShadow>
          <boxGeometry args={[0.22, h + 0.06, 0.22]} />
          <meshStandardMaterial color={pillarColor} roughness={0.62} metalness={0.08} />
        </mesh>
      ))}

      {/* ── HORIZONTAL WINDOW RIBBON — front face (flanking door) ── */}
      {([-3.6, -2.4, 2.4, 3.6] as number[]).map((x, i) => (
        <group key={i} position={[x, h * 0.62, frontZ + 0.06]}>
          <mesh castShadow>
            <boxGeometry args={[0.90, 0.62, 0.10]} />
            <meshStandardMaterial color={trimColor} roughness={0.55} metalness={0.10} />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <boxGeometry args={[0.76, 0.48, 0.04]} />
            <meshStandardMaterial
              color={windowColor} roughness={0.16} metalness={0.38}
              transparent opacity={0.82}
              emissive={isNight ? '#1B3A5E' : '#000000'}
              emissiveIntensity={isNight ? 0.5 : 0}
            />
          </mesh>
        </group>
      ))}

      {/* ── REAR WALL WINDOWS (4 standard, -Z face) ── */}
      {Array.from({ length: 4 }).map((_, i) => {
        const x = -w / 2 + 1.6 + i * ((w - 3.2) / 3);
        return (
          <group key={i} position={[x, h * 0.58, rearZ - 0.06]}>
            <mesh castShadow>
              <boxGeometry args={[1.10, 0.70, 0.10]} />
              <meshStandardMaterial color={trimColor} roughness={0.55} metalness={0.10} />
            </mesh>
            <mesh position={[0, 0, -0.07]}>
              <boxGeometry args={[0.96, 0.56, 0.04]} />
              <meshStandardMaterial
                color={windowColor} roughness={0.16} metalness={0.38}
                transparent opacity={0.82}
                emissive={isNight ? '#1B3A5E' : '#000000'}
                emissiveIntensity={isNight ? 0.45 : 0}
              />
            </mesh>
          </group>
        );
      })}

      {/* ── CORNICE BAND ── */}
      <mesh position={[0, h + 0.04, 0]} castShadow>
        <boxGeometry args={[w + 0.28, 0.10, d + 0.28]} />
        <meshStandardMaterial color={trimColor} roughness={0.55} metalness={0.10} />
      </mesh>

      {/* ── GABLED ROOF ── */}
      {/* Front slope (+Z side) */}
      <mesh
        position={[0, h + roofRise / 2 + 0.08, d / 4]}
        rotation={[Math.atan2(roofRise, d / 2), 0, 0]}
        castShadow receiveShadow
      >
        <boxGeometry args={[w + 0.36, 0.10, Math.sqrt((d / 2) ** 2 + roofRise ** 2) + 0.22]} />
        <meshStandardMaterial color={roofColor} roughness={0.50} metalness={0.20} />
      </mesh>
      {/* Rear slope (-Z side) */}
      <mesh
        position={[0, h + roofRise / 2 + 0.08, -d / 4]}
        rotation={[-Math.atan2(roofRise, d / 2), 0, 0]}
        castShadow receiveShadow
      >
        <boxGeometry args={[w + 0.36, 0.10, Math.sqrt((d / 2) ** 2 + roofRise ** 2) + 0.22]} />
        <meshStandardMaterial color={roofColor} roughness={0.50} metalness={0.20} />
      </mesh>
      {/* Gable triangles (east + west) */}
      {([-1, 1] as const).map((side, i) => (
        <mesh key={i} position={[(w / 2 + 0.06) * side, h + roofRise / 3 + 0.08, 0]} castShadow>
          <boxGeometry args={[0.12, roofRise * 0.85, d * 0.72]} />
          <meshStandardMaterial color={wallColor} roughness={0.70} metalness={0.06} />
        </mesh>
      ))}
      {/* Ridge cap */}
      <mesh position={[0, h + roofRise + 0.12, 0]} castShadow>
        <boxGeometry args={[w + 0.44, 0.14, 0.26]} />
        <meshStandardMaterial color={ridgeCap} roughness={0.44} metalness={0.24} />
      </mesh>

      {/* ── FRONT ENTRY CANOPY (+Z face) ── */}
      {/* Two load-bearing columns */}
      <mesh position={[-0.75, h * 0.46, frontZ + 0.65]} castShadow>
        <boxGeometry args={[0.18, h * 0.92, 0.18]} />
        <meshStandardMaterial color={pillarColor} roughness={0.60} metalness={0.10} />
      </mesh>
      <mesh position={[0.75, h * 0.46, frontZ + 0.65]} castShadow>
        <boxGeometry args={[0.18, h * 0.92, 0.18]} />
        <meshStandardMaterial color={pillarColor} roughness={0.60} metalness={0.10} />
      </mesh>
      {/* Canopy slab */}
      <mesh position={[0, h - 0.08, frontZ + 0.42]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_W + 1.30, 0.12, 0.90]} />
        <meshStandardMaterial color={trimColor} roughness={0.48} metalness={0.14} />
      </mesh>
      {/* Canopy fascia */}
      <mesh position={[0, h - 0.20, frontZ + 0.87]} castShadow>
        <boxGeometry args={[DOOR_W + 1.30, 0.26, 0.08]} />
        <meshStandardMaterial color={baseColor} roughness={0.60} metalness={0.10} />
      </mesh>

      {/* ── DOOR FRAME (front face, +Z) ── */}
      <mesh position={[0, DOOR_H + 0.07, frontZ + 0.06]} castShadow>
        <boxGeometry args={[DOOR_W + 0.24, 0.14, 0.12]} />
        <meshStandardMaterial color={doorFrColor} roughness={0.42} metalness={0.22} />
      </mesh>
      {/* Left jamb */}
      <mesh position={[-DOOR_W / 2 - 0.06, DOOR_H / 2, frontZ + 0.06]} castShadow>
        <boxGeometry args={[0.12, DOOR_H, 0.14]} />
        <meshStandardMaterial color={doorFrColor} roughness={0.42} metalness={0.22} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[DOOR_W / 2 + 0.06, DOOR_H / 2, frontZ + 0.06]} castShadow>
        <boxGeometry args={[0.12, DOOR_H, 0.14]} />
        <meshStandardMaterial color={doorFrColor} roughness={0.42} metalness={0.22} />
      </mesh>

      {/* ── DOUBLE GLASS DOORS (slightly open, north-facing / +Z) ── */}
      <group position={[0, DOOR_H / 2 + 0.06, frontZ + 0.10]}>
        {/* Left leaf */}
        <group rotation={[0, -0.20, 0]}>
          <mesh position={[-DOOR_W / 4, 0, 0]} castShadow>
            <boxGeometry args={[DOOR_W / 2 - 0.08, DOOR_H - 0.14, 0.06]} />
            <meshStandardMaterial color={doorLeafCol} roughness={0.52} metalness={0.18} />
          </mesh>
          <mesh position={[-DOOR_W / 4, 0, -0.04]}>
            <boxGeometry args={[DOOR_W / 2 - 0.20, DOOR_H - 0.36, 0.03]} />
            <meshStandardMaterial
              color={glassColor} roughness={0.10} metalness={0.38}
              transparent opacity={0.70}
              emissive={isNight ? '#0EA5E9' : '#000000'}
              emissiveIntensity={isNight ? 0.30 : 0}
            />
          </mesh>
        </group>
        {/* Right leaf */}
        <group rotation={[0, 0.20, 0]}>
          <mesh position={[DOOR_W / 4, 0, 0]} castShadow>
            <boxGeometry args={[DOOR_W / 2 - 0.08, DOOR_H - 0.14, 0.06]} />
            <meshStandardMaterial color={doorLeafCol} roughness={0.52} metalness={0.18} />
          </mesh>
          <mesh position={[DOOR_W / 4, 0, -0.04]}>
            <boxGeometry args={[DOOR_W / 2 - 0.20, DOOR_H - 0.36, 0.03]} />
            <meshStandardMaterial
              color={glassColor} roughness={0.10} metalness={0.38}
              transparent opacity={0.70}
              emissive={isNight ? '#0EA5E9' : '#000000'}
              emissiveIntensity={isNight ? 0.30 : 0}
            />
          </mesh>
        </group>
      </group>

      {/* ── THRESHOLD STEP + RAMP (front / +Z) ── */}
      <mesh position={[0, 0.14, frontZ + 0.30]} receiveShadow castShadow>
        <boxGeometry args={[DOOR_W + 0.60, 0.08, 0.44]} />
        <meshStandardMaterial color="#94A3B8" roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.06, frontZ + 0.62]} receiveShadow>
        <boxGeometry args={[DOOR_W + 1.00, 0.04, 0.60]} />
        <meshStandardMaterial color="#64748B" roughness={0.90} metalness={0.02} />
      </mesh>

      {/* ── AC OUTDOOR UNITS on rear (−Z) wall ── */}
      {([-2.8, 0, 2.8] as number[]).map((x, i) => (
        <group key={i} position={[x, h * 0.35, rearZ - 0.22]}>
          <mesh castShadow>
            <boxGeometry args={[0.70, 0.58, 0.32]} />
            <meshStandardMaterial color={acColor} roughness={0.62} metalness={0.30} />
          </mesh>
          <mesh position={[0, 0, -0.17]}>
            <cylinderGeometry args={[0.22, 0.22, 0.06, 12]} />
            <meshStandardMaterial color="#374151" roughness={0.70} metalness={0.20} />
          </mesh>
          <mesh position={[0, -0.36, 0]} castShadow>
            <boxGeometry args={[0.60, 0.08, 0.26]} />
            <meshStandardMaterial color="#4B5563" roughness={0.70} metalness={0.26} />
          </mesh>
        </group>
      ))}

      {/* ── NIGHT GLOW ── */}
      {isNight && (
        <mesh position={[0, h * 0.45, 0]}>
          <boxGeometry args={[w - WALL_T * 2, 0.02, d - WALL_T * 2]} />
          <meshBasicMaterial color="#FFF9E6" transparent opacity={0.15} />
        </mesh>
      )}

      {/* ── HTML LABELS ── */}
      {/* Entry sign — front (+Z) face */}
      <Html position={[0, DOOR_H + 0.40, frontZ + 0.70]} center distanceFactor={16} zIndexRange={[40, 0]}>
        <div className="patrol-office-sign patrol-office-sign--entry">入口 · 巡检员休息</div>
      </Html>

      {/* KPI panel — rear (−Z) face */}
      <Html position={[0, statusY, rearZ - 0.30]} center distanceFactor={14} zIndexRange={[40, 0]}>
        <OfficeStatusPanel side="rear" />
      </Html>
      {/* East panel */}
      <Html position={[w / 2 + 0.40, statusY - 0.20, 0]} center distanceFactor={14} zIndexRange={[40, 0]}>
        <OfficeStatusPanel side="east" />
      </Html>
      {/* West panel */}
      <Html position={[-w / 2 - 0.40, statusY - 0.20, 0]} center distanceFactor={14} zIndexRange={[40, 0]}>
        <OfficeStatusPanel side="west" />
      </Html>

      {/* Building sign — above ridge */}
      <Html position={[0, h + roofRise + 0.80, 0]} center distanceFactor={13} zIndexRange={[70, 0]}>
        <div className="site-building-sign site-building-sign--office">
          <span>运维值班室</span>
          <small>DUTY OFFICE</small>
        </div>
      </Html>
    </group>
  );
};
