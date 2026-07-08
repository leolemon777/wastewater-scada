import React, { useMemo } from 'react';
import { Pipe3D } from './Pipe3D';
import { PipeOpenFlange3D } from './PipeOpenFlange3D';
import { PipeBlindFlange3D } from './PipeBlindFlange3D';
import { PipeWallPort3D } from './PipeWallPort3D';
import { expandRoute, validateAnchoredPipes, type PipeRoute, type EndFitting } from './pipeRoutes';
import { resolveAnchor } from './anchors';

/** Axis string understood by the fitting components (mirrors their local PipeAxis). */
type PipeAxis = '+x' | '-x' | '+z' | '-z' | '+y' | '-y';

/**
 * Anchor-driven pipe renderer — expands JSON routes into world-space polylines
 * and renders the tube with <Pipe3D> so equipment overlap, junction trim, and
 * quadratic-bezier elbows match the legacy section pipes (no more instanced
 * cylinders + protruding sphere elbows at fold points).
 */

let validationDone = false;
function ensureValidated() {
  if (validationDone) return;
  validationDone = true;
  Promise.resolve().then(() => validateAnchoredPipes());
}

function resolveFitting(requested: EndFitting | undefined, anchorId: string): EndFitting {
  if (requested && requested !== 'auto') return requested;
  if (anchorId.startsWith('intake-raw-inlet')) return 'open-flange';
  if (anchorId.includes('.inlet') || anchorId.includes('.outlet')) return 'wall-port';
  return 'open-flange';
}

const AXIS_VECTORS: Record<PipeAxis, [number, number, number]> = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};

function nearestAxis(dir: [number, number, number]): PipeAxis {
  let best: PipeAxis = '+x';
  let bestDot = -Infinity;
  for (const key of Object.keys(AXIS_VECTORS) as PipeAxis[]) {
    const v = AXIS_VECTORS[key];
    const dot = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
    if (dot > bestDot) { bestDot = dot; best = key; }
  }
  return best;
}

function fittingToConnection(
  fitting: EndFitting,
  anchorId: string,
): 'equipment' | 'junction' | 'terminal' {
  if (fitting === 'wall-port') return 'equipment';
  if (fitting === 'none') return 'junction';
  if (fitting === 'blind-flange' || fitting === 'open-flange') return 'terminal';
  if (anchorId.includes('.inlet') || anchorId.includes('.outlet')) return 'equipment';
  return 'terminal';
}

interface AnchoredPipeProps {
  route: PipeRoute;
  animated?: boolean;
  speedMultiplier?: number;
  showSupports?: boolean;
}

export const AnchoredPipe3D: React.FC<AnchoredPipeProps> = ({
  route,
  animated = false,
  speedMultiplier,
  showSupports = false,
}) => {
  React.useEffect(() => { ensureValidated(); }, []);

  const points = useMemo(() => expandRoute(route), [route]);
  const startAnchor = useMemo(() => resolveAnchor(route.start), [route.start]);
  const endAnchor = useMemo(() => resolveAnchor(route.end), [route.end]);

  const startFitting = resolveFitting(route.startFitting, route.start);
  const endFitting = resolveFitting(route.endFitting, route.end);

  const startConnection = fittingToConnection(startFitting, route.start);
  const endConnection = fittingToConnection(endFitting, route.end);

  const startAxisKey = nearestAxis(startAnchor.direction);
  const endAxisKey = nearestAxis(endAnchor.direction);
  const startFaceAxis: PipeAxis = invertAxis(startAxisKey);
  const endFaceAxis: PipeAxis = endAxisKey;

  const junctionTrim =
    startConnection === 'junction' && endConnection === 'junction'
      ? 'both'
      : startConnection === 'junction'
        ? 'start'
        : endConnection === 'junction'
          ? 'end'
          : 'none';

  return (
    <group>
      <Pipe3D
        points={points}
        radius={route.radius}
        color={route.color}
        animated={animated}
        flowType={route.flowType ?? 'none'}
        speedMultiplier={speedMultiplier}
        startConnection={startConnection}
        endConnection={endConnection}
        junctionTrim={junctionTrim}
        startJunctionRole={startConnection === 'junction' ? 'handoff' : undefined}
        endJunctionRole={endConnection === 'junction' ? 'handoff' : undefined}
        sealedStart={startFitting === 'blind-flange'}
        sealedEnd={endFitting === 'blind-flange'}
        showSupports={showSupports}
      />

      {startFitting === 'open-flange' && (
        <PipeOpenFlange3D
          position={startAnchor.position}
          axis={startFaceAxis}
          radius={route.radius}
          color={route.color}
        />
      )}
      {startFitting === 'blind-flange' && (
        <PipeBlindFlange3D
          position={startAnchor.position}
          axis={startFaceAxis}
          radius={route.radius}
          color={route.color}
        />
      )}
      {startFitting === 'wall-port' && (
        <PipeWallPort3D
          position={startAnchor.position}
          rotation={axisToRotation(startFaceAxis)}
          radius={route.radius}
          color={route.color}
        />
      )}
      {endFitting === 'open-flange' && (
        <PipeOpenFlange3D
          position={endAnchor.position}
          axis={endFaceAxis}
          radius={route.radius}
          color={route.color}
        />
      )}
      {endFitting === 'blind-flange' && (
        <PipeBlindFlange3D
          position={endAnchor.position}
          axis={endFaceAxis}
          radius={route.radius}
          color={route.color}
        />
      )}
      {endFitting === 'wall-port' && (
        <PipeWallPort3D
          position={endAnchor.position}
          rotation={axisToRotation(endFaceAxis)}
          radius={route.radius}
          color={route.color}
        />
      )}
    </group>
  );
};

function invertAxis(axis: PipeAxis): PipeAxis {
  return (axis.startsWith('+') ? axis.replace('+', '-') : axis.replace('-', '+')) as PipeAxis;
}

function axisToRotation(axis: PipeAxis): [number, number, number] {
  switch (axis) {
    case '+x': return [0, 0, -Math.PI / 2];
    case '-x': return [0, 0, Math.PI / 2];
    case '+y': return [0, 0, 0];
    case '-y': return [Math.PI, 0, 0];
    case '+z': return [Math.PI / 2, 0, 0];
    case '-z': return [-Math.PI / 2, 0, 0];
  }
}
