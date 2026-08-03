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
import { ConvergingHeader3D } from '../piping/ConvergingHeader3D';
import { PIPE_COLORS } from '../piping/pipeRouting';
import { getDischargeFacePoint, getSuctionFacePoint } from '../piping/pumpPorts';
import { Pump3D } from '../equipment/Pump3D';
import { Valve3D } from '../equipment/Valve3D';
import { ChemicalTank3D } from '../equipment/ChemicalTank3D';
import { ChemicalMeteringPump3D } from '../equipment/ChemicalMeteringPump3D';
import { CartridgeFilter3D } from '../equipment/CartridgeFilter3D';
import { CarbonColumn3D } from '../equipment/CarbonColumn3D';
import { RoMembraneRack3D } from '../equipment/RoMembraneRack3D';
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
} from './pureWaterLayout';

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

export const PureWaterSection: React.FC = () => {
  const rawSuction = getSuctionFacePoint(PW_PUMPS.raw.position, PW_PUMPS.raw.rotationY);
  const rawDischarge = getDischargeFacePoint(PW_PUMPS.raw.position, PW_PUMPS.raw.rotationY);
  const ro1Suction = getSuctionFacePoint(PW_PUMPS.ro1.position, PW_PUMPS.ro1.rotationY);
  const ro1Discharge = getDischargeFacePoint(PW_PUMPS.ro1.position, PW_PUMPS.ro1.rotationY);

  const ro2Suctions = [PW_PUMPS.ro2A, PW_PUMPS.ro2B].map((p) => getSuctionFacePoint(p.position, p.rotationY));
  const ro2Discharges = [PW_PUMPS.ro2A, PW_PUMPS.ro2B].map((p) => getDischargeFacePoint(p.position, p.rotationY));
  const supplySuctions = [PW_PUMPS.supplyA, PW_PUMPS.supplyB].map((p) => getSuctionFacePoint(p.position, p.rotationY));
  const supplyDischarges = [PW_PUMPS.supplyA, PW_PUMPS.supplyB].map((p) => getDischargeFacePoint(p.position, p.rotationY));

  const [rawTx, , rawTz] = PW_TANKS.raw.position;
  const [ro1Tx, , ro1Tz] = PW_TANKS.ro1.position;
  const [ro2Tx, , ro2Tz] = PW_TANKS.ro2.position;
  const [asTx, , asTz] = PW_TANKS.antiscalant.position;
  const [naTx, , naTz] = PW_TANKS.naoh.position;

  const cart1X = PW_UNITS.cart1.position[0];
  const carbonX = PW_UNITS.carbon.position[0];
  const cart2X = PW_UNITS.cart2.position[0];
  const ro1RackX = PW_UNITS.ro1.position[0];
  const ro2RackX = PW_UNITS.ro2.position[0];

  const S1 = PW_STAGE1_Z; // -6 一级线
  const S2 = PW_STAGE2_Z; // +6 二级线

  // 保安过滤器/碳柱接管法兰面(进东出西)。
  const cart1In: Point = [cart1X + 0.5, 1.35, S1];
  const cart1Out: Point = [cart1X - 0.5, 0.79, S1];
  const carbonIn: Point = [carbonX + 0.7, 2.0, S1];
  const carbonOut: Point = [carbonX - 0.7, 0.95, S1];
  const cart2In: Point = [cart2X + 0.5, 1.35, S1];
  const cart2Out: Point = [cart2X - 0.5, 0.79, S1];

  // 膜组端盖端口(上膜进料,下膜产水)。
  const ro1FeedPort: Point = [ro1RackX + 1.18, 1.31, S1]; // 一级膜进料(东端)
  const ro1PermeatePort: Point = [ro1RackX - 1.18, 0.65, S1]; // 一级膜产水(西端)
  const ro2FeedPort: Point = [ro2RackX - 1.18, 1.31, S2]; // 二级膜进料(西端)
  const ro2PermeatePort: Point = [ro2RackX + 1.18, 0.65, S2]; // 二级膜产水(东端)

  const vHalf = (scale: number) => 0.82 * scale;
  const vIn = PW_VALVES.inlet;
  const vR1 = PW_VALVES.ro1In;
  const vR2 = PW_VALVES.ro2In;
  const vF1 = PW_VALVES.ro1Flush;
  const vF2 = PW_VALVES.ro2Flush;

  // R02/供水泵朝北吸入(ry=0),吸入汇管在泵排北侧、排放汇管在泵排 z-0.39。
  const ro2SuctionHeaderZ = S2 - 1.07;
  const ro2DischargeHeaderZ = S2 - 0.39;
  const ro2SuctionHeader = {
    start: [PW_PUMPS.ro2A.position[0] - 0.6, 0.46, ro2SuctionHeaderZ] as Point,
    takeoff: [PW_PUMPS.ro2A.position[0] - 0.6, 0.46, ro2SuctionHeaderZ] as Point,
    end: [PW_PUMPS.ro2B.position[0] + 0.6, 0.46, ro2SuctionHeaderZ] as Point,
  };
  const ro2DischargeHeader = {
    start: [PW_PUMPS.ro2A.position[0] - 0.15, 1.5, ro2DischargeHeaderZ] as Point,
    takeoff: [PW_PUMPS.ro2B.position[0] + 0.15, 1.5, ro2DischargeHeaderZ] as Point,
    end: [PW_PUMPS.ro2B.position[0] + 0.15, 1.5, ro2DischargeHeaderZ] as Point,
  };
  const supplySuctionHeader = {
    start: [PW_PUMPS.supplyA.position[0] - 0.6, 0.46, ro2SuctionHeaderZ] as Point,
    takeoff: [PW_PUMPS.supplyA.position[0] - 0.6, 0.46, ro2SuctionHeaderZ] as Point,
    end: [PW_PUMPS.supplyB.position[0] + 0.6, 0.46, ro2SuctionHeaderZ] as Point,
  };
  const supplyDischargeHeader = {
    start: [PW_PUMPS.supplyA.position[0] - 0.15, 1.5, ro2DischargeHeaderZ] as Point,
    takeoff: [PW_PUMPS.supplyB.position[0] + 0.15, 1.5, ro2DischargeHeaderZ] as Point,
    end: [PW_PUMPS.supplyB.position[0] + 0.15, 1.5, ro2DischargeHeaderZ] as Point,
  };

  const ro1FlushTee: Point = [vF1.position[0], 1.35, S1];
  const ro1FlushDrain: Point = [vF1.position[0], 0.15, vF1.position[2] - vHalf(vF1.scale)];
  const ro2FlushTee: Point = [vF2.position[0], 1.5, ro2DischargeHeaderZ];
  // 二级冲洗支管从南(z 大)来,进阀南端(z+vHalf),出阀北端(z-vHalf)下地漏。
  const ro2FlushDrain: Point = [vF2.position[0], 0.15, vF2.position[2] - vHalf(vF2.scale)];

  return (
    <group>
      {/* 组团基础带:预处理+一撬(北) / 二撬+供水(南) */}
      <EquipmentPad3D center={[-75.5, 0.02, S1]} size={[23, 0.05, 3.2]} />
      <EquipmentPad3D center={[-79, 0.02, S2]} size={[16.5, 0.05, 3.2]} />
      <PerimeterGuard3D />

      {/* ── 设备 ── */}
      <ChemicalTank3D id={PW_TANKS.raw.id} position={PW_TANKS.raw.position} size={PW_TANKS.raw.size} color={PW_TANKS.raw.color} />
      <ChemicalTank3D id={PW_TANKS.ro1.id} position={PW_TANKS.ro1.position} size={PW_TANKS.ro1.size} color={PW_TANKS.ro1.color} />
      <ChemicalTank3D id={PW_TANKS.ro2.id} position={PW_TANKS.ro2.position} size={PW_TANKS.ro2.size} color={PW_TANKS.ro2.color} />
      <ChemicalTank3D id={PW_TANKS.antiscalant.id} position={PW_TANKS.antiscalant.position} size={PW_TANKS.antiscalant.size} color={PW_TANKS.antiscalant.color} compactLabel hideLabel />
      <ChemicalTank3D id={PW_TANKS.naoh.id} position={PW_TANKS.naoh.position} size={PW_TANKS.naoh.size} color={PW_TANKS.naoh.color} compactLabel hideLabel />

      {Object.values(PW_PUMPS).map((p) => (
        <Pump3D key={p.id} id={p.id} position={p.position} rotation={[0, p.rotationY, 0]} />
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

      {/* 原水来水(东)→ 总进水阀 */}
      <PipeOpenFlange3D position={[PW_RAW_ENTRY_X, 1.05, S1]} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={[vIn.position[0] + vHalf(vIn.scale), 1.05, S1]} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[[PW_RAW_ENTRY_X, 1.05, S1], [vIn.position[0] + vHalf(vIn.scale), 1.05, S1]]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />
      {/* 总进水阀 → 原水箱顶 */}
      <PipeOpenFlange3D position={[vIn.position[0] - vHalf(vIn.scale), 1.05, S1]} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <PipeOpenFlange3D position={[rawTx, 2.56, rawTz]} axis="-y" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[
          [vIn.position[0] - vHalf(vIn.scale), 1.05, S1],
          [rawTx, 1.05, rawTz],
          [rawTx, 2.75, rawTz],
          [rawTx, 2.56, rawTz],
        ]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 原水箱 → 原水泵吸入 */}
      <PipeOpenFlange3D position={[rawTx - 1.0, 0.46, rawTz]} axis="-x" radius={PW_BRANCH_R} color={FEED} />
      <Pipe3D
        points={[[rawTx - 1.04, 0.46, rawTz], rawSuction]}
        radius={PW_BRANCH_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* 原水泵出口 → 保安①进口 */}
      <PipeOpenFlange3D position={cart1In} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[rawDischarge, [rawDischarge[0], 1.35, S1], cart1In]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
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

      {/* 保安② → R01泵吸入(阻垢剂在此注入) */}
      <PipeOpenFlange3D position={cart2Out} axis="-x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[cart2Out, [cart2Out[0] - 1.3, 0.79, S1], [cart2Out[0] - 1.3, 0.46, S1], ro1Suction]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
      />

      {/* R01泵出口 → 一级膜组进料端(东) */}
      <PipeOpenFlange3D position={ro1FeedPort} axis="+x" radius={PW_MAIN_R} color={FEED} />
      <Pipe3D
        points={[ro1Discharge, [ro1Discharge[0], 1.35, S1], [ro1FeedPort[0] + 0.35, 1.35, S1], [ro1FeedPort[0] + 0.35, 1.31, S1], ro1FeedPort]}
        radius={PW_MAIN_R} color={FEED} flowType="water" animated={true}
        startConnection="equipment" endConnection="equipment"
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
      <PipeOpenFlange3D position={[ro1Tx, 2.56, ro1Tz]} axis="-y" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[
          ro1PermeatePort,
          [ro1PermeatePort[0] - 0.6, 0.65, S1],
          [ro1PermeatePort[0] - 0.6, 2.75, S1],
          [ro1Tx, 2.75, ro1Tz],
          [ro1Tx, 2.56, ro1Tz],
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
          points={[[face[0], 0.46, ro2SuctionHeaderZ], face]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="junction" endConnection="equipment"
          junctionTrim="start" junctionMateRadius={PW_HEADER_R}
        />
      ))}
      {ro2Discharges.map((face, i) => (
        <Pipe3D
          key={`ro2-riser-${i}`}
          points={[face, [face[0], 1.5, ro2DischargeHeaderZ]]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="equipment" endConnection="junction"
          junctionTrim="end" junctionMateRadius={PW_HEADER_R}
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
      <PipeOpenFlange3D position={[ro2Tx, 2.56, ro2Tz]} axis="-y" radius={PW_BRANCH_R} color={PERMEATE} />
      <Pipe3D
        points={[
          ro2PermeatePort,
          [ro2PermeatePort[0] + 0.6, 0.65, S2],
          [ro2PermeatePort[0] + 0.6, 2.75, S2],
          [ro2Tx, 2.75, ro2Tz],
          [ro2Tx, 2.56, ro2Tz],
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
          points={[[face[0], 0.46, ro2SuctionHeaderZ], face]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="junction" endConnection="equipment"
          junctionTrim="start" junctionMateRadius={PW_HEADER_R}
        />
      ))}
      {supplyDischarges.map((face, i) => (
        <Pipe3D
          key={`supply-riser-${i}`}
          points={[face, [face[0], 1.5, ro2DischargeHeaderZ]]}
          radius={PW_BRANCH_R} color={PERMEATE} flowType="water" animated={true}
          startConnection="equipment" endConnection="junction"
          junctionTrim="end" junctionMateRadius={PW_HEADER_R}
        />
      ))}
      <ConvergingHeader3D
        start={supplyDischargeHeader.start} takeoff={supplyDischargeHeader.takeoff} end={supplyDischargeHeader.end}
        radius={PW_HEADER_R} color={PERMEATE} flowType="water"
        capStart={true} capEnd={false}
      />

      {/* 供水排放汇管 → 用水点(东,门型管架支撑) */}
      <PipeRackPortal3D position={[-68, 0, ro2DischargeHeaderZ]} height={1.6} />
      <PipeRackPortal3D position={[-64.5, 0, ro2DischargeHeaderZ]} height={1.6} />
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
