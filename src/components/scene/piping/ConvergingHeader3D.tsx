import React from 'react';
import { Pipe3D } from './Pipe3D';
import { PipeBlindFlange3D } from './PipeBlindFlange3D';

type Point = [number, number, number];
type PipeAxis = '+x' | '-x' | '+z' | '-z' | '+y' | '-y';

interface ConvergingHeader3DProps {
  start: Point;
  takeoff: Point;
  end: Point;
  radius: number;
  color: string;
  flowType: 'water' | 'sludge';
  /**
   * Optional bolted grey blind past an outer tee. Default off — dual-pump
   * headers use a short same-color runout past the outer riser and a flush
   * pipe-colored plug (not a grey floating blind stub).
   */
  blindStart?: boolean;
  blindEnd?: boolean;
  /**
   * When true (default), start/end are dead-end runouts past outer riser tees
   * and get same-color plugs. Set false for headers whose start/end are live
   * incoming branch tees (e.g. sludge gallery receiving header).
   * Prefer capStart/capEnd when only one side is a dead end (e.g. intake header
   * west continues into the PH1 export).
   */
  capEnds?: boolean;
  /** Override start plug; defaults to capEnds. */
  capStart?: boolean;
  /** Override end plug; defaults to capEnds. */
  capEnd?: boolean;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function outwardAxis(point: Point, takeoff: Point): PipeAxis {
  const delta = [point[0] - takeoff[0], point[1] - takeoff[1], point[2] - takeoff[2]] as Point;
  const absolute = delta.map(Math.abs);
  const dominant = absolute.indexOf(Math.max(...absolute));
  if (dominant === 0) return delta[0] >= 0 ? '+x' : '-x';
  if (dominant === 1) return delta[1] >= 0 ? '+y' : '-y';
  return delta[2] >= 0 ? '+z' : '-z';
}

const axisRotation: Record<PipeAxis, [number, number, number]> = {
  '+x': [0, 0, -Math.PI / 2],
  '-x': [0, 0, Math.PI / 2],
  '+z': [Math.PI / 2, 0, 0],
  '-z': [-Math.PI / 2, 0, 0],
  '+y': [0, 0, 0],
  '-y': [Math.PI, 0, 0],
};

/** Same-color flush plug — closes the open TubeGeometry end without a grey blind. */
function HeaderRunoutPlug({
  position,
  axis,
  radius,
  color,
}: {
  position: Point;
  axis: PipeAxis;
  radius: number;
  color: string;
}) {
  const thickness = Math.max(radius * 0.12, 0.012);
  return (
    <group position={position} rotation={axisRotation[axis]} userData={{ bakeExclude: true }}>
      <mesh position={[0, -thickness / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.01, radius * 1.01, thickness, 28]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.08} />
      </mesh>
    </group>
  );
}

/**
 * Dual-pump / converging header — first principles:
 *
 * 1. One continuous shell from start → end. Branches tee into that shell;
 *    never put an end-cap on a live tee.
 * 2. Dual-pump discharge: start/end sit a short runout past the outer riser
 *    so the tee is enclosed; ends get pipe-colored plugs (capEnds=true).
 * 3. Receiving headers (gallery): start/end ARE the incoming branch tees —
 *    leave them open/continuous (capEnds=false), no plugs.
 * 4. Grey blind flanges are opt-in only for intentional capped stubs.
 */
export const ConvergingHeader3D: React.FC<ConvergingHeader3DProps> = ({
  start,
  takeoff,
  end,
  radius,
  color,
  flowType,
  blindStart = false,
  blindEnd = false,
  capEnds = true,
  capStart,
  capEnd,
}) => {
  const hasSpan = distance(start, end) > 1e-5;
  const startAxis = outwardAxis(start, takeoff);
  const endAxis = outwardAxis(end, takeoff);
  const plugStart = capStart ?? capEnds;
  const plugEnd = capEnd ?? capEnds;
  const sealStart = plugStart || blindStart;
  const sealEnd = plugEnd || blindEnd;

  return (
    <group userData={{ bakeExclude: true }}>
      <Pipe3D
        points={[start, end]}
        radius={radius}
        color={color}
        flowType={flowType}
        animated={false}
        startConnection={sealStart ? 'terminal' : 'junction'}
        endConnection={sealEnd ? 'terminal' : 'junction'}
        sealedStart={sealStart}
        sealedEnd={sealEnd}
        startJunctionRole={sealStart ? undefined : 'continuous'}
        endJunctionRole={sealEnd ? undefined : 'continuous'}
      />
      {blindStart && hasSpan ? (
        <PipeBlindFlange3D position={start} axis={startAxis} radius={radius} color={color} />
      ) : (
        plugStart && hasSpan && <HeaderRunoutPlug position={start} axis={startAxis} radius={radius} color={color} />
      )}
      {blindEnd && hasSpan ? (
        <PipeBlindFlange3D position={end} axis={endAxis} radius={radius} color={color} />
      ) : (
        plugEnd && hasSpan && <HeaderRunoutPlug position={end} axis={endAxis} radius={radius} color={color} />
      )}
    </group>
  );
};
