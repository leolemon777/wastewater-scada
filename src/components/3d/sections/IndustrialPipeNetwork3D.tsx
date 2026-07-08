import React from 'react';
import { Pipe3D } from '../Pipe3D';
import { PipeWallPort3D } from '../PipeWallPort3D';
import { PIPE_COLORS } from '../pipeRouting';

type V3 = [number, number, number];

const RAW_WATER_R = 0.09;
const SUCTION_R = 0.065;

const PH1_INLET: V3 = [-40, 1.12, -3.05];
const LIFT_HEADER_START: V3 = [-43.4, 1.9, 9.0];
const LIFT_HEADER_END: V3 = [-30.6, 1.9, 9.0];

const liftPumpBranches: Array<{
  id: string;
  pumpX: number;
  source: 'collection-1' | 'collection-2' | 'gas';
}> = [
  { id: 'p-lift-1', pumpX: -43, source: 'collection-1' },
  { id: 'p-lift-2', pumpX: -41, source: 'collection-1' },
  { id: 'p-lift-3', pumpX: -37, source: 'collection-2' },
  { id: 'p-lift-4', pumpX: -35, source: 'collection-2' },
  { id: 'p-gas-lift-1', pumpX: -33, source: 'gas' },
  { id: 'p-gas-lift-2', pumpX: -31, source: 'gas' },
];

function suctionSourcePoint(source: 'collection-1' | 'collection-2' | 'gas', pumpX: number): V3 {
  if (source === 'collection-1') return [-44, 0.82, 12.2];
  if (source === 'collection-2') return [-38, 0.82, 12.2];
  return [pumpX, 0.82, 13.8];
}

export const IndustrialPipeNetwork3D: React.FC = () => (
  <group>
    <PipeWallPort3D
      position={[-44, 0.82, 12.2]}
      rotation={[-Math.PI / 2, 0, 0]}
      radius={SUCTION_R}
      color={PIPE_COLORS.rawWater}
    />
    <PipeWallPort3D
      position={[-38, 0.82, 12.2]}
      rotation={[-Math.PI / 2, 0, 0]}
      radius={SUCTION_R}
      color={PIPE_COLORS.rawWater}
    />

    {liftPumpBranches.map((branch) => {
      const pumpSuction: V3 = [branch.pumpX, 0.78, 9.46];
      const sourcePoint = suctionSourcePoint(branch.source, branch.pumpX);
      return (
        <React.Fragment key={`${branch.id}-suction`}>
          <PipeWallPort3D
            position={pumpSuction}
            rotation={[Math.PI / 2, 0, 0]}
            radius={SUCTION_R}
            color={PIPE_COLORS.rawWater}
          />
          <Pipe3D
            points={[
              sourcePoint,
              [sourcePoint[0], 0.82, 10.35],
              [branch.pumpX, 0.82, 10.35],
              pumpSuction,
            ]}
            radius={SUCTION_R}
            color={PIPE_COLORS.rawWater}
            flowType="water"
            animated={true}
            startConnection="equipment"
            endConnection="equipment"
          />
        </React.Fragment>
      );
    })}

    {liftPumpBranches.map((branch) => (
      <Pipe3D
        key={`${branch.id}-discharge`}
        points={[
          [branch.pumpX, 1.68, 10.22],
          [branch.pumpX, 1.9, 9.0],
        ]}
        radius={SUCTION_R}
        color={PIPE_COLORS.rawWater}
        flowType="water"
        animated={true}
        startConnection="equipment"
        endConnection="junction"
        junctionTrim="end"
      />
    ))}

    <Pipe3D
      points={[LIFT_HEADER_START, LIFT_HEADER_END]}
      radius={RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
      flowType="water"
      animated={true}
      showSupports
      startConnection="junction"
      endConnection="junction"
      startJunctionRole="continuous"
      endJunctionRole="continuous"
    />

    <PipeWallPort3D
      position={PH1_INLET}
      rotation={[-Math.PI / 2, 0, 0]}
      radius={RAW_WATER_R}
      color={PIPE_COLORS.rawWater}
    />
    <Pipe3D
      points={[
        [-40, 1.9, 9.0],
        [-40, 1.9, 4.6],
        [-40, 1.12, 4.6],
        PH1_INLET,
      ]}
      radius={RAW_WATER_R}
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
