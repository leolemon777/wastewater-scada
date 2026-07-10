import React from 'react';
import { Pipe3D } from '../Pipe3D';
import { PipeWallPort3D } from '../PipeWallPort3D';
import { PipeBlindFlange3D } from '../PipeBlindFlange3D';
import { PipeOpenFlange3D } from '../PipeOpenFlange3D';
import { PIPE_COLORS } from '../pipeRouting';
import { getDischargeRiser } from '../pumpPorts';
import { LIFT_ROT } from './intakeLayout';
import {
  INTAKE_DISCHARGE_R,
  INTAKE_HEADER_Y,
  INTAKE_RAW_WATER_R,
  INTAKE_SUCTION_R,
  buildIntakeLiftPipeNetwork,
} from './intakePipeRoutes';

const network = buildIntakeLiftPipeNetwork();

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
          // Face south (−Z) toward the pump row.
          rotation={[Math.PI / 2, 0, 0]}
          radius={INTAKE_SUCTION_R}
          color={PIPE_COLORS.rawWater}
        />
        {/* Pipe-side flange just outside the pump suction mouth (flange-to-flange). */}
        <PipeOpenFlange3D
          position={branch.suctionJoint}
          axis="+z"
          radius={INTAKE_SUCTION_R}
          color={PIPE_COLORS.rawWater}
        />
        <Pipe3D
          // wall → mouth only (collinear joint vertex is stripped in Pipe3D)
          points={[branch.wallPoint, branch.suctionMouth]}
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
      />
    ))}

    {/* ── Shared discharge header; west end continues into the PH1 export ── */}
    <Pipe3D
      points={[network.headerStart, network.headerEnd]}
      radius={INTAKE_RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
      flowType="water"
      animated={true}
      showSupports
      startConnection="junction"
      endConnection="terminal"
      sealedEnd
      startJunctionRole="continuous"
    />
    {/* Only the true east terminal is blind; the west endpoint is continuous. */}
    <PipeBlindFlange3D
      position={[network.headerEnd[0] + 0.02, network.headerEnd[1], network.headerEnd[2]]}
      axis="+x"
      radius={INTAKE_RAW_WATER_R * 1.15}
      color={PIPE_COLORS.rawWater}
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
