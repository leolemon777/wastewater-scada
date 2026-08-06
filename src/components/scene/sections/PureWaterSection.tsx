/**
 * 纯水(二级 RO)工艺段 — 室外三组团布置,与污水系统完全独立(pw-*)。
 *
 * 三个紧凑组团,首尾相接、水流短捷(见 pureWaterLayout.ts):
 *   预处理排(北):原水箱 → 原水泵 → 保安① → 碳柱 → 一级进水阀 → 保安②
 *   一级 RO 撬:R01泵 + 一级膜(共用底座)→ R01水箱
 *   二级 RO 撬 + 供水:R02泵A/B → 二级膜 → R02水箱 → 供水泵A/B → 用水点
 *
 * 区域护栏围住整个纯水工段(东边留通道口对厂区);供水出口高位管加门型
 * 管架;膜前管子用原水灰、过膜变青("灰进青出")。
 * 第一版不做浓水管;压力/流量/电导率测点预留。
 */
import React from 'react';
import { Pipe3D } from '../piping/Pipe3D';
import { PipeOpenFlange3D } from '../piping/PipeOpenFlange3D';
import { PipeWallPort3D } from '../piping/PipeWallPort3D';
import { ConvergingHeader3D } from '../piping/ConvergingHeader3D';
import { PumpPipeFlanges3D } from '../piping/PumpPipeFlanges3D';
import { PumpPipeReducer3D } from '../piping/PumpPipeReducer3D';
import { PIPE_COLORS } from '../piping/pipeRouting';
import {
  getDischargeFacePoint,
  getSuctionFacePoint,
  getSuctionDirection,
  getDischargeDirection,
  PUMP_FACE_SEAT,
} from '../piping/pumpPorts';
import { PureWaterPump3D } from '../equipment/PureWaterPump3D';
import { Valve3D } from '../equipment/Valve3D';
import { ChemicalTank3D } from '../equipment/ChemicalTank3D';
import { ChemicalMeteringPump3D } from '../equipment/ChemicalMeteringPump3D';
import { CartridgeFilter3D } from '../equipment/CartridgeFilter3D';
import { CarbonColumn3D } from '../equipment/CarbonColumn3D';
import { RoMembraneRack3D } from '../equipment/RoMembraneRack3D';
import { Platform3D } from '../site/Platform3D';
import { SkidFrame3D } from '../shared/SkidFrame3D';
import {
  PW_TANKS,
  PW_PUMPS,
  PW_UNITS,
  PW_VALVES,
  PW_DOSE_PUMPS,
  PW_STAGE1_Z,
  PW_STAGE2_Z,
  PW_RAW_ENTRY_X,
  PW_PURE_EXIT_X,
  PW_MAIN_R,
  PW_BRANCH_R,
  PW_HEADER_R,
  PW_FLUSH_R,
  PW_DOSE_R,
  PW_GUARD,
  PW_PUMP_SCALE,
  PW_PERMEATE_HIGH_Y,
  PW_SUCTION_HEADER_Y,
  PW_DISCHARGE_HEADER_Y,
  PW_HEADER_END_CLEARANCE,
} from './pureWaterLayout';
import {
  getCartridgePort,
  getCarbonPort,
  getMembranePort,
  getTankPort,
} from './pureWaterPorts';

type Point = [number, number, number];

const FEED = PIPE_COLORS.pwFeed;
const PERMEATE = PIPE_COLORS.pwPermeate;
const GUARD_COLOR = '#C98A1B';
const GUARD_POST = '#8A6D2F';

/** 地漏(冲洗排放终点)。 */
const FloorDrain3D: React.FC<{ position: Point }> = ({ position }) => (
  <group position={position}>
    <mesh receiveShadow castShadow position={[0, 0.02, 0]}>
      <boxGeometry args={[0.5, 0.05, 0.5]} />
      <meshStandardMaterial color="#8B969E" roughness={0.78} metalness={0.06} />
    </mesh>
    <mesh receiveShadow position={[0, 0.052, 0]}>
      <boxGeometry args={[0.4, 0.012, 0.4]} />
      <meshStandardMaterial color="#3A434B" roughness={0.6} metalness={0.4} />
    </mesh>
    {[-0.12, -0.04, 0.04, 0.12].map((x) => (
      <mesh key={`drain-bar-${x}`} position={[x, 0.062, 0]}>
        <boxGeometry args={[0.028, 0.012, 0.36]} />
        <meshStandardMaterial color="#9AA4AD" roughness={0.45} metalness={0.6} />
      </mesh>
    ))}
  </group>
);

/** 一条工艺线/撬块的长条设备基础带。 */
const EquipmentPad3D: React.FC<{ center: Point; size: [number, number, number] }> = ({ center, size }) => (
  <mesh position={center} receiveShadow castShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color="#B9C2C8" roughness={0.84} metalness={0.04} />
  </mesh>
);

/** 门型管架(高位管的中间支撑,学污水区高位药剂管廊)。 */
const PipeRackPortal3D: React.FC<{ position: Point; height: number }> = ({ position, height }) => (
  <group position={position}>
    {[-0.5, 0.5].map((z) => (
      <mesh key={`rack-leg-${z}`} castShadow receiveShadow position={[0, height / 2, z]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color={GUARD_POST} roughness={0.55} metalness={0.3} />
      </mesh>
    ))}
    <mesh castShadow receiveShadow position={[0, height - 0.05, 0]}>
      <boxGeometry args={[0.14, 0.1, 1.24]} />
      <meshStandardMaterial color={GUARD_COLOR} roughness={0.5} metalness={0.28} />
    </mesh>
  </group>
);

/** 区域安全护栏单边(立柱 + 两道横杆)。 */
const GuardRun3D: React.FC<{
  from: Point;
  to: Point;
}> = ({ from, to }) => {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const count = Math.max(2, Math.round(len / 2.2) + 1);
  const posts = Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0 : i / (count - 1);
    return [from[0] + dx * t, 0, from[2] + dz * t] as Point;
  });
  const mid: Point = [(from[0] + to[0]) / 2, 0, (from[2] + to[2]) / 2];
  const angle = Math.atan2(dz, dx);
  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={`guard-post-${i}`} castShadow receiveShadow position={[p[0], 0.55, p[2]]}>
          <boxGeometry args={[0.09, 1.1, 0.09]} />
          <meshStandardMaterial color={GUARD_POST} roughness={0.55} metalness={0.3} />
        </mesh>
      ))}
      {[0.62, 1.0].map((y) => (
        <mesh key={`guard-rail-${y}`} castShadow receiveShadow position={[mid[0], y, mid[2]]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[len, 0.07, 0.05]} />
          <meshStandardMaterial color={GUARD_COLOR} roughness={0.5} metalness={0.28} />
        </mesh>
      ))}
    </group>
  );
};

/** 纯水工段区域护栏:西/北/南整边 + 东边带通道口(对厂区)。 */
const PerimeterGuard3D: React.FC = () => {
  const { west, east, north, south, eastOpening } = PW_GUARD;
  return (
    <group>
      <GuardRun3D from={[west, 0, north]} to={[west, 0, south]} />
      <GuardRun3D from={[west, 0, north]} to={[east, 0, north]} />
      <GuardRun3D from={[west, 0, south]} to={[east, 0, south]} />
      <GuardRun3D from={[east, 0, north]} to={[east, 0, eastOpening.z0]} />
      <GuardRun3D from={[east, 0, eastOpening.z1]} to={[east, 0, south]} />
    </group>
  );
};

/* ── 纯水厂房(钢结构棚:北/西实墙,南面敞开只有立柱,东面留通道口) ─── */
const PW_WALL_HEIGHT = 6.0;
const PW_WALL_COLOR = '#9BA3AD';
const PW_WALL_DARK = '#7E8790';
const PW_TRIM_COLOR = '#64748B';

const WallPanel: React.FC<{
  position: Point;
  size: [number, number, number];
  color?: string;
}> = ({ position, size, color = PW_WALL_COLOR }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.62} metalness={0.1} />
  </mesh>
);

/**
 * 纯水厂房:北墙 + 西墙实墙封闭;南面只有结构立柱(无墙板)让人能看进设备;
 * 东墙在通道口两侧各一段、中间敞开。屋顶高架在 6m,不压设备。
 */
const PureWaterBuilding3D: React.FC = () => {
  const { west, east, north, south, eastOpening } = PW_GUARD;
  const cx = (west + east) / 2;
  const cz = (north + south) / 2;
  const width = east - west;
  const depth = south - north;
  const wallCenterY = PW_WALL_HEIGHT / 2;

  // 大跨度(42m)需中柱:沿 x 每 ~10m 一根。
  const columnXs: number[] = [];
  for (let x = west + 10; x < east - 2; x += 10) columnXs.push(x);
  // 南面敞开的立柱 x(含两端角柱)
  const southColumnXs = [west, ...columnXs, east];

  return (
    <group>
      {/* 北墙(整面实墙) */}
      <WallPanel position={[cx, wallCenterY, north]} size={[width + 0.22, PW_WALL_HEIGHT, 0.18]} />
      {/* 西墙(整面实墙) */}
      <WallPanel position={[west, wallCenterY, cz]} size={[0.18, PW_WALL_HEIGHT, depth + 0.04]} />
      {/* 东墙:通道口两侧各一段(中间敞开,对应护栏 eastOpening) */}
      <WallPanel position={[east, wallCenterY, (north + eastOpening.z0) / 2]} size={[0.18, PW_WALL_HEIGHT, eastOpening.z0 - north]} />
      <WallPanel position={[east, wallCenterY, (eastOpening.z1 + south) / 2]} size={[0.18, PW_WALL_HEIGHT, south - eastOpening.z1]} />

      {/* 南面:只有结构立柱,无墙板 — 让人从南面能看清内部设备 */}
      {southColumnXs.map((x, i) => (
        <WallPanel key={`pw-south-col-${i}`} position={[x, wallCenterY, south]} size={[0.24, PW_WALL_HEIGHT, 0.24]} color={PW_WALL_DARK} />
      ))}

      {/* 北面中柱(支撑大跨度屋顶,贴在北墙内侧) */}
      {columnXs.map((x, i) => (
        <WallPanel key={`pw-north-col-${i}`} position={[x, wallCenterY, north]} size={[0.24, PW_WALL_HEIGHT, 0.24]} color={PW_WALL_DARK} />
      ))}

      {/* 人字形玻璃采光屋顶(透明,能看清内部工艺流程;屋脊横梁保持金属结构感) */}
      {(() => {
        const roofRise = 1.1;
        const roofAngle = Math.atan2(roofRise, depth / 2);
        const roofSlope = Math.sqrt((depth / 2) ** 2 + roofRise ** 2);
        return (
          <>
            <mesh position={[cx, PW_WALL_HEIGHT + roofRise / 2 + 0.05, cz + depth / 4]} rotation={[roofAngle, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[width + 0.42, 0.06, roofSlope + 0.24]} />
              <meshPhysicalMaterial
                color="#BAE6FD"
                transparent
                opacity={0.25}
                roughness={0.08}
                metalness={0.1}
                transmission={0.7}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[cx, PW_WALL_HEIGHT + roofRise / 2 + 0.05, cz - depth / 4]} rotation={[-roofAngle, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[width + 0.42, 0.06, roofSlope + 0.24]} />
              <meshPhysicalMaterial
                color="#BAE6FD"
                transparent
                opacity={0.25}
                roughness={0.08}
                metalness={0.1}
                transmission={0.7}
                depthWrite={false}
              />
            </mesh>
            {/* 屋脊横梁(金属,不透,保留结构感) */}
            <mesh position={[cx, PW_WALL_HEIGHT + roofRise + 0.08, cz]} castShadow receiveShadow>
              <boxGeometry args={[width + 0.48, 0.14, 0.16]} />
              <meshStandardMaterial color={PW_TRIM_COLOR} roughness={0.42} metalness={0.35} />
            </mesh>
          </>
        );
      })()}
    </group>
  );
};

export const PureWaterSection: React.FC = () => {
  const SC = PW_PUMP_SCALE;

  // ── 泵法兰面（pumpPorts 几何派生，scale 0.65） ──
  const rawSuction = getSuctionFacePoint(PW_PUMPS.raw.position, PW_PUMPS.raw.rotationY, SC);
  const rawDischarge = getDischargeFacePoint(PW_PUMPS.raw.position, PW_PUMPS.raw.rotationY, SC);
  const ro1Suction = getSuctionFacePoint(PW_PUMPS.ro1.position, PW_PUMPS.ro1.rotationY, SC);
  const ro1Discharge = getDischargeFacePoint(PW_PUMPS.ro1.position, PW_PUMPS.ro1.rotationY, SC);
  const ro2Pair = [PW_PUMPS.ro2A, PW_PUMPS.ro2B];
  const supplyPair = [PW_PUMPS.supplyA, PW_PUMPS.supplyB];
  const ro2Suctions = ro2Pair.map((p) => getSuctionFacePoint(p.position, p.rotationY, SC));
  const ro2Discharges = ro2Pair.map((p) => getDischargeFacePoint(p.position, p.rotationY, SC));
  const supplySuctions = supplyPair.map((p) => getSuctionFacePoint(p.position, p.rotationY, SC));
  const supplyDischarges = supplyPair.map((p) => getDischargeFacePoint(p.position, p.rotationY, SC));

  // ── 水箱端口（getTankPort 几何派生） ──
  const rawTankTop = getTankPort(PW_TANKS.raw.position, PW_TANKS.raw.size[0], PW_TANKS.raw.size[1], 'top');
  const ro1TankTop = getTankPort(PW_TANKS.ro1.position, PW_TANKS.ro1.size[0], PW_TANKS.ro1.size[1], 'top');
  const ro2TankTop = getTankPort(PW_TANKS.ro2.position, PW_TANKS.ro2.size[0], PW_TANKS.ro2.size[1], 'top');

  // ── 保安/碳柱端口（getCartridgePort/getCarbonPort 几何派生） ──
  // 设备 ry=-π/2：local -Z(side=-1)=进口 在世界 +X 侧；local +Z(side=+1)=出口 在世界 -X 侧。
  const cart1In = getCartridgePort(PW_UNITS.cart1.position, -1, 'upper');
  const cart1Out = getCartridgePort(PW_UNITS.cart1.position, 1, 'lower');
  const carbonIn = getCarbonPort(PW_UNITS.carbon.position, -1, 'upper');
  const carbonOut = getCarbonPort(PW_UNITS.carbon.position, 1, 'lower');
  const cart2In = getCartridgePort(PW_UNITS.cart2.position, -1, 'upper');
  const cart2Out = getCartridgePort(PW_UNITS.cart2.position, 1, 'lower');

  // ── 膜组端盖端口（getMembranePort 几何派生，ry=0） ──
  // ro1：进料在东端(+X, side=+1)上膜，产水在西端(-X, side=-1)下膜。
  const ro1FeedPort = getMembranePort(PW_UNITS.ro1.position, 1, 'upper');
  const ro1PermeatePort = getMembranePort(PW_UNITS.ro1.position, -1, 'lower');
  // ro2：进料在西端(-X, side=-1)上膜，产水在东端(+X, side=+1)下膜。
  const ro2FeedPort = getMembranePort(PW_UNITS.ro2.position, -1, 'upper');
  const ro2PermeatePort = getMembranePort(PW_UNITS.ro2.position, 1, 'lower');

  const vHalf = (scale: number) => 0.82 * scale;
  const vIn = PW_VALVES.inlet;
  const vR1 = PW_VALVES.ro1In;
  const vR2 = PW_VALVES.ro2In;
  const vF1 = PW_VALVES.ro1Flush;
  const vF2 = PW_VALVES.ro2Flush;

  const S1 = PW_STAGE1_Z;
  const S2 = PW_STAGE2_Z;

  // ── 双泵汇管（共面 + 纯竖直立管，对齐污水区 buildHeaderOnDischargeFaces） ──
  // R02/供水泵朝北吸入(ry=0)，吸入汇管在泵排北侧 z、排放汇管在 z-0.39（共面于排出面 z）。
  const ro2SuctionHeaderZ = S2 - 1.07;
  // 排放汇管 z 必须等于排出面 z，保证 riser 纯竖直。
  const ro2DischargeHeaderZ = ro2Discharges[0][2];

  const dualHeader = (faces: Point[], y: number) => {
    const xs = faces.map((f) => f[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return {
      start: [minX - PW_HEADER_END_CLEARANCE, y, faces[0][2]] as Point,
      takeoff: [maxX, y, faces[0][2]] as Point,
      end: [maxX + PW_HEADER_END_CLEARANCE, y, faces[0][2]] as Point,
    };
  };
  const ro2SuctionHeader = {
    start: [PW_PUMPS.ro2A.position[0] - 0.6 - PW_HEADER_END_CLEARANCE, PW_SUCTION_HEADER_Y, ro2SuctionHeaderZ] as Point,
    takeoff: [PW_PUMPS.ro2A.position[0] - 0.6, PW_SUCTION_HEADER_Y, ro2SuctionHeaderZ] as Point,
    end: [PW_PUMPS.ro2B.position[0] + 0.6, PW_SUCTION_HEADER_Y, ro2SuctionHeaderZ] as Point,
  };
  const ro2DischargeHeader = dualHeader(ro2Discharges, PW_DISCHARGE_HEADER_Y);
  const supplySuctionHeader = {
    start: [PW_PUMPS.supplyA.position[0] - 0.6 - PW_HEADER_END_CLEARANCE, PW_SUCTION_HEADER_Y, ro2SuctionHeaderZ] as Point,
    takeoff: [PW_PUMPS.supplyA.position[0] - 0.6, PW_SUCTION_HEADER_Y, ro2SuctionHeaderZ] as Point,
    end: [PW_PUMPS.supplyB.position[0] + 0.6, PW_SUCTION_HEADER_Y, ro2SuctionHeaderZ] as Point,
  };
  const supplyDischargeHeader = dualHeader(supplyDischarges, PW_DISCHARGE_HEADER_Y);

  const ro1FlushTee: Point = [vF1.position[0], PW_DISCHARGE_HEADER_Y, S1];
  const ro1FlushDrain: Point = [vF1.position[0], 0.15, vF1.position[2] - vHalf(vF1.scale)];
  const ro2FlushTee: Point = [vF2.position[0], PW_DISCHARGE_HEADER_Y, ro2DischargeHeaderZ];
  const ro2FlushDrain: Point = [vF2.position[0], 0.15, vF2.position[2] - vHalf(vF2.scale)];

  // ── 撬装底座尺寸（按撬组设备包围盒派生） ──
  // 单台立式泵撬：导轨 1.6×1.2；双泵撬：两台并贴，导轨加长。
  const singlePumpSkid: [number, number] = [1.6, 1.2];
  const dualPumpSkid = (a: Point, b: Point): [number, number] => [Math.abs(a[0] - b[0]) + 1.6, 1.2];

  // ── 短别名（桥接旧管路坐标，全部指向 helper 派生值，消除硬编码） ──
  const [rawTx, , rawTz] = PW_TANKS.raw.position;
  const [ro1Tx, , ro1Tz] = PW_TANKS.ro1.position;
  const [ro2Tx, , ro2Tz] = PW_TANKS.ro2.position;
  const [asTx, , asTz] = PW_TANKS.antiscalant.position;
  const [naTx, , naTz] = PW_TANKS.naoh.position;

  return (
    <group>
      {/* 整区铺面(Platform3D,和主流程/收集池一致的 coping 边缘,矮铺面垫出"地砖铺起"感;设备仍坐地面,不抬管路) */}
      <Platform3D
        position={[(PW_GUARD.west + PW_GUARD.east) / 2, -0.06, (PW_GUARD.north + PW_GUARD.south) / 2]}
        size={[PW_GUARD.east - PW_GUARD.west, 0.12, PW_GUARD.south - PW_GUARD.north]}
        showRailings={false}
        surfaceColor="#C9CFD4"
      />
      {/* 每撬独立 pad + 金属型钢撬座（替代原两条通长地砖） */}
      {/* 原水撬（原水箱+原水泵+进水阀） */}
      <EquipmentPad3D center={[(PW_TANKS.raw.position[0] + PW_PUMPS.raw.position[0]) / 2, 0.02, S1]} size={[Math.abs(PW_TANKS.raw.position[0] - PW_PUMPS.raw.position[0]) + 3.2, 0.05, 4.0]} />
      <SkidFrame3D center={[PW_PUMPS.raw.position[0], 0, S1]} size={singlePumpSkid} />
      <SkidFrame3D center={[PW_TANKS.raw.position[0], 0, S1]} size={[3.2, 3.2]} railColor="#9AA4AD" />
      {/* 预处理撬（保安①+碳柱+一级进水阀+保安②） */}
      <EquipmentPad3D center={[(PW_UNITS.cart1.position[0] + PW_UNITS.cart2.position[0]) / 2, 0.02, S1]} size={[Math.abs(PW_UNITS.cart1.position[0] - PW_UNITS.cart2.position[0]) + 1.6, 0.05, 2.6]} />
      {/* 一级 RO 撬（R01泵 + 一级膜组，共用底座） */}
      <EquipmentPad3D center={[(PW_PUMPS.ro1.position[0] + PW_UNITS.ro1.position[0]) / 2, 0.02, S1]} size={[Math.abs(PW_PUMPS.ro1.position[0] - PW_UNITS.ro1.position[0]) + 2.4, 0.05, 2.8]} />
      <SkidFrame3D center={[PW_PUMPS.ro1.position[0], 0, S1]} size={singlePumpSkid} />
      {/* R01水箱撬 */}
      <EquipmentPad3D center={[PW_TANKS.ro1.position[0], 0.02, S1]} size={[3.2, 0.05, 3.2]} />
      <SkidFrame3D center={[PW_TANKS.ro1.position[0], 0, S1]} size={[3.2, 3.2]} railColor="#9AA4AD" />
      {/* R02 双泵撬（并贴在同一型钢底座） */}
      <EquipmentPad3D center={[(PW_PUMPS.ro2A.position[0] + PW_PUMPS.ro2B.position[0]) / 2, 0.02, S2]} size={[Math.abs(PW_PUMPS.ro2A.position[0] - PW_PUMPS.ro2B.position[0]) + 1.8, 0.05, 2.6]} />
      <SkidFrame3D center={[(PW_PUMPS.ro2A.position[0] + PW_PUMPS.ro2B.position[0]) / 2, 0, S2]} size={dualPumpSkid(PW_PUMPS.ro2A.position, PW_PUMPS.ro2B.position)} />
      {/* 二级膜撬 */}
      <EquipmentPad3D center={[PW_UNITS.ro2.position[0], 0.02, S2]} size={[3.4, 0.05, 2.0]} />
      {/* R02水箱撬 */}
      <EquipmentPad3D center={[PW_TANKS.ro2.position[0], 0.02, S2]} size={[3.2, 0.05, 3.2]} />
      <SkidFrame3D center={[PW_TANKS.ro2.position[0], 0, S2]} size={[3.2, 3.2]} railColor="#9AA4AD" />
      {/* 供水双泵撬 */}
      <EquipmentPad3D center={[(PW_PUMPS.supplyA.position[0] + PW_PUMPS.supplyB.position[0]) / 2, 0.02, S2]} size={[Math.abs(PW_PUMPS.supplyA.position[0] - PW_PUMPS.supplyB.position[0]) + 1.8, 0.05, 2.6]} />
      <SkidFrame3D center={[(PW_PUMPS.supplyA.position[0] + PW_PUMPS.supplyB.position[0]) / 2, 0, S2]} size={dualPumpSkid(PW_PUMPS.supplyA.position, PW_PUMPS.supplyB.position)} />
      {/* 加药撬（阻垢剂桶+计量泵 / NaOH桶+计量泵） */}
      <EquipmentPad3D center={[(PW_TANKS.antiscalant.position[0] + PW_DOSE_PUMPS.antiscalant.position[0]) / 2, 0.02, (PW_TANKS.antiscalant.position[2] + PW_DOSE_PUMPS.antiscalant.position[2]) / 2]} size={[1.6, 0.05, Math.abs(PW_TANKS.antiscalant.position[2] - PW_DOSE_PUMPS.antiscalant.position[2]) + 0.6]} />
      <EquipmentPad3D center={[(PW_TANKS.naoh.position[0] + PW_DOSE_PUMPS.naoh.position[0]) / 2, 0.02, (PW_TANKS.naoh.position[2] + PW_DOSE_PUMPS.naoh.position[2]) / 2]} size={[1.6, 0.05, Math.abs(PW_TANKS.naoh.position[2] - PW_DOSE_PUMPS.naoh.position[2]) + 0.6]} />
      <PerimeterGuard3D />
      {/* 纯水厂房(墙+中柱+屋顶,遮蔽露天设备) */}
      <PureWaterBuilding3D />

      {/* ── 设备 ── */}
      <ChemicalTank3D id={PW_TANKS.raw.id} position={PW_TANKS.raw.position} size={PW_TANKS.raw.size} color={PW_TANKS.raw.color} hideAgitator />
      <ChemicalTank3D id={PW_TANKS.ro1.id} position={PW_TANKS.ro1.position} size={PW_TANKS.ro1.size} color={PW_TANKS.ro1.color} hideAgitator />
      <ChemicalTank3D id={PW_TANKS.ro2.id} position={PW_TANKS.ro2.position} size={PW_TANKS.ro2.size} color={PW_TANKS.ro2.color} hideAgitator />
      <ChemicalTank3D id={PW_TANKS.antiscalant.id} position={PW_TANKS.antiscalant.position} size={PW_TANKS.antiscalant.size} color={PW_TANKS.antiscalant.color} compactLabel hideLabel hideAgitator />
      <ChemicalTank3D id={PW_TANKS.naoh.id} position={PW_TANKS.naoh.position} size={PW_TANKS.naoh.size} color={PW_TANKS.naoh.color} compactLabel hideLabel hideAgitator />

      {Object.values(PW_PUMPS).map((p) => (
        <React.Fragment key={p.id}>
          <PureWaterPump3D id={p.id} position={p.position} rotation={[0, p.rotationY, 0]} scale={PW_PUMP_SCALE} />
          {/* 每台泵挂真实法兰面接头 + 大小头过渡（消除"管子戳喷嘴"虚空感） */}
          <PumpPipeFlanges3D
            position={p.position}
            rotationY={p.rotationY}
            suctionRadius={PW_BRANCH_R}
            dischargeRadius={PW_BRANCH_R}
            color={FEED}
          />
          <PumpPipeReducer3D
            position={getSuctionFacePoint(p.position, p.rotationY, SC)}
            direction={getSuctionDirection(p.rotationY)}
            pumpRadius={PW_BRANCH_R}
            pipeRadius={PW_MAIN_R}
            color={FEED}
          />
          <PumpPipeReducer3D
            position={getDischargeFacePoint(p.position, p.rotationY, SC)}
            direction={getDischargeDirection(p.rotationY)}
            pumpRadius={PW_BRANCH_R}
            pipeRadius={PW_MAIN_R}
            color={FEED}
          />
        </React.Fragment>
      ))}

      <CartridgeFilter3D id={PW_UNITS.cart1.id} position={PW_UNITS.cart1.position} rotation={PW_UNITS.cart1.rotation} />
      <CarbonColumn3D id={PW_UNITS.carbon.id} position={PW_UNITS.carbon.position} rotation={PW_UNITS.carbon.rotation} />
      <CartridgeFilter3D id={PW_UNITS.cart2.id} position={PW_UNITS.cart2.position} rotation={PW_UNITS.cart2.rotation} />
      <RoMembraneRack3D id={PW_UNITS.ro1.id} position={PW_UNITS.ro1.position} rotation={PW_UNITS.ro1.rotation} />
      <RoMembraneRack3D id={PW_UNITS.ro2.id} position={PW_UNITS.ro2.position} rotation={PW_UNITS.ro2.rotation} />

      {Object.values(PW_VALVES).map((v) => (
        <Valve3D key={v.id} id={v.id} position={v.position} rotation={v.rotation} scale={v.scale} />
      ))}

      {/* ══ 预处理排 + 一级 RO 撬(东→西,膜前 pwFeed 灰) ══ */}

      {/* 原水来水(东,穿东墙)→ 总进水阀 */}
      <PipeWallPort3D position={[PW_GUARD.east, 1.05, S1]} rotation={[0, 0, -Math.PI / 2]} radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={[PW_RAW_ENTRY_X, 1.05, S1]} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={[vIn.position[0] + vHalf(vIn.scale), 1.05, S1]} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[[PW_RAW_ENTRY_X, 1.05, S1], [vIn.position[0] + vHalf(vIn.scale), 1.05, S1]]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />
      {/* 总进水阀 → 原水箱顶(贴东壁外侧爬升,过顶入户 — 不再侧穿罐体/罐内暗管) */}
      <PipeOpenFlange3D position={[vIn.position[0] - vHalf(vIn.scale), 1.05, S1]} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={rawTankTop} axis="-y" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[
          [vIn.position[0] - vHalf(vIn.scale), 1.05, S1],
          [rawTx + 1.6, 1.05, rawTz],
          [rawTx + 1.6, PW_PERMEATE_HIGH_Y, rawTz],
          [rawTx, PW_PERMEATE_HIGH_Y, rawTz],
          rawTankTop,
        ]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 原水箱 → 原水泵吸入(箱口先升到吸入口标高,再沿吸入轴水平进法兰面) */}
      <PipeOpenFlange3D position={[rawTx - 1.0, 0.46, rawTz]} axis="-x" radius={PW_BRANCH_R} color={FEED} />
      <Pipe3D
        points={[[rawTx - 1.04, 0.46, rawTz], [rawTx - 1.04, rawSuction[1], rawTz], rawSuction]}
        radius={PW_BRANCH_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
        endOverlap={PUMP_FACE_SEAT}
      />

      {/* 原水泵出口 → 保安①进口 */}
      <PipeOpenFlange3D position={cart1In} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[rawDischarge, [rawDischarge[0], 1.35, S1], cart1In]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
        startOverlap={PUMP_FACE_SEAT}
      />

      {/* 保安① → 碳柱进口 */}
      <PipeOpenFlange3D position={cart1Out} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={carbonIn} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[cart1Out, [cart1Out[0] - 0.6, 0.79, S1], [cart1Out[0] - 0.6, 2.0, S1], carbonIn]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 碳柱 → 一级进水阀 → 保安②进口 */}
      <PipeOpenFlange3D position={carbonOut} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={[vR1.position[0] + vHalf(vR1.scale), 0.95, S1]} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[carbonOut, [vR1.position[0] + vHalf(vR1.scale), 0.95, S1]]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />
      <PipeOpenFlange3D position={[vR1.position[0] - vHalf(vR1.scale), 0.95, S1]} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={cart2In} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[
          [vR1.position[0] - vHalf(vR1.scale), 0.95, S1],
          [vR1.position[0] - vHalf(vR1.scale) - 0.1, 0.95, S1],
          [vR1.position[0] - vHalf(vR1.scale) - 0.1, 1.35, S1],
          cart2In,
        ]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 保安② → R01泵吸入(阻垢剂在此注入;先降到吸入口标高,再沿吸入轴水平进法兰面) */}
      <PipeOpenFlange3D position={cart2Out} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[cart2Out, [cart2Out[0] - 1.3, 0.79, S1], [cart2Out[0] - 1.3, ro1Suction[1], S1], ro1Suction]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
        endOverlap={PUMP_FACE_SEAT}
      />

      {/* R01泵出口 → 一级膜组进料端(东) */}
      <PipeOpenFlange3D position={ro1FeedPort} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[ro1Discharge, [ro1Discharge[0], 1.35, S1], [ro1FeedPort[0] + 0.35, 1.35, S1], [ro1FeedPort[0] + 0.35, 1.31, S1], ro1FeedPort]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
        startOverlap={PUMP_FACE_SEAT}
      />

      {/* 一级冲洗:R01排放管 tee → 一级冲洗阀 → 地漏 */}
      <PipeOpenFlange3D position={ro1FlushDrain} axis="-y" radius={PW_FLUSH_R} color={FEED} />
      <FloorDrain3D position={[ro1FlushDrain[0], 0.07, ro1FlushDrain[2]]} />
      <Pipe3D
        points={[ro1FlushTee, [ro1FlushTee[0], 1.35, vF1.position[2] + vHalf(vF1.scale)]]}
        radius={PW_FLUSH_R} color={FEED} flowType="water" animated={false}
        startConnection="junction" endConnection="equipment"
        junctionTrim="start" junctionMateRadius={PW_MAIN_R}
      />
      <Pipe3D
        points={[[ro1FlushTee[0], 1.35, ro1FlushDrain[2]], ro1FlushDrain]}
        radius={PW_FLUSH_R} color={FEED} flowType="water" animated={false}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 一级膜产水 → R01水箱(过顶入户,过膜变青) */}
      <PipeOpenFlange3D position={ro1PermeatePort} axis="-x" radius={PW_BRANCH_R} color={PERMEATE} />
      <PipeOpenFlange3D position={ro1TankTop} axis="-y" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[
          ro1PermeatePort,
          [ro1PermeatePort[0] - 0.6, ro1PermeatePort[1], S1],
          [ro1PermeatePort[0] - 0.6, PW_PERMEATE_HIGH_Y, S1],
          [ro1Tx, PW_PERMEATE_HIGH_Y, ro1Tz],
          ro1TankTop,
        ]}
        radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* ══ 二级 RO 撬 + 供水(西→东,全青) ══ */}

      {/* R01水箱 → 二级进水阀 → R02 吸入汇管 */}
      <PipeOpenFlange3D position={[ro1Tx, 0.46, ro1Tz + 1.0]} axis="+z" radius={PW_BRANCH_R} color={PERMEATE} />
      <PipeOpenFlange3D position={[ro1Tx, 0.46, vR2.position[2] - vHalf(vR2.scale)]} axis="-z" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[[ro1Tx, 0.46, ro1Tz + 1.04], [ro1Tx, 0.46, vR2.position[2] - vHalf(vR2.scale)]]}
        radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />
      <PipeOpenFlange3D position={[ro1Tx, 0.46, vR2.position[2] + vHalf(vR2.scale)]} axis="+z" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[
          [ro1Tx, 0.46, vR2.position[2] + vHalf(vR2.scale)],
          [ro1Tx, 0.46, ro2SuctionHeaderZ],
          ro2SuctionHeader.start,
        ]}
        radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="equipment" endConnection="junction" endJunctionRole="continuous"
      />
      <ConvergingHeader3D
        start={ro2SuctionHeader.start} takeoff={ro2SuctionHeader.takeoff} end={ro2SuctionHeader.end}
        radius={PW_HEADER_R} color={PERMEATE} flowType="water"
        capStart={false} capEnd={true}
      />
      {ro2Suctions.map((face, i) => (
        <Pipe3D
          key={`ro2-suction-${i}`}
          points={[[face[0], 0.46, ro2SuctionHeaderZ], [face[0], face[1], ro2SuctionHeaderZ], face]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="junction" endConnection="equipment"
          junctionTrim="start" junctionMateRadius={PW_HEADER_R}
          endOverlap={PUMP_FACE_SEAT}
        />
      ))}
      {ro2Discharges.map((face, i) => (
        <Pipe3D
          key={`ro2-riser-${i}`}
          points={[face, [face[0], 1.5, face[2]], [face[0], 1.5, ro2DischargeHeaderZ]]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="equipment" endConnection="junction"
          junctionTrim="end" junctionMateRadius={PW_HEADER_R}
          startOverlap={PUMP_FACE_SEAT}
        />
      ))}
      <ConvergingHeader3D
        start={ro2DischargeHeader.start} takeoff={ro2DischargeHeader.takeoff} end={ro2DischargeHeader.end}
        radius={PW_HEADER_R} color={PERMEATE} flowType="water"
        capStart={true} capEnd={false}
      />

      {/* R02 排放汇管 → 二级膜组进料端(西) */}
      <PipeOpenFlange3D position={ro2FeedPort} axis="-x" radius={PW_MAIN_R} color={PERMEATE} />
      <Pipe3D
        points={[
          ro2DischargeHeader.end,
          [ro2FeedPort[0] - 0.6, 1.5, ro2DischargeHeaderZ],
          [ro2FeedPort[0] - 0.6, 1.5, S2],
          [ro2FeedPort[0] - 0.6, 1.31, S2],
          ro2FeedPort,
        ]}
        radius={PW_MAIN_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="junction" endConnection="equipment" startJunctionRole="continuous"
      />

      {/* 二级冲洗:R02排放管 tee → 二级冲洗阀 → 地漏 */}
      <PipeOpenFlange3D position={ro2FlushDrain} axis="-y" radius={PW_FLUSH_R} color={PERMEATE} />
      <FloorDrain3D position={[ro2FlushDrain[0], 0.07, ro2FlushDrain[2]]} />
      <Pipe3D
        points={[ro2FlushTee, [ro2FlushTee[0], 1.5, vF2.position[2] + vHalf(vF2.scale)]]}
        radius={PW_FLUSH_R} color={PERMEATE} flowType="water" animated={false}
        startConnection="junction" endConnection="equipment"
        junctionTrim="start" junctionMateRadius={PW_MAIN_R}
      />
      <Pipe3D
        points={[[ro2FlushTee[0], 1.5, ro2FlushDrain[2]], ro2FlushDrain]}
        radius={PW_FLUSH_R} color={PERMEATE} flowType="water" animated={false}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 二级膜产水 → R02水箱(过顶入户) */}
      <PipeOpenFlange3D position={ro2PermeatePort} axis="+x" radius={PW_BRANCH_R} color={PERMEATE} />
      <PipeOpenFlange3D position={ro2TankTop} axis="-y" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[
          ro2PermeatePort,
          [ro2PermeatePort[0] + 0.6, ro2PermeatePort[1], S2],
          [ro2PermeatePort[0] + 0.6, PW_PERMEATE_HIGH_Y, S2],
          [ro2Tx, PW_PERMEATE_HIGH_Y, ro2Tz],
          ro2TankTop,
        ]}
        radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* R02水箱 → 供水吸入汇管 */}
      <PipeOpenFlange3D position={[ro2Tx, 0.46, ro2Tz - 1.0]} axis="-z" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[
          [ro2Tx, 0.46, ro2Tz - 1.04],
          [ro2Tx, 0.46, ro2SuctionHeaderZ],
          supplySuctionHeader.start,
        ]}
        radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="equipment" endConnection="junction" endJunctionRole="continuous"
      />
      <ConvergingHeader3D
        start={supplySuctionHeader.start} takeoff={supplySuctionHeader.takeoff} end={supplySuctionHeader.end}
        radius={PW_HEADER_R} color={PERMEATE} flowType="water"
        capStart={false} capEnd={true}
      />
      {supplySuctions.map((face, i) => (
        <Pipe3D
          key={`supply-suction-${i}`}
          points={[[face[0], 0.46, ro2SuctionHeaderZ], [face[0], face[1], ro2SuctionHeaderZ], face]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="junction" endConnection="equipment"
          junctionTrim="start" junctionMateRadius={PW_HEADER_R}
          endOverlap={PUMP_FACE_SEAT}
        />
      ))}
      {supplyDischarges.map((face, i) => (
        <Pipe3D
          key={`supply-riser-${i}`}
          points={[face, [face[0], 1.5, face[2]], [face[0], 1.5, ro2DischargeHeaderZ]]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="equipment" endConnection="junction"
          junctionTrim="end" junctionMateRadius={PW_HEADER_R}
          startOverlap={PUMP_FACE_SEAT}
        />
      ))}
      <ConvergingHeader3D
        start={supplyDischargeHeader.start} takeoff={supplyDischargeHeader.takeoff} end={supplyDischargeHeader.end}
        radius={PW_HEADER_R} color={PERMEATE} flowType="water"
        capStart={true} capEnd={false}
      />

      {/* 供水排放汇管 → 用水点(东,门型管架支撑) */}
      <PipeRackPortal3D position={[-65.5, 0, ro2DischargeHeaderZ]} height={1.6} />
      <PipeRackPortal3D position={[-60, 0, ro2DischargeHeaderZ]} height={1.6} />
      <PipeOpenFlange3D position={[PW_PURE_EXIT_X, 1.5, ro2DischargeHeaderZ]} axis="+x" radius={PW_MAIN_R} color={PERMEATE} />
      <Pipe3D
        points={[supplyDischargeHeader.end, [PW_PURE_EXIT_X, 1.5, ro2DischargeHeaderZ]]}
        radius={PW_MAIN_R} color={PERMEATE} flowType="water" animated={true}
        startConnection="junction" endConnection="equipment" startJunctionRole="continuous"
      />

      {/* ══ 加药线 ══ */}

      {/* 阻垢剂:药桶 → 计量泵 → 注入 R01 吸入管 */}
      <ChemicalMeteringPump3D id={PW_DOSE_PUMPS.antiscalant.id} position={PW_DOSE_PUMPS.antiscalant.position} color={PIPE_COLORS.pwAntiscalant} />
      <PipeOpenFlange3D position={[asTx, 0.46, asTz - 0.45]} axis="-z" radius={PW_DOSE_R} color={PIPE_COLORS.pwAntiscalant} />
      <Pipe3D
        points={[[asTx, 0.46, asTz - 0.49], [asTx, 0.46, PW_DOSE_PUMPS.antiscalant.position[2]]]}
        radius={PW_DOSE_R} color={PIPE_COLORS.pwAntiscalant} flowType="chemical" animated={true}
        startConnection="equipment" endConnection="equipment"
      />
      <Pipe3D
        points={[
          [asTx, 0.46, PW_DOSE_PUMPS.antiscalant.position[2]],
          [asTx, 0.46, S1 + 0.3],
          [asTx, 0.79, S1 + 0.3],
          [asTx, 0.79, S1],
        ]}
        radius={PW_DOSE_R} color={PIPE_COLORS.pwAntiscalant} flowType="chemical" animated={true}
        startConnection="equipment" endConnection="junction"
        junctionTrim="end" junctionMateRadius={PW_MAIN_R}
      />

      {/* NaOH:药桶 → 计量泵 → 注入 R02 吸入汇管 */}
      <ChemicalMeteringPump3D id={PW_DOSE_PUMPS.naoh.id} position={PW_DOSE_PUMPS.naoh.position} color={PIPE_COLORS.pwNaoh} />
      <PipeOpenFlange3D position={[naTx, 0.46, naTz + 0.45]} axis="+z" radius={PW_DOSE_R} color={PIPE_COLORS.pwNaoh} />
      <Pipe3D
        points={[[naTx, 0.46, naTz + 0.49], [naTx, 0.46, PW_DOSE_PUMPS.naoh.position[2]]]}
        radius={PW_DOSE_R} color={PIPE_COLORS.pwNaoh} flowType="chemical" animated={true}
        startConnection="equipment" endConnection="equipment"
      />
      <Pipe3D
        points={[[naTx, 0.46, PW_DOSE_PUMPS.naoh.position[2]], [naTx, 0.46, ro2SuctionHeaderZ]]}
        radius={PW_DOSE_R} color={PIPE_COLORS.pwNaoh} flowType="chemical" animated={true}
        startConnection="equipment" endConnection="junction"
        junctionTrim="end" junctionMateRadius={PW_HEADER_R}
      />
    </group>
  );
};
