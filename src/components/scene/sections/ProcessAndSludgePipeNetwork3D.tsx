/**
 * Process-water and sludge pipe network.
 *
 * This network deliberately starts after the existing lift-header → PH1 handoff
 * and excludes the separately modelled chemical dosing lines.  Every route in
 * this file is derived from the plant process flow:
 *
 *   絮凝 → 沉淀 → PH3 → 中间池 → 中间提升泵 → DAF → 混合 → 排水泵 → 外排
 *   沉淀排泥泵 / DAF 浮渣泵 → 污泥池 → 污泥泵 → 叠螺脱水机
 *
 * PH1 → 芬顿 → PH2 → 混凝 → 絮凝 is intentionally omitted here. Those
 * basins are physically connected by the open OverflowCascade3D weirs, rather
 * than by external closed pipework.
 *
 * Pump spools (suction + discharge) and headers are built from
 * processPumpRoutes.ts so every pump attachment lands on a live sealing face.
 */
import React from 'react';
import { Pipe3D } from '../piping/Pipe3D';
import { PipeWallPort3D } from '../piping/PipeWallPort3D';
import { PipeOpenFlange3D } from '../piping/PipeOpenFlange3D';
import { ConvergingHeader3D } from '../piping/ConvergingHeader3D';
import { PumpPipeReducer3D } from '../piping/PumpPipeReducer3D';
import { PIPE_COLORS } from '../piping/pipeRouting';
import { FlowMeter3D } from '../equipment/FlowMeter3D';
import { Valve3D } from '../equipment/Valve3D';
import { PumpPipeFlanges3D } from '../piping/PumpPipeFlanges3D';
import {
  CLARIFIER_SLUDGE_HEADER,
  CLARIFIER_SLUDGE_ROUTES,
  DAF_SLUDGE_HEADER,
  DAF_SLUDGE_ROUTES,
  DRAIN_HEADER,
  DRAIN_ROUTES,
  INTERMEDIATE_HEADER,
  INTERMEDIATE_ROUTES,
  PUMP_DISCHARGE_RADIUS,
  PUMP_HEADER_Y,
  PUMP_SUCTION_RADIUS,
  SLUDGE_OUT_HEADER,
  SLUDGE_OUT_ROUTES,
  type ProcessPumpRoute,
} from './processPumpRoutes';
import { getTankWallPort, tankWallRotation } from './tankLayout';
import { getDischargeDirection, getDischargeFacePoint, getSuctionDirection, getSuctionFacePoint } from '../piping/pumpPorts';

type Point = [number, number, number];

const PROCESS_RADIUS = 0.1;
const DEEP_PROCESS_RADIUS = 0.1;
const SLUDGE_RADIUS = 0.105;
const PROCESS_PORT_Y = 1.1;
const ELEVATED_TRANSFER_Y = 1.65;
const SLUDGE_GALLERY_Y = 3.15;
const SLUDGE_EAST_CORRIDOR_X = 33;
/**
 * Shared north corridor — just outside the clarifier/PH3 north walls.
 *
 * Keep this route on the wall side of the fixed 2# clarifier-return control
 * cabinet at z≈-5.2.  The old corridor was collinear with that cabinet,
 * so the tube was rendered through the cabinet in close views even though its
 * two wall endpoints were valid.
 */
const PROCESS_CORRIDOR_CLEARANCE = 0.3;
const PROCESS_CORRIDOR_Z = getTankWallPort('tk-clarifier', 'north')[2] - PROCESS_CORRIDOR_CLEARANCE;
const DEEP_CORRIDOR_Z = -20.35;
const MIX_DRAIN_CORRIDOR_Z = -19.35;

/**
 * Continuous U-jumper: wall → corridor → corridor → wall.
 * One polyline so Pipe3D draws a single tube with filleted elbows (no mid joints).
 * Collinear when from/to already share corridor Z is cleaned by Pipe3D.
 */
function wallJumper(from: Point, to: Point, corridorZ: number): Point[] {
  // Same corridor plane already: only three points if ends sit on the corridor.
  if (Math.abs(from[2] - corridorZ) < 1e-6 && Math.abs(to[2] - corridorZ) < 1e-6) {
    return [from, to];
  }
  if (Math.abs(from[2] - corridorZ) < 1e-6) {
    return [from, [to[0], to[1], corridorZ], to];
  }
  if (Math.abs(to[2] - corridorZ) < 1e-6) {
    return [from, [from[0], from[1], corridorZ], to];
  }
  return [
    from,
    [from[0], from[1], corridorZ],
    [to[0], to[1], corridorZ],
    to,
  ];
}

// Main water line — world positions, placed on the external north-side corridor
// of each basin so pipes do not pass through water volumes or agitators.
const FLOC_OUTLET: Point = getTankWallPort('tk-flocculation', 'north', 2.85, PROCESS_PORT_Y);
const CLARIFIER_INLET: Point = getTankWallPort('tk-clarifier', 'north', -3.15, PROCESS_PORT_Y);
const CLARIFIER_OUTLET: Point = getTankWallPort('tk-clarifier', 'north', 1.45, PROCESS_PORT_Y);
const PH3_INLET: Point = getTankWallPort('tk-ph3', 'north', -0.85, PROCESS_PORT_Y);
const PH3_OUTLET: Point = getTankWallPort('tk-ph3', 'north', 2.55, PROCESS_PORT_Y);
const INTERMEDIATE_INLET: Point = getTankWallPort('tk-intermediate', 'north', 2.5, PROCESS_PORT_Y);

const DAF_INLET: Point = getTankWallPort('tk-daf', 'north', -2.8, PROCESS_PORT_Y);
const DAF_OUTLET: Point = getTankWallPort('tk-daf', 'north', 4, PROCESS_PORT_Y);
const MIXING_INLET: Point = getTankWallPort('tk-mixing', 'north', -3, PROCESS_PORT_Y);
const MIXING_OUTLET: Point = getTankWallPort('tk-mixing', 'north', 3, PROCESS_PORT_Y);
const DRAINAGE_INLET: Point = getTankWallPort('tk-drainage', 'north', -3, PROCESS_PORT_Y);

const OUTFALL_INLET: Point = [40, 1.06, -15];
const SLUDGE_RECEIVING_MANIFOLD: Point = [5, SLUDGE_GALLERY_Y, 8.8];
const SLUDGE_TANK_INLET: Point = getTankWallPort('tk-sludge', 'north', 0, PROCESS_PORT_Y);
const SLUDGE_TANK_WALL_PENETRATION = 0.4;
// Actual top flange on ScrewPress3D's nested flocculation feed inlet.
const SCREW_PRESS_FEED: Point = [17.15, 1.72, 15];
const OUTFALL_SAMPLE_PICKUP: Point = [40.3, 0.36, -15.5];
const WATER_QUALITY_SAMPLER_INLET: Point = [35.5, 0.85, -11.9];

const northWall = tankWallRotation('north');
const southWall = tankWallRotation('south');
const eastWall = tankWallRotation('east');

function PumpGroupFlanges({
  routes,
  color,
  pipeRadius,
}: {
  routes: readonly ProcessPumpRoute[];
  color: string;
  pipeRadius: number;
}) {
  return (
    <>
      {routes.map((route) => (
        <React.Fragment key={`${route.id}-connections`}>
          <PumpPipeFlanges3D
            position={route.position}
            rotationY={route.rotationY}
            suctionRadius={PUMP_SUCTION_RADIUS}
            dischargeRadius={PUMP_DISCHARGE_RADIUS}
            color={color}
          />
          <PumpPipeReducer3D
            position={getSuctionFacePoint(route.position, route.rotationY)}
            direction={getSuctionDirection(route.rotationY)}
            pumpRadius={PUMP_SUCTION_RADIUS}
            pipeRadius={pipeRadius}
            color={color}
          />
          <PumpPipeReducer3D
            position={getDischargeFacePoint(route.position, route.rotationY)}
            direction={getDischargeDirection(route.rotationY)}
            pumpRadius={PUMP_DISCHARGE_RADIUS}
            pipeRadius={pipeRadius}
            color={color}
          />
        </React.Fragment>
      ))}
    </>
  );
}

function WaterPumpSuctionSpools({
  routes,
  color,
  wallRotation,
}: {
  routes: readonly ProcessPumpRoute[];
  color: string;
  wallRotation: [number, number, number];
}) {
  return (
    <>
      {routes.map((route) => (
        <React.Fragment key={`${route.id}-suction`}>
          <PipeWallPort3D
            position={route.wallPoint}
            rotation={wallRotation}
            radius={PUMP_SUCTION_RADIUS}
            color={color}
          />
          <Pipe3D
            points={route.suctionPoints}
            radius={PUMP_SUCTION_RADIUS}
            color={color}
            flowType="water"
            animated={true}
            startConnection="equipment"
            endConnection="equipment"
            endOverlap={0}
          />
        </React.Fragment>
      ))}
    </>
  );
}

function SludgePumpSuctionSpools({
  routes,
  color,
  wallRotation,
}: {
  routes: readonly ProcessPumpRoute[];
  color: string;
  wallRotation: [number, number, number];
}) {
  return (
    <>
      {routes.map((route) => (
        <React.Fragment key={`${route.id}-suction`}>
          <PipeWallPort3D
            position={route.wallPoint}
            rotation={wallRotation}
            radius={PUMP_SUCTION_RADIUS}
            color={color}
          />
          <Pipe3D
            points={route.suctionPoints}
            radius={PUMP_SUCTION_RADIUS}
            color={color}
            flowType="sludge"
            animated={true}
            startConnection="equipment"
            endConnection="equipment"
            endOverlap={0}
          />
        </React.Fragment>
      ))}
    </>
  );
}

function WaterPumpDischargeRisers({
  routes,
  color,
  junctionMateRadius,
}: {
  routes: readonly ProcessPumpRoute[];
  color: string;
  junctionMateRadius: number;
}) {
  return (
    <>
      {routes.map((route) => (
        <Pipe3D
          key={`${route.id}-discharge`}
          points={route.dischargePoints}
          radius={PUMP_DISCHARGE_RADIUS}
          color={color}
          flowType="water"
          animated={true}
          startConnection="equipment"
          startOverlap={0}
          endConnection="junction"
          junctionTrim="end"
          junctionMateRadius={junctionMateRadius}
        />
      ))}
    </>
  );
}

function SludgePumpDischargeRisers({
  routes,
  color,
  junctionMateRadius,
}: {
  routes: readonly ProcessPumpRoute[];
  color: string;
  junctionMateRadius: number;
}) {
  return (
    <>
      {routes.map((route) => (
        <Pipe3D
          key={`${route.id}-discharge`}
          points={route.dischargePoints}
          radius={PUMP_DISCHARGE_RADIUS}
          color={color}
          flowType="sludge"
          animated={true}
          startConnection="equipment"
          startOverlap={0}
          endConnection="junction"
          junctionTrim="end"
          junctionMateRadius={junctionMateRadius}
        />
      ))}
    </>
  );
}

export const ProcessAndSludgePipeNetwork3D: React.FC = () => (
  <group userData={{ bakeExclude: true }}>
    <PumpGroupFlanges routes={INTERMEDIATE_ROUTES} color={PIPE_COLORS.deepWater} pipeRadius={DEEP_PROCESS_RADIUS} />
    <PumpGroupFlanges routes={DRAIN_ROUTES} color={PIPE_COLORS.treatedWater} pipeRadius={PROCESS_RADIUS} />
    <PumpGroupFlanges routes={CLARIFIER_SLUDGE_ROUTES} color={PIPE_COLORS.sludge} pipeRadius={SLUDGE_RADIUS} />
    <PumpGroupFlanges routes={DAF_SLUDGE_ROUTES} color={PIPE_COLORS.sludge} pipeRadius={SLUDGE_RADIUS} />
    <PumpGroupFlanges routes={SLUDGE_OUT_ROUTES} color={PIPE_COLORS.sludge} pipeRadius={SLUDGE_RADIUS} />

    {/* ===== Gravity / main process water ===== */}
    <PipeWallPort3D position={FLOC_OUTLET} rotation={northWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.processWater} />
    <PipeWallPort3D position={CLARIFIER_INLET} rotation={northWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.processWater} />
    <Pipe3D
      points={wallJumper(FLOC_OUTLET, CLARIFIER_INLET, PROCESS_CORRIDOR_Z)}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.processWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
      showSupports
    />

    <PipeWallPort3D position={CLARIFIER_OUTLET} rotation={northWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.processWater} />
    <PipeWallPort3D position={PH3_INLET} rotation={northWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.processWater} />
    <Pipe3D
      points={wallJumper(CLARIFIER_OUTLET, PH3_INLET, PROCESS_CORRIDOR_Z)}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.processWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
      showSupports
    />

    <PipeWallPort3D position={PH3_OUTLET} rotation={northWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.processWater} />
    <PipeWallPort3D position={INTERMEDIATE_INLET} rotation={northWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.processWater} />
    <Pipe3D
      points={[
        PH3_OUTLET,
        [PH3_OUTLET[0], ELEVATED_TRANSFER_Y, PH3_OUTLET[2]],
        [PH3_OUTLET[0], ELEVATED_TRANSFER_Y, PROCESS_CORRIDOR_Z],
        [INTERMEDIATE_INLET[0], ELEVATED_TRANSFER_Y, PROCESS_CORRIDOR_Z],
        [INTERMEDIATE_INLET[0], ELEVATED_TRANSFER_Y, INTERMEDIATE_INLET[2]],
        INTERMEDIATE_INLET,
      ]}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.processWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />

    {/* 中间池 → 中间提升泵组 → DAF */}
    <WaterPumpSuctionSpools
      routes={INTERMEDIATE_ROUTES}
      color={PIPE_COLORS.deepWater}
      wallRotation={northWall}
    />
    <WaterPumpDischargeRisers
      routes={INTERMEDIATE_ROUTES}
      color={PIPE_COLORS.deepWater}
      junctionMateRadius={DEEP_PROCESS_RADIUS}
    />
    <ConvergingHeader3D
      start={INTERMEDIATE_HEADER.start}
      takeoff={INTERMEDIATE_HEADER.takeoff}
      end={INTERMEDIATE_HEADER.end}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
    />

    <PipeWallPort3D position={DAF_INLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={(() => {
        // Header centreline → one south clearance past the pump motors → deep
        // corridor → DAF wall. No extra free-stub doglegs off the discharge faces.
        const takeoff = INTERMEDIATE_HEADER.takeoff;
        const clearZ = INTERMEDIATE_HEADER.axisCoord - 1.0;
        return [
          takeoff,
          [takeoff[0], PUMP_HEADER_Y, clearZ],
          [-4.6, PUMP_HEADER_Y, clearZ],
          [-4.6, PUMP_HEADER_Y, DEEP_CORRIDOR_Z],
          [DAF_INLET[0], PUMP_HEADER_Y, DEEP_CORRIDOR_Z],
          [DAF_INLET[0], PROCESS_PORT_Y, DEEP_CORRIDOR_Z],
          DAF_INLET,
        ];
      })()}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
      junctionMateRadius={DEEP_PROCESS_RADIUS}
      showSupports
    />

    <PipeWallPort3D position={DAF_OUTLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <PipeWallPort3D position={MIXING_INLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={wallJumper(DAF_OUTLET, MIXING_INLET, DEEP_CORRIDOR_Z)}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />

    <PipeWallPort3D position={MIXING_OUTLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <PipeWallPort3D position={DRAINAGE_INLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={wallJumper(MIXING_OUTLET, DRAINAGE_INLET, MIX_DRAIN_CORRIDOR_Z)}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />

    {/* 排水池 → 排水泵组 → 外排检测池 */}
    <WaterPumpSuctionSpools
      routes={DRAIN_ROUTES}
      color={PIPE_COLORS.treatedWater}
      wallRotation={eastWall}
    />
    <WaterPumpDischargeRisers
      routes={DRAIN_ROUTES}
      color={PIPE_COLORS.treatedWater}
      junctionMateRadius={PROCESS_RADIUS}
    />
    <ConvergingHeader3D
      start={DRAIN_HEADER.start}
      takeoff={DRAIN_HEADER.takeoff}
      end={DRAIN_HEADER.end}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
    />
    <PipeOpenFlange3D position={OUTFALL_INLET} axis="-y" radius={PROCESS_RADIUS} color={PIPE_COLORS.treatedWater} />
    <Valve3D id="v-outflow" position={[35.0, PUMP_HEADER_Y, DRAIN_HEADER.takeoff[2]]} rotation={[0, 0, 0]} scale={0.42} />
    <FlowMeter3D id="fm-outfall" position={[36.8, OUTFALL_INLET[1], DRAIN_HEADER.takeoff[2]]} rotation={[0, 0, 0]} />
    <Pipe3D
      points={[
        DRAIN_HEADER.takeoff,
        [34.8, PUMP_HEADER_Y, DRAIN_HEADER.takeoff[2]],
        [34.8, OUTFALL_INLET[1], DRAIN_HEADER.takeoff[2]],
        OUTFALL_INLET,
      ]}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
      junctionMateRadius={PROCESS_RADIUS}
      showSupports
    />

    {/* ── 排放口水质采样管路：池内取样头 → 自动采样器侧口 ── */}
    <PipeOpenFlange3D position={OUTFALL_SAMPLE_PICKUP} axis="-y" radius={0.02} color={PIPE_COLORS.treatedWater} />
    <PipeOpenFlange3D position={WATER_QUALITY_SAMPLER_INLET} axis="-x" radius={0.02} color={PIPE_COLORS.treatedWater} />
    <Pipe3D
      points={[
        OUTFALL_SAMPLE_PICKUP,
        [OUTFALL_SAMPLE_PICKUP[0], 1.0, OUTFALL_SAMPLE_PICKUP[2]],
        [36.5, 1.0, OUTFALL_SAMPLE_PICKUP[2]],
        [36.5, 1.0, WATER_QUALITY_SAMPLER_INLET[2]],
        [36.5, WATER_QUALITY_SAMPLER_INLET[1], WATER_QUALITY_SAMPLER_INLET[2]],
        WATER_QUALITY_SAMPLER_INLET,
      ]}
      radius={0.02}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="terminal"
      endConnection="equipment"
    />

    {/* ===== Sludge collection and dewatering ===== */}
    <SludgePumpSuctionSpools
      routes={CLARIFIER_SLUDGE_ROUTES}
      color={PIPE_COLORS.sludge}
      wallRotation={southWall}
    />
    <SludgePumpDischargeRisers
      routes={CLARIFIER_SLUDGE_ROUTES}
      color={PIPE_COLORS.sludge}
      junctionMateRadius={SLUDGE_RADIUS}
    />
    <ConvergingHeader3D
      start={CLARIFIER_SLUDGE_HEADER.start}
      takeoff={CLARIFIER_SLUDGE_HEADER.takeoff}
      end={CLARIFIER_SLUDGE_HEADER.end}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
    />
    <Pipe3D
      points={[
        CLARIFIER_SLUDGE_HEADER.takeoff,
        [CLARIFIER_SLUDGE_HEADER.takeoff[0], SLUDGE_GALLERY_Y, CLARIFIER_SLUDGE_HEADER.takeoff[2]],
        [CLARIFIER_SLUDGE_HEADER.takeoff[0], SLUDGE_GALLERY_Y, SLUDGE_RECEIVING_MANIFOLD[2]],
        SLUDGE_RECEIVING_MANIFOLD,
      ]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="junction"
      junctionTrim="start"
      junctionMateRadius={SLUDGE_RADIUS}
      endJunctionRole="continuous"
      showSupports
    />

    <SludgePumpSuctionSpools
      routes={DAF_SLUDGE_ROUTES}
      color={PIPE_COLORS.sludge}
      wallRotation={northWall}
    />
    <SludgePumpDischargeRisers
      routes={DAF_SLUDGE_ROUTES}
      color={PIPE_COLORS.sludge}
      junctionMateRadius={SLUDGE_RADIUS}
    />
    <ConvergingHeader3D
      start={DAF_SLUDGE_HEADER.start}
      takeoff={DAF_SLUDGE_HEADER.takeoff}
      end={DAF_SLUDGE_HEADER.end}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
    />
    <Pipe3D
      points={[
        DAF_SLUDGE_HEADER.takeoff,
        [DAF_SLUDGE_HEADER.takeoff[0], SLUDGE_GALLERY_Y, DAF_SLUDGE_HEADER.takeoff[2]],
        [SLUDGE_EAST_CORRIDOR_X, SLUDGE_GALLERY_Y, DAF_SLUDGE_HEADER.takeoff[2]],
        [SLUDGE_EAST_CORRIDOR_X, SLUDGE_GALLERY_Y, SLUDGE_RECEIVING_MANIFOLD[2]],
        SLUDGE_RECEIVING_MANIFOLD,
      ]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="junction"
      junctionTrim="start"
      junctionMateRadius={SLUDGE_RADIUS}
      endJunctionRole="continuous"
      showSupports
    />
    <PipeWallPort3D position={SLUDGE_TANK_INLET} rotation={northWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={[
        SLUDGE_RECEIVING_MANIFOLD,
        [SLUDGE_TANK_INLET[0], SLUDGE_GALLERY_Y, SLUDGE_RECEIVING_MANIFOLD[2]],
        [SLUDGE_TANK_INLET[0], SLUDGE_GALLERY_Y, SLUDGE_TANK_INLET[2]],
        [SLUDGE_TANK_INLET[0], SLUDGE_TANK_INLET[1], SLUDGE_TANK_INLET[2] + SLUDGE_TANK_WALL_PENETRATION],
      ]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
      junctionMateRadius={SLUDGE_RADIUS}
    />

    <SludgePumpSuctionSpools
      routes={SLUDGE_OUT_ROUTES}
      color={PIPE_COLORS.sludge}
      wallRotation={eastWall}
    />
    {/* Two continuous pump-face → riser → common takeoff tubes. */}
    {SLUDGE_OUT_ROUTES.map((route) => (
      <Pipe3D
        key={`${route.id}-continuous-discharge`}
        points={[...route.dischargePoints, SLUDGE_OUT_HEADER.takeoff]}
        radius={SLUDGE_RADIUS}
        color={PIPE_COLORS.sludge}
        flowType="sludge"
        animated={true}
        startConnection="equipment"
        endConnection="junction"
        endJunctionRole="continuous"
      />
    ))}
    <PipeOpenFlange3D position={SCREW_PRESS_FEED} axis="-y" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={[
        SLUDGE_OUT_HEADER.takeoff,
        [SCREW_PRESS_FEED[0], PUMP_HEADER_Y, SLUDGE_OUT_HEADER.takeoff[2]],
        SCREW_PRESS_FEED,
      ]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
      junctionMateRadius={SLUDGE_RADIUS}
      showSupports
    />
  </group>
);
