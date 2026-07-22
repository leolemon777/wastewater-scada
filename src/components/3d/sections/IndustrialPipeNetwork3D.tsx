import React from 'react';
import { Pipe3D } from '../pipes/Pipe3D';
import { PipeWallPort3D } from '../pipes/PipeWallPort3D';
import { ConvergingHeader3D } from '../pipes/ConvergingHeader3D';
import { PIPE_COLORS } from '../pipes/pipeRouting';
import { getDischargeRiser } from '../pipes/pumpPorts';
import { LIFT_ROT } from './intakeLayout';
import {
  INTAKE_DISCHARGE_R,
  INTAKE_HEADER_Y,
  INTAKE_RAW_WATER_R,
  INTAKE_SUCTION_R,
  buildIntakeLiftPipeNetwork,
} from './intakePipeRoutes';

const network = buildIntakeLiftPipeNetwork();

/** All intake ports are on the north wall; enter the basin normal to that wall. */
const intakePoolInner = (wall: [number, number, number]): [number, number, number] =>
  [wall[0], wall[1], wall[2] + 0.45];

/**
 * Intake raw-water network only.
 * Each pump: 1 axial suction spool + 1 vertical discharge riser.
 * Header: sealed both ends. PH1: west takeoff only.
 */
export const IndustrialPipeNetwork3D: React.FC = () => (
  <group userData={{ bakeExclude: true }}>
    {/* ── 1 suction per pump: wall-port → straight spool → open flange → mouth ── */}
    {network.pumps.map((branch) => (
      <React.Fragment key={`${branch.id}-suction`}>
        <PipeWallPort3D
          position={branch.wallPoint}
          // Local +Y → world −Z: coloured stub faces the pump row and seats on the spool.
          rotation={[-Math.PI / 2, 0, 0]}
          radius={INTAKE_SUCTION_R}
          color={PIPE_COLORS.rawWater}
        />
        <Pipe3D
          // Basin → wall sleeve → pump mouth, fully collinear and normal to wall.
          points={[intakePoolInner(branch.wallPoint), branch.wallPoint, branch.suctionMouth]}
          radius={INTAKE_SUCTION_R}
          color={PIPE_COLORS.rawWater}
          flowType="water"
          animated={true}
          startConnection="equipment"
          endConnection="equipment"
        />
      </React.Fragment>
    ))}

    {/* ── 1 discharge per pump: flange face → pure vertical into header ── */}
    {network.pumps.map((branch) => (
      <Pipe3D
        key={`${branch.id}-discharge`}
        points={getDischargeRiser(branch.position, LIFT_ROT, INTAKE_HEADER_Y)}
        radius={INTAKE_DISCHARGE_R}
        color={PIPE_COLORS.rawWater}
        flowType="water"
        animated={true}
        startConnection="equipment"
        endConnection="junction"
        junctionTrim="end"
        // Header is thicker than the riser — trim to header outer wall, not branch OD.
        junctionHostRadius={INTAKE_RAW_WATER_R}
      />
    ))}

    {/* ── Shared discharge header; west end continues into the PH1 export ── */}
    <ConvergingHeader3D
      start={network.headerStart}
      takeoff={network.ph1Takeoff}
      end={network.headerEnd}
      radius={INTAKE_RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
      flowType="water"
      showSupports
      blindStart={false}
    />

    {/* ── PH1 transfer from west of bay (continuous; no mid-row orphan drop) ── */}
    <PipeWallPort3D
      position={network.ph1Inlet}
      rotation={[-Math.PI / 2, 0, 0]}
      radius={INTAKE_RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
    />
    <Pipe3D
      points={network.ph1TransferPoints}
      radius={INTAKE_RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
      flowType="water"
      animated={true}
      showSupports
      startConnection="junction"
      endConnection="equipment"
      startJunctionRole="handoff"
    />
  </group>
);
