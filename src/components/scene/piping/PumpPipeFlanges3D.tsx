import React from 'react';
import { PipeOpenFlange3D } from './PipeOpenFlange3D';
import {
  getDischargeDirection,
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

/**
 * Pipe-side flange sits only 6 mm outside the authored sealing face. Its
 * pump-facing gasket is inset farther than that, producing a tiny compression
 * overlap instead of either a visible air gap or z-fighting.
 */
const PIPE_FLANGE_OUTSET = 0.006;

function nearestHorizontalAxis(direction: [number, number, number]): PipeAxis {
  if (Math.abs(direction[0]) >= Math.abs(direction[2])) {
    return direction[0] >= 0 ? '+x' : '-x';
  }
  return direction[2] >= 0 ? '+z' : '-z';
}

function offsetAlong(
  point: [number, number, number],
  direction: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    point[0] + direction[0] * amount,
    point[1] + direction[1] * amount,
    point[2] + direction[2] * amount,
  ];
}

/** Pipe-side mating flanges placed just outside the Pump3D gasket faces. */
export const PumpPipeFlanges3D: React.FC<PumpPipeFlanges3DProps> = ({
  position,
  rotationY,
  suctionRadius,
  dischargeRadius,
  color,
}) => {
  const suctionDir = getSuctionDirection(rotationY);
  const dischargeDir = getDischargeDirection(rotationY);
  const suctionFace = getSuctionFacePoint(position, rotationY);
  const dischargeFace = getDischargeFacePoint(position, rotationY);

  return (
    <group userData={{ bakeExclude: true }}>
      <PipeOpenFlange3D
        position={offsetAlong(suctionFace, suctionDir, PIPE_FLANGE_OUTSET)}
        axis={nearestHorizontalAxis(suctionDir)}
        radius={suctionRadius}
        color={color}
      />
      <PipeOpenFlange3D
        position={offsetAlong(dischargeFace, dischargeDir, PIPE_FLANGE_OUTSET)}
        axis="+y"
        radius={dischargeRadius}
        color={color}
      />
    </group>
  );
};
