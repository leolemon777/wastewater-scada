import React from 'react';
import { PipeOpenFlange3D } from './PipeOpenFlange3D';
import {
  getDischargeFacePoint,
  getSuctionDirection,
  getSuctionFacePoint,
} from './pumpPorts';

type PipeAxis = '+x' | '-x' | '+z' | '-z' | '+y' | '-y';

interface PumpPipeFlanges3DProps {
  position: [number, number, number];
  rotationY: number;
  suctionRadius: number;
  dischargeRadius: number;
  color: string;
}

function nearestHorizontalAxis(direction: [number, number, number]): PipeAxis {
  if (Math.abs(direction[0]) >= Math.abs(direction[2])) {
    return direction[0] >= 0 ? '+x' : '-x';
  }
  return direction[2] >= 0 ? '+z' : '-z';
}

/** Pipe-side mating flanges placed on the exact Pump3D gasket faces. */
export const PumpPipeFlanges3D: React.FC<PumpPipeFlanges3DProps> = ({
  position,
  rotationY,
  suctionRadius,
  dischargeRadius,
  color,
}) => (
  <group userData={{ bakeExclude: true }}>
    <PipeOpenFlange3D
      position={getSuctionFacePoint(position, rotationY)}
      axis={nearestHorizontalAxis(getSuctionDirection(rotationY))}
      radius={suctionRadius}
      color={color}
    />
    <PipeOpenFlange3D
      position={getDischargeFacePoint(position, rotationY)}
      axis="+y"
      radius={dischargeRadius}
      color={color}
    />
  </group>
);
