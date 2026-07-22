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
  blindStart?: boolean;
  blindEnd?: boolean;
  showSupports?: boolean;
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

/**
 * A pump header whose two animated halves both flow toward the real takeoff.
 * Splitting at the takeoff prevents arrows from crossing the outlet and
 * continuing into a capped dead leg.
 */
export const ConvergingHeader3D: React.FC<ConvergingHeader3DProps> = ({
  start,
  takeoff,
  end,
  radius,
  color,
  flowType,
  blindStart = true,
  blindEnd = true,
  showSupports = false,
}) => {
  const hasStartLeg = distance(start, takeoff) > 1e-5;
  const hasEndLeg = distance(end, takeoff) > 1e-5;

  return (
    <group>
      {/* One uninterrupted structural shell: pump risers connect to the same
          physical header mesh. The two directional legs below render only the
          animated flow overlay, so their split cannot create a visible seam. */}
      <Pipe3D
        points={[start, end]}
        radius={radius}
        color={color}
        flowType={flowType}
        animated={false}
        showSupports={showSupports}
        startConnection={blindStart ? 'terminal' : 'junction'}
        endConnection={blindEnd ? 'terminal' : 'junction'}
        sealedStart={blindStart}
        sealedEnd={blindEnd}
        startJunctionRole={blindStart ? undefined : 'continuous'}
        endJunctionRole={blindEnd ? undefined : 'continuous'}
      />
      {hasStartLeg && (
        <Pipe3D
          points={[start, takeoff]}
          radius={radius}
          color={color}
          flowType={flowType}
          animated
          renderShell={false}
          startConnection={blindStart ? 'terminal' : 'junction'}
          endConnection="junction"
          sealedStart={blindStart}
          endJunctionRole="continuous"
        />
      )}
      {hasEndLeg && (
        <Pipe3D
          points={[end, takeoff]}
          radius={radius}
          color={color}
          flowType={flowType}
          animated
          renderShell={false}
          startConnection={blindEnd ? 'terminal' : 'junction'}
          endConnection="junction"
          sealedStart={blindEnd}
          endJunctionRole="continuous"
        />
      )}
      {blindStart && hasStartLeg && (
        <PipeBlindFlange3D
          position={start}
          axis={outwardAxis(start, takeoff)}
          radius={radius}
          color={color}
        />
      )}
      {blindEnd && hasEndLeg && (
        <PipeBlindFlange3D
          position={end}
          axis={outwardAxis(end, takeoff)}
          radius={radius}
          color={color}
        />
      )}
    </group>
  );
};
