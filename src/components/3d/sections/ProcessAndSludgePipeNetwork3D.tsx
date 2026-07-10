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
 */
import React from 'react';
import { Pipe3D } from '../Pipe3D';
import { PipeWallPort3D } from '../PipeWallPort3D';
import { PipeBlindFlange3D } from '../PipeBlindFlange3D';
import { PipeOpenFlange3D } from '../PipeOpenFlange3D';
import { PIPE_COLORS } from '../pipeRouting';
import { getDirectTankSuctionBranch, getDischargeBranch } from '../pumpPorts';
import { FlowMeter3D } from '../FlowMeter3D';
import { Valve3D } from '../Valve3D';

type Point = [number, number, number];

const PROCESS_RADIUS = 0.1;
const DEEP_PROCESS_RADIUS = 0.1;
const SLUDGE_RADIUS = 0.105;
const PUMP_HEADER_Y = 2.55;
const PROCESS_PORT_Y = 1.1;
const SUCTION_PORT_Y = 0.89;
const SLUDGE_PORT_Y = 0.9;
const ELEVATED_TRANSFER_Y = 1.65;
const SLUDGE_GALLERY_Y = 3.15;
const SLUDGE_EAST_CORRIDOR_X = 33;
/** Shared north corridor — outside every north wall (clarifier wall ≈ -4). */
const PROCESS_CORRIDOR_Z = -5.15;
const DEEP_CORRIDOR_Z = -20.35;
const MIX_DRAIN_CORRIDOR_Z = -19.35;

/**
 * Continuous U-jumper: wall → corridor → corridor → wall.
 * One polyline so Pipe3D draws a single tube with filleted elbows (no mid joints).
 */
function wallJumper(from: Point, to: Point, corridorZ: number): Point[] {
  return [
    from,
    [from[0], from[1], corridorZ],
    [to[0], to[1], corridorZ],
    to,
  ];
}

// Main water line — world positions, placed on the external north-side corridor
// of each basin so pipes do not pass through water volumes or agitators.
const FLOC_OUTLET: Point = [-13.15, PROCESS_PORT_Y, -3.05];
const CLARIFIER_INLET: Point = [-1.15, PROCESS_PORT_Y, -4.05];
const CLARIFIER_OUTLET: Point = [3.45, PROCESS_PORT_Y, -4.05];
const PH3_INLET: Point = [10.15, PROCESS_PORT_Y, -3.05];
const PH3_OUTLET: Point = [13.55, PROCESS_PORT_Y, -3.05];
const INTERMEDIATE_INLET: Point = [21.5, PROCESS_PORT_Y, -3.05];

const INTERMEDIATE_PUMP_A: Point = [18, 0.5, -8];
const INTERMEDIATE_PUMP_B: Point = [16, 0.5, -8];
const INTERMEDIATE_PUMP_ROTATION = Math.PI;
const INTERMEDIATE_SUCTION_A: Point = [18, SUCTION_PORT_Y, -3.05];
const INTERMEDIATE_SUCTION_B: Point = [16, SUCTION_PORT_Y, -3.05];
const INTERMEDIATE_HEADER_START: Point = [15.2, PUMP_HEADER_Y, -7.61];
const INTERMEDIATE_HEADER_END: Point = [18.8, PUMP_HEADER_Y, -7.61];
const INTERMEDIATE_TO_DAF_TAKEOFF: Point = [16, PUMP_HEADER_Y, -7.61];
const DAF_INLET: Point = [5.2, PROCESS_PORT_Y, -19.05];

const DAF_OUTLET: Point = [12, PROCESS_PORT_Y, -19.05];
const MIXING_INLET: Point = [15, PROCESS_PORT_Y, -18.05];
const MIXING_OUTLET: Point = [21, PROCESS_PORT_Y, -18.05];
const DRAINAGE_INLET: Point = [24, PROCESS_PORT_Y, -18.05];

const DRAIN_PUMP_A: Point = [32, 0.5, -17];
const DRAIN_PUMP_B: Point = [32, 0.5, -13];
const DRAIN_PUMP_ROTATION = Math.PI / 2;
const DRAINAGE_SUCTION_A: Point = [30.05, SUCTION_PORT_Y, -17];
const DRAINAGE_SUCTION_B: Point = [30.05, SUCTION_PORT_Y, -13];
const DRAIN_HEADER_START: Point = [31.61, PUMP_HEADER_Y, -17.7];
const DRAIN_HEADER_END: Point = [31.61, PUMP_HEADER_Y, -12.3];
const DRAIN_TO_OUTFALL_TAKEOFF: Point = [31.61, PUMP_HEADER_Y, -15];
const OUTFALL_INLET: Point = [40, 1.06, -15];

// Sludge line — the two sources remain separate until the shared receiving
// manifold immediately upstream of the sludge tank.
const CLARIFIER_SLUDGE_PUMP_A: Point = [1, 0.5, 5];
const CLARIFIER_SLUDGE_PUMP_B: Point = [3, 0.5, 5];
const CLARIFIER_SLUDGE_ROTATION = 0;
const CLARIFIER_SLUDGE_SUCTION_A: Point = [1, SLUDGE_PORT_Y, 4.05];
const CLARIFIER_SLUDGE_SUCTION_B: Point = [3, SLUDGE_PORT_Y, 4.05];
const CLARIFIER_SLUDGE_HEADER_START: Point = [0.2, PUMP_HEADER_Y, 4.61];
const CLARIFIER_SLUDGE_HEADER_END: Point = [3.8, PUMP_HEADER_Y, 4.61];
const CLARIFIER_SLUDGE_TAKEOFF: Point = [3, PUMP_HEADER_Y, 4.61];

const DAF_SLUDGE_PUMP_A: Point = [6.8, 0.5, -20.55];
const DAF_SLUDGE_PUMP_B: Point = [9.2, 0.5, -20.55];
const DAF_SLUDGE_ROTATION = Math.PI;
const DAF_SLUDGE_SUCTION_A: Point = [6.8, SLUDGE_PORT_Y, -19.05];
const DAF_SLUDGE_SUCTION_B: Point = [9.2, SLUDGE_PORT_Y, -19.05];
const DAF_SLUDGE_HEADER_START: Point = [6.1, PUMP_HEADER_Y, -20.16];
const DAF_SLUDGE_HEADER_END: Point = [9.9, PUMP_HEADER_Y, -20.16];
const DAF_SLUDGE_TAKEOFF: Point = [9.2, PUMP_HEADER_Y, -20.16];

const SLUDGE_RECEIVING_MANIFOLD: Point = [5, SLUDGE_GALLERY_Y, 8.8];
const SLUDGE_TANK_INLET: Point = [5, PROCESS_PORT_Y, 11.05];

const SLUDGE_OUT_PUMP_A: Point = [11, 0.5, 13];
const SLUDGE_OUT_PUMP_B: Point = [11, 0.5, 17];
const SLUDGE_OUT_ROTATION = Math.PI / 2;
const SLUDGE_TANK_SUCTION_A: Point = [9.05, SLUDGE_PORT_Y, 13];
const SLUDGE_TANK_SUCTION_B: Point = [9.05, SLUDGE_PORT_Y, 17];
const SLUDGE_OUT_HEADER_START: Point = [10.61, PUMP_HEADER_Y, 12.3];
const SLUDGE_OUT_HEADER_END: Point = [10.61, PUMP_HEADER_Y, 17.7];
const SLUDGE_TO_PRESS_TAKEOFF: Point = [10.61, PUMP_HEADER_Y, 15];
// Actual top flange on ScrewPress3D's nested flocculation feed inlet.
const SCREW_PRESS_FEED: Point = [17.15, 1.72, 15];
const OUTFALL_SAMPLE_PICKUP: Point = [40.3, 0.36, -15.5];
const WATER_QUALITY_SAMPLER_INLET: Point = [35.5, 0.85, -11.9];

const northWall: [number, number, number] = [-Math.PI / 2, 0, 0];
const southWall: [number, number, number] = [Math.PI / 2, 0, 0];
const eastWall: [number, number, number] = [0, 0, -Math.PI / 2];

// Suction polylines are the single source of truth for wall-port height/position
// (pipe runs at pump-mouth height; wall flange must sit on that same centreline).
const INTER_SUCTION_A = getDirectTankSuctionBranch(INTERMEDIATE_PUMP_A, INTERMEDIATE_PUMP_ROTATION, INTERMEDIATE_SUCTION_A);
const INTER_SUCTION_B = getDirectTankSuctionBranch(INTERMEDIATE_PUMP_B, INTERMEDIATE_PUMP_ROTATION, INTERMEDIATE_SUCTION_B);
const DRAIN_SUCTION_A = getDirectTankSuctionBranch(DRAIN_PUMP_A, DRAIN_PUMP_ROTATION, DRAINAGE_SUCTION_A);
const DRAIN_SUCTION_B = getDirectTankSuctionBranch(DRAIN_PUMP_B, DRAIN_PUMP_ROTATION, DRAINAGE_SUCTION_B);
const CLAR_SLUDGE_SUCTION_A = getDirectTankSuctionBranch(CLARIFIER_SLUDGE_PUMP_A, CLARIFIER_SLUDGE_ROTATION, CLARIFIER_SLUDGE_SUCTION_A);
const CLAR_SLUDGE_SUCTION_B = getDirectTankSuctionBranch(CLARIFIER_SLUDGE_PUMP_B, CLARIFIER_SLUDGE_ROTATION, CLARIFIER_SLUDGE_SUCTION_B);
const DAF_SLUDGE_SUCTION_PTS_A = getDirectTankSuctionBranch(DAF_SLUDGE_PUMP_A, DAF_SLUDGE_ROTATION, DAF_SLUDGE_SUCTION_A);
const DAF_SLUDGE_SUCTION_PTS_B = getDirectTankSuctionBranch(DAF_SLUDGE_PUMP_B, DAF_SLUDGE_ROTATION, DAF_SLUDGE_SUCTION_B);
const SLUDGE_OUT_SUCTION_A = getDirectTankSuctionBranch(SLUDGE_OUT_PUMP_A, SLUDGE_OUT_ROTATION, SLUDGE_TANK_SUCTION_A);
const SLUDGE_OUT_SUCTION_B = getDirectTankSuctionBranch(SLUDGE_OUT_PUMP_B, SLUDGE_OUT_ROTATION, SLUDGE_TANK_SUCTION_B);

export const ProcessAndSludgePipeNetwork3D: React.FC = () => (
  <group userData={{ bakeExclude: true }}>
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

    {/* 中间池 → 中间提升泵组 */}
    <PipeWallPort3D position={INTERMEDIATE_SUCTION_A} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={INTER_SUCTION_A}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <PipeWallPort3D position={INTERMEDIATE_SUCTION_B} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={INTER_SUCTION_B}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <Pipe3D
      points={getDischargeBranch(INTERMEDIATE_PUMP_A, INTERMEDIATE_PUMP_ROTATION, PUMP_HEADER_Y, -7.61)}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={getDischargeBranch(INTERMEDIATE_PUMP_B, INTERMEDIATE_PUMP_ROTATION, PUMP_HEADER_Y, -7.61)}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={[INTERMEDIATE_HEADER_START, INTERMEDIATE_HEADER_END]}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="terminal"
      endConnection="terminal"
      sealedStart
      sealedEnd
    />
    <PipeBlindFlange3D position={INTERMEDIATE_HEADER_START} axis="-x" radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <PipeBlindFlange3D position={INTERMEDIATE_HEADER_END} axis="+x" radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />

    <PipeWallPort3D position={DAF_INLET} rotation={northWall} radius={DEEP_PROCESS_RADIUS} color={PIPE_COLORS.deepWater} />
    <Pipe3D
      points={[
        INTERMEDIATE_TO_DAF_TAKEOFF,
        [16, PUMP_HEADER_Y, -8.6],
        [-4.6, PUMP_HEADER_Y, -8.6],
        [-4.6, PUMP_HEADER_Y, -20.2],
        [5.2, PUMP_HEADER_Y, -20.2],
        [5.2, PROCESS_PORT_Y, -20.2],
        DAF_INLET,
      ]}
      radius={DEEP_PROCESS_RADIUS}
      color={PIPE_COLORS.deepWater}
      flowType="water"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
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
    <PipeWallPort3D position={DRAINAGE_SUCTION_A} rotation={eastWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.treatedWater} />
    <Pipe3D
      points={DRAIN_SUCTION_A}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <PipeWallPort3D position={DRAINAGE_SUCTION_B} rotation={eastWall} radius={PROCESS_RADIUS} color={PIPE_COLORS.treatedWater} />
    <Pipe3D
      points={DRAIN_SUCTION_B}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <Pipe3D
      points={getDischargeBranch(DRAIN_PUMP_A, DRAIN_PUMP_ROTATION, PUMP_HEADER_Y, -17)}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={getDischargeBranch(DRAIN_PUMP_B, DRAIN_PUMP_ROTATION, PUMP_HEADER_Y, -13)}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={[DRAIN_HEADER_START, DRAIN_HEADER_END]}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="terminal"
      endConnection="terminal"
      sealedStart
      sealedEnd
    />
    <PipeBlindFlange3D position={DRAIN_HEADER_START} axis="-z" radius={PROCESS_RADIUS} color={PIPE_COLORS.treatedWater} />
    <PipeBlindFlange3D position={DRAIN_HEADER_END} axis="+z" radius={PROCESS_RADIUS} color={PIPE_COLORS.treatedWater} />
    <PipeOpenFlange3D position={OUTFALL_INLET} axis="-y" radius={PROCESS_RADIUS} color={PIPE_COLORS.treatedWater} />
    <Valve3D id="v-outflow" position={[34.0, PUMP_HEADER_Y, -15]} rotation={[0, 0, 0]} />
    <FlowMeter3D id="fm-outfall" position={[36.8, PUMP_HEADER_Y, -15]} rotation={[0, 0, 0]} />
    <Pipe3D
      points={[DRAIN_TO_OUTFALL_TAKEOFF, [40, PUMP_HEADER_Y, -15], OUTFALL_INLET]}
      radius={PROCESS_RADIUS}
      color={PIPE_COLORS.treatedWater}
      flowType="water"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
      showSupports
    />

    {/* ── 排放口水质采样管路：池内取样头 → 自动采样器侧口 ── */}
    <PipeOpenFlange3D position={OUTFALL_SAMPLE_PICKUP} axis="-y" radius={0.02} color={PIPE_COLORS.treatedWater} />
    <PipeOpenFlange3D position={WATER_QUALITY_SAMPLER_INLET} axis="-x" radius={0.02} color={PIPE_COLORS.treatedWater} />
    <Pipe3D
      points={[
        OUTFALL_SAMPLE_PICKUP,
        [40.3, 1.0, -15.5],
        [36.5, 1.0, -15.5],
        [36.5, 1.0, -11.9],
        [36.5, 0.85, -11.9],
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
    <PipeWallPort3D position={CLARIFIER_SLUDGE_SUCTION_A} rotation={southWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={CLAR_SLUDGE_SUCTION_A}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <PipeWallPort3D position={CLARIFIER_SLUDGE_SUCTION_B} rotation={southWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={CLAR_SLUDGE_SUCTION_B}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <Pipe3D
      points={getDischargeBranch(CLARIFIER_SLUDGE_PUMP_A, CLARIFIER_SLUDGE_ROTATION, PUMP_HEADER_Y, 4.61)}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={getDischargeBranch(CLARIFIER_SLUDGE_PUMP_B, CLARIFIER_SLUDGE_ROTATION, PUMP_HEADER_Y, 4.61)}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={[CLARIFIER_SLUDGE_HEADER_START, CLARIFIER_SLUDGE_HEADER_END]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="terminal"
      endConnection="terminal"
      sealedStart
      sealedEnd
    />
    <PipeBlindFlange3D position={CLARIFIER_SLUDGE_HEADER_START} axis="-x" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <PipeBlindFlange3D position={CLARIFIER_SLUDGE_HEADER_END} axis="+x" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={[
        CLARIFIER_SLUDGE_TAKEOFF,
        [3, SLUDGE_GALLERY_Y, 4.61],
        [3, SLUDGE_GALLERY_Y, 8.8],
        SLUDGE_RECEIVING_MANIFOLD,
      ]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="junction"
      junctionTrim="start"
      endJunctionRole="continuous"
      showSupports
    />

    <PipeWallPort3D position={DAF_SLUDGE_SUCTION_A} rotation={northWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={DAF_SLUDGE_SUCTION_PTS_A}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <PipeWallPort3D position={DAF_SLUDGE_SUCTION_B} rotation={northWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={DAF_SLUDGE_SUCTION_PTS_B}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <Pipe3D
      points={getDischargeBranch(DAF_SLUDGE_PUMP_A, DAF_SLUDGE_ROTATION, PUMP_HEADER_Y, -20.16)}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={getDischargeBranch(DAF_SLUDGE_PUMP_B, DAF_SLUDGE_ROTATION, PUMP_HEADER_Y, -20.16)}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={[DAF_SLUDGE_HEADER_START, DAF_SLUDGE_HEADER_END]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="terminal"
      endConnection="terminal"
      sealedStart
      sealedEnd
    />
    <PipeBlindFlange3D position={DAF_SLUDGE_HEADER_START} axis="-x" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <PipeBlindFlange3D position={DAF_SLUDGE_HEADER_END} axis="+x" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={[
        DAF_SLUDGE_TAKEOFF,
        [9.2, SLUDGE_GALLERY_Y, -20.16],
        [SLUDGE_EAST_CORRIDOR_X, SLUDGE_GALLERY_Y, -20.16],
        [SLUDGE_EAST_CORRIDOR_X, SLUDGE_GALLERY_Y, 8.8],
        SLUDGE_RECEIVING_MANIFOLD,
      ]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="junction"
      junctionTrim="start"
      endJunctionRole="continuous"
      showSupports
    />
    <PipeWallPort3D position={SLUDGE_TANK_INLET} rotation={northWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={[SLUDGE_RECEIVING_MANIFOLD, [5, SLUDGE_GALLERY_Y, 10.4], SLUDGE_TANK_INLET]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
    />

    <PipeWallPort3D position={SLUDGE_TANK_SUCTION_A} rotation={eastWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={SLUDGE_OUT_SUCTION_A}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <PipeWallPort3D position={SLUDGE_TANK_SUCTION_B} rotation={eastWall} radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={SLUDGE_OUT_SUCTION_B}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="equipment"
    />
    <Pipe3D
      points={getDischargeBranch(SLUDGE_OUT_PUMP_A, SLUDGE_OUT_ROTATION, PUMP_HEADER_Y, 13)}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={getDischargeBranch(SLUDGE_OUT_PUMP_B, SLUDGE_OUT_ROTATION, PUMP_HEADER_Y, 17)}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="equipment"
      endConnection="junction"
      junctionTrim="end"
    />
    <Pipe3D
      points={[SLUDGE_OUT_HEADER_START, SLUDGE_OUT_HEADER_END]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="terminal"
      endConnection="terminal"
      sealedStart
      sealedEnd
    />
    <PipeBlindFlange3D position={SLUDGE_OUT_HEADER_START} axis="-z" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <PipeBlindFlange3D position={SLUDGE_OUT_HEADER_END} axis="+z" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <PipeOpenFlange3D position={SCREW_PRESS_FEED} axis="-y" radius={SLUDGE_RADIUS} color={PIPE_COLORS.sludge} />
    <Pipe3D
      points={[SLUDGE_TO_PRESS_TAKEOFF, [17.15, PUMP_HEADER_Y, 15], SCREW_PRESS_FEED]}
      radius={SLUDGE_RADIUS}
      color={PIPE_COLORS.sludge}
      flowType="sludge"
      animated={true}
      startConnection="junction"
      endConnection="equipment"
      junctionTrim="start"
      showSupports
    />
  </group>
);
