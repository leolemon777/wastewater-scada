import React from 'react';
import { Pipe3D } from '../piping/Pipe3D';
import { PipeWallPort3D } from '../piping/PipeWallPort3D';
import { ConvergingHeader3D } from '../piping/ConvergingHeader3D';
import { PipeElbowFitting3D } from '../piping/PipeElbowFitting3D';
import { PIPE_COLORS } from '../piping/pipeRouting';
import { getDischargeRiser, PUMP_FACE_SEAT } from '../piping/pumpPorts';
import { PumpPipeFlanges3D } from '../piping/PumpPipeFlanges3D';
import { LIFT_ROT } from './intakeLayout';
import {
  INTAKE_DISCHARGE_R,
  INTAKE_HEADER_Y,
  INTAKE_RAW_WATER_R,
  INTAKE_SUCTION_R,
  INTAKE_WALL_PENETRATION,
  buildIntakeLiftPipeNetwork,
} from './intakePipeRoutes';

const network = buildIntakeLiftPipeNetwork();

function intakePoolInner(wall: [number, number, number]): [number, number, number] {
  return [wall[0], wall[1], wall[2] + INTAKE_WALL_PENETRATION];
}

/**
 * Intake raw-water network only.
 * Each pump: 1 axial suction spool + 1 vertical discharge riser.
 * Header: both runout ends sealed; PH1 leaves from an aligned interior tee.
 *
 * Tee joins: risers land on the shared header with junctionMateRadius so the
 * branch is trimmed to the header shell (no through-stubs).
 */
export const IndustrialPipeNetwork3D: React.FC = () => (
  <group userData={{ bakeExclude: true }}>
    {/* ── 1 suction per pump: wall-port → straight spool → open flange → mouth ── */}
    {network.pumps.map((branch) => (
      <React.Fragment key={`${branch.id}-suction`}>
        <PumpPipeFlanges3D
          position={branch.position}
          rotationY={LIFT_ROT}
          suctionRadius={INTAKE_SUCTION_R}
          dischargeRadius={INTAKE_DISCHARGE_R}
          color={PIPE_COLORS.rawWater}
        />
        <PipeWallPort3D
          position={branch.wallPoint}
          // Local +Y → world −Z: face the pump row on the intake-facing wall.
          rotation={[-Math.PI / 2, 0, 0]}
          radius={INTAKE_SUCTION_R}
          color={PIPE_COLORS.rawWater}
        />
        <Pipe3D
          // Basin interior → wall sleeve → pump mouth, normal to the wall.
          points={[intakePoolInner(branch.wallPoint), branch.wallPoint, ...branch.suctionPoints.slice(1)]}
          radius={INTAKE_SUCTION_R}
          color={PIPE_COLORS.rawWater}
          flowType="water"
          animated={true}
          startConnection="equipment"
          endConnection="equipment"
          // Seat through the gasket by a controlled amount so no light gap
          // opens between the pipe shell and the pump-side flange.
          startOverlap={0}
          endOverlap={PUMP_FACE_SEAT}
        />
      </React.Fragment>
    ))}

    {/* ── 1 discharge per pump: flange face → pure vertical into header shell ── */}
    {network.pumps.map((branch) => (
      <Pipe3D
        key={`${branch.id}-discharge`}
        points={getDischargeRiser(branch.position, LIFT_ROT, INTAKE_HEADER_Y)}
        radius={INTAKE_DISCHARGE_R}
        color={PIPE_COLORS.rawWater}
        flowType="water"
        animated={true}
        startConnection="equipment"
        startOverlap={PUMP_FACE_SEAT}
        endConnection="junction"
        junctionTrim="end"
        // Trim by header radius, not the thinner riser radius.
        junctionMateRadius={INTAKE_RAW_WATER_R}
      />
    ))}

    {/* ── Shared discharge header; PH1 leaves from an aligned interior tee ── */}
    <ConvergingHeader3D
      start={network.headerStart}
      takeoff={network.ph1Takeoff}
      end={network.headerEnd}
      radius={INTAKE_RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
      flowType="water"
      capStart={true}
      capEnd={true}
    />

    {/* ── PH1 transfer: drop beside header, run buried, then rise at pool wall ── */}
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
      startConnection="junction"
      endConnection="equipment"
      startJunctionRole="handoff"
    />
    {network.ph1VisibleElbows.map((elbow, index) => (
      <PipeElbowFitting3D
        key={`ph1-transfer-elbow-${index}`}
        previous={elbow.previous}
        corner={elbow.corner}
        next={elbow.next}
        radius={INTAKE_RAW_WATER_R}
        color={PIPE_COLORS.rawWater}
      />
    ))}
  </group>
);
