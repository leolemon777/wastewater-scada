/**
 * Process-water and sludge pipe network.
 *
 * This network excludes the separately modelled chemical dosing lines. Every
 * route in this file is derived from the plant process flow:
 *
 *   中间池 → 中间提升泵 → DAF → 混合 → 排水泵 → 外排
 *   沉淀排泥泵 / DAF 浮渣泵 → 污泥池 → 污泥泵 → 叠螺脱水机
 *
 * PH1 → 芬顿 → PH2 → 混凝 → 絮凝 → 沉淀 → PH3 → 中间池 is
 * intentionally omitted here. That complete section uses overflow/civil
 * channels rather than external closed process-water pipes.
 * PH1 → intermediate basin transfers are overflow/civil channels.
 *
 * Pump spools (suction + discharge) and headers are built from
 * processPumpRoutes.ts so every pump attachment lands on a live sealing face.
 */
import React from 'react';
import { Pipe3D } from '../piping/Pipe3D';
import { PipeWallPort3D } from '../piping/PipeWallPort3D';
import { PipeOpenFlange3D } from '../piping/PipeOpenFlange3D';
import { ConvergingHeader3D } from '../piping/ConvergingHeader3D';
import { PipeElbowFitting3D } from '../piping/PipeElbowFitting3D';
import { PumpPipeReducer3D } from '../piping/PumpPipeReducer3D';
import { PIPE_COLORS, WALKWAY_OVERHEAD_PIPE_Y } from '../piping/pipeRouting';
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
import {
  getDischargeDirection,
  getDischargeFacePoint,
  getSuctionDirection,
  getSuctionFacePoint,
  PUMP_FACE_SEAT,
} from '../piping/pumpPorts';

type Point = [number, number, number];

const PROCESS_RADIUS = 0.1;
const DEEP_PROCESS_RADIUS = 0.1;
const SLUDGE_RADIUS = 0.105;
const PROCESS_PORT_Y = 1.1;
const SLUDGE_GALLERY_Y = 3.15;
// DAF sludge transfer uses the clear service gap between the mixing basin
// (east wall x=21) and drainage basin (west wall x=24). The former x=33 route
// crossed directly in front of the municipal monitoring station.
const SLUDGE_TRANSFER_CORRIDOR_X = 22.5;
const DEEP_CORRIDOR_Z = -20.35;
const MIX_DRAIN_CORRIDOR_Z = -19.35;

/**
 * Pedestrian-safe wall jumper: rise tight to the source wall, cross the access
 * strip overhead, then drop tight to the destination wall. The low terminal
 * portions never project horizontally through the walkway.
 */
function overheadWallJumper(from: Point, to: Point, corridorZ: number): Point[] {
  return [
    from,
    [from[0], WALKWAY_OVERHEAD_PIPE_Y, from[2]],
    [from[0], WALKWAY_OVERHEAD_PIPE_Y, corridorZ],
    [to[0], WALKWAY_OVERHEAD_PIPE_Y, corridorZ],
    [to[0], WALKWAY_OVERHEAD_PIPE_Y, to[2]],
    to,
  ];
}

const DAF_INLET: Point = getTankWallPort('tk-daf', 'north', -2.8, PROCESS_PORT_Y);
const DAF_OUTLET: Point = getTankWallPort('tk-daf', 'north', 4, PROCESS_PORT_Y);
const MIXING_INLET: Point = getTankWallPort('tk-mixing', 'north', -3, PROCESS_PORT_Y);
const MIXING_OUTLET: Point = getTankWallPort('tk-mixing', 'north', 3, PROCESS_PORT_Y);
const DRAINAGE_INLET: Point = getTankWallPort('tk-drainage', 'north', -3, PROCESS_PORT_Y);

const OUTFALL_INLET: Point = [40, 1.06, -15];
/**
 * Sludge gallery receiving header — one continuous shell at gallery height.
 * The clarifier branch tees in at the west end and the DAF corridor branch
 * tees in at the east end, so both ends are live incoming tees (mount with
 * capEnds={false}, no runout plugs). The sludge-tank drop leaves from the
 * interior takeoff.
 */
const SLUDGE_RECEIVING_HEADER = {
  start: [CLARIFIER_SLUDGE_HEADER.takeoff[0], SLUDGE_GALLERY_Y, 8.8] as Point,
  end: [SLUDGE_TRANSFER_CORRIDOR_X, SLUDGE_GALLERY_Y, 8.8] as Point,
  takeoff: [5, SLUDGE_GALLERY_Y, 8.8] as Point,
};
const SLUDGE_RECEIVING_MANIFOLD: Point = SLUDGE_RECEIVING_HEADER.takeoff;
const SLUDGE_TANK_INLET: Point = getTankWallPort('tk-sludge', 'north', 0, PROCESS_PORT_Y);
const SLUDGE_TANK_WALL_PENETRATION = 0.4;
// Actual top flange on ScrewPress3D's nested flocculation feed inlet.
const SCREW_PRESS_FEED: Point = [17.15, 1.72, 15];
const OUTFALL_SAMPLE_PICKUP: Point = [40.3, 0.36, -15.5];
const OUTFALL_SAMPLE_WALL_PORT: Point = [38.58, 0.7, -15.5];
const WATER_QUALITY_SAMPLER_INLET: Point = [35.5, 0.85, -11.9];
const OUTFALL_VALVE_X = 34.9;
const OUTFALL_FLOW_METER_X = 36.8;
const SAMPLE_LINE_Y = 0.7;
const SAMPLE_UNDERFLOOR_Y = 0.46;

const northWall = tankWallRotation('north');
const southWall = tankWallRotation('south');
const eastWall = tankWallRotation('east');
const westWall = tankWallRotation('west');

const INTERMEDIATE_TRANSFER_OVERHEAD_Y = 3.0;
const INTERMEDIATE_OUTLET_ELBOW_X = INTERMEDIATE_HEADER.end[0] + 0.55;
const INTERMEDIATE_CLEAR_Z = INTERMEDIATE_HEADER.axisCoord - 1.0;
const INTERMEDIATE_TRANSFER_POINTS: Point[] = [
  // Continue axially from the open header end before the first 90° elbow.
  INTERMEDIATE_HEADER.end,
  [INTERMEDIATE_OUTLET_ELBOW_X, PUMP_HEADER_Y, INTERMEDIATE_HEADER.axisCoord],
  [INTERMEDIATE_OUTLET_ELBOW_X, PUMP_HEADER_Y, INTERMEDIATE_CLEAR_Z],
  [INTERMEDIATE_OUTLET_ELBOW_X, INTERMEDIATE_TRANSFER_OVERHEAD_Y, INTERMEDIATE_CLEAR_Z],
  [-4.6, INTERMEDIATE_TRANSFER_OVERHEAD_Y, INTERMEDIATE_CLEAR_Z],
  [-4.6, INTERMEDIATE_TRANSFER_OVERHEAD_Y, DEEP_CORRIDOR_Z],
  [DAF_INLET[0], INTERMEDIATE_TRANSFER_OVERHEAD_Y, DEEP_CORRIDOR_Z],
  // Drop outside the DAF wall, then use the final elbow for a horizontal entry.
  [DAF_INLET[0], DAF_INLET[1], DEEP_CORRIDOR_Z],
  DAF_INLET,
];
const INTERMEDIATE_VISIBLE_ELBOW_INDICES = [1, 2, 3, 4, 5, 6, 7] as const;

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
            endOverlap={PUMP_FACE_SEAT}
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
            endOverlap={PUMP_FACE_SEAT}
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
          startOverlap={PUMP_FACE_SEAT}
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
          startOverlap={PUMP_FACE_SEAT}
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

    {/* PH1 → intermediate basin transfers are overflow/civil channels. */}
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
      capStart={true}
      capEnd={false}
    />

    <PipeWallPort3D position={DAF_INLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={INTERMEDIATE_TRANSFER_POINTS}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      startJunctionRole="continuous"
    />
    {INTERMEDIATE_VISIBLE_ELBOW_INDICES.map((cornerIndex) => (
      <PipeElbowFitting3D
        key={`intermediate-transfer-elbow-${cornerIndex}`}
        previous={INTERMEDIATE_TRANSFER_POINTS[cornerIndex - 1]}
        corner={INTERMEDIATE_TRANSFER_POINTS[cornerIndex]}
        next={INTERMEDIATE_TRANSFER_POINTS[cornerIndex + 1]}
        radius={DEEP_PROCESS_RADIUS}
        color={PIPE_COLORS.deepWater}
      />
    ))}

    <PipeWallPort3D position={DAF_OUTLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <PipeWallPort3D position={MIXING_INLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={overheadWallJumper(DAF_OUTLET, MIXING_INLET, DEEP_CORRIDOR_Z)}
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
      points={overheadWallJumper(MIXING_OUTLET, DRAINAGE_INLET, MIX_DRAIN_CORRIDOR_Z)}
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
    <Valve3D
      id="v-outflow"
      position={[OUTFALL_VALVE_X, PUMP_HEADER_Y, DRAIN_HEADER.takeoff[2]]}
      rotation={[0, 0, 0]}
      scale={0.42}
    />
    <FlowMeter3D
      id="fm-outfall"
      position={[OUTFALL_FLOW_METER_X, PUMP_HEADER_Y, DRAIN_HEADER.takeoff[2]]}
      rotation={[0, 0, 0]}
    />
    <Pipe3D
      points={[
        DRAIN_HEADER.takeoff,
        [OUTFALL_INLET[0], PUMP_HEADER_Y, OUTFALL_INLET[2]],
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
    />

    {/* ── 排放口水质采样管路：池内取样头 → 自动采样器侧口 ── */}
    <PipeOpenFlange3D position={OUTFALL_SAMPLE_PICKUP} axis="-y" radius={0.02} color={PIPE_COLORS.treatedWater} />
    <PipeWallPort3D
      position={OUTFALL_SAMPLE_WALL_PORT}
      rotation={westWall}
      radius={0.02}
      color={PIPE_COLORS.treatedWater}
    />
    <PipeOpenFlange3D position={WATER_QUALITY_SAMPLER_INLET} axis="-x" radius={0.02} color={PIPE_COLORS.treatedWater} />
    <Pipe3D
      points={[
        OUTFALL_SAMPLE_PICKUP,
        [OUTFALL_SAMPLE_PICKUP[0], SAMPLE_LINE_Y, OUTFALL_SAMPLE_PICKUP[2]],
        [38.25, SAMPLE_LINE_Y, OUTFALL_SAMPLE_PICKUP[2]],
        [38.25, SAMPLE_LINE_Y, -13.9],
        [36.15, SAMPLE_LINE_Y, -13.9],
        [36.15, SAMPLE_UNDERFLOOR_Y, -13.9],
        [36.15, SAMPLE_UNDERFLOOR_Y, WATER_QUALITY_SAMPLER_INLET[2]],
        [36.15, WATER_QUALITY_SAMPLER_INLET[1], WATER_QUALITY_SAMPLER_INLET[2]],
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
        SLUDGE_RECEIVING_HEADER.start,
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
        [SLUDGE_TRANSFER_CORRIDOR_X, SLUDGE_GALLERY_Y, DAF_SLUDGE_HEADER.takeoff[2]],
        SLUDGE_RECEIVING_HEADER.end,
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
    />
    {/* Gallery receiving header: both ends are live incoming branch tees. */}
    <ConvergingHeader3D
      start={SLUDGE_RECEIVING_HEADER.start}
      takeoff={SLUDGE_RECEIVING_HEADER.takeoff}
      end={SLUDGE_RECEIVING_HEADER.end}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      capEnds={false}
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
    {/* 污泥外送双泵：两根纯竖直支管以正式三通接入连续汇流横管。 */}
    <SludgePumpDischargeRisers
      routes={SLUDGE_OUT_ROUTES}
      color={PIPE_COLORS.sludge}
      junctionMateRadius={SLUDGE_RADIUS}
    />
    <ConvergingHeader3D
      start={SLUDGE_OUT_HEADER.start}
      takeoff={SLUDGE_OUT_HEADER.takeoff}
      end={SLUDGE_OUT_HEADER.end}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
    />
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
    />
  </group>
);
