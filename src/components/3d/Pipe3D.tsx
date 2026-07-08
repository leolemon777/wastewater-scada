import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PIPE_COLORS } from './pipeRouting';

interface PipeLogisticsProps {
  points: [number, number, number][];
  radius?: number;
  color?: string;
  animated?: boolean;
  flowType?: 'water' | 'sludge' | 'chemical' | 'none';
  speedMultiplier?: number;
  /** Use `equipment` for wall/pump/tank insertion and `junction` where an endpoint lands on another pipe centreline. */
  startConnection?: 'equipment' | 'junction' | 'terminal';
  endConnection?: 'equipment' | 'junction' | 'terminal';
  /** Seal pipe end with a cap (use only on true network terminals). Default: open. */
  sealedStart?: boolean;
  sealedEnd?: boolean;
  /** Trim branch pipe ends back to the header surface at tee junctions. Use only for branch-to-header joins. */
  junctionTrim?: 'none' | 'start' | 'end' | 'both';
  /** Static audit marker for untrimmed junction endpoints that are section handoffs or continuous route joins. */
  startJunctionRole?: 'handoff' | 'continuous';
  endJunctionRole?: 'handoff' | 'continuous';
  /** Show support brackets on long runs. Default: false */
  showSupports?: boolean;
}

const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const PIPE_WATER = PIPE_COLORS.processWater;
const PIPE_METAL = '#C4CED6';
const FLANGE_METAL = '#B4C0C8';
const SLUDGE_PIPE_METAL = PIPE_COLORS.sludge;
const CHEMICAL_PIPE_METAL = PIPE_COLORS.pac;
const EQUIPMENT_CONNECTION_OVERLAP = 1.35;
const EQUIPMENT_CONNECTION_MAX_OVERLAP = 0.12;
const JUNCTION_CONNECTION_OVERLAP = 0;
const JUNCTION_SURFACE_TRIM = 0.92;
const SEALED_CONNECTION_OVERLAP = 0;
const BEND_RADIUS_MULTIPLIER = 2.6;
const JUNCTION_WELD_RADIUS = 0.985;
const JUNCTION_WELD_THICKNESS = 0.012;

/* ── Fitting constants ── */
const SUPPORT_SPACING = 6;        // world units between supports
const MIN_PIPE_LEN_FOR_SUPPORTS = 3;

function eulerFromDirection(direction: THREE.Vector3): [number, number, number] {
  const q = new THREE.Quaternion().setFromUnitVectors(yAxis, direction.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

function eulerFromZDirection(direction: THREE.Vector3): [number, number, number] {
  const q = new THREE.Quaternion().setFromUnitVectors(zAxis, direction.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

function sanitizePoints(points: [number, number, number][]): THREE.Vector3[] {
  const vectors: THREE.Vector3[] = [];
  for (const [x, y, z] of points) {
    const next = new THREE.Vector3(x, y, z);
    const prev = vectors[vectors.length - 1];
    if (!prev || prev.distanceToSquared(next) > 0.000001) {
      vectors.push(next);
    }
  }
  return vectors;
}

function simplifyCollinearPoints(points: THREE.Vector3[]): THREE.Vector3[] {
  if (points.length < 3) return points;

  const simplified: THREE.Vector3[] = [points[0].clone()];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const into = new THREE.Vector3().subVectors(cur, prev);
    const out = new THREE.Vector3().subVectors(next, cur);
    const intoLen = into.length();
    const outLen = out.length();

    if (intoLen < 0.000001 || outLen < 0.000001) continue;

    into.divideScalar(intoLen);
    out.divideScalar(outLen);
    if (into.dot(out) > 0.9995) continue;

    simplified.push(cur.clone());
  }
  simplified.push(points[points.length - 1].clone());
  return simplified;
}

function pipeShellColor(flowType: PipeLogisticsProps['flowType']) {
  if (flowType === 'sludge') return SLUDGE_PIPE_METAL;
  if (flowType === 'chemical') return CHEMICAL_PIPE_METAL;
  if (flowType === 'water') return PIPE_WATER;
  return PIPE_METAL;
}

function buildRoundedPath(
  points: THREE.Vector3[],
  radius: number,
): THREE.CurvePath<THREE.Vector3> | null {
  if (points.length < 2) return null;
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = points[0].clone();

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const prevLen = cur.distanceTo(prev);
    const nextLen = cur.distanceTo(next);
    const inDir = new THREE.Vector3().subVectors(prev, cur).normalize();
    const outDir = new THREE.Vector3().subVectors(next, cur).normalize();
    const bendAngle = Math.acos(Math.max(-1, Math.min(1, inDir.dot(outDir))));

    if (bendAngle < 0.12 || prevLen < radius * 2 || nextLen < radius * 2) {
      if (cursor.distanceToSquared(cur) > 0.000001) {
        path.add(new THREE.LineCurve3(cursor, cur.clone()));
      }
      cursor = cur.clone();
      continue;
    }

    const trim = Math.min(radius * BEND_RADIUS_MULTIPLIER, prevLen * 0.38, nextLen * 0.38);
    const bendStart = cur.clone().addScaledVector(inDir, trim);
    const bendEnd = cur.clone().addScaledVector(outDir, trim);

    if (cursor.distanceToSquared(bendStart) > 0.000001) {
      path.add(new THREE.LineCurve3(cursor, bendStart));
    }
    path.add(new THREE.QuadraticBezierCurve3(bendStart, cur.clone(), bendEnd));
    cursor = bendEnd;
  }

  const last = points[points.length - 1].clone();
  if (cursor.distanceToSquared(last) > 0.000001) {
    path.add(new THREE.LineCurve3(cursor, last));
  }
  return path;
}

function extendEndpoint(
  point: THREE.Vector3,
  neighbor: THREE.Vector3,
  radius: number,
  sealed: boolean,
  isStart: boolean,
  connection: NonNullable<PipeLogisticsProps['startConnection']>,
  trimJunction: boolean,
): THREE.Vector3 {
  if (!sealed && connection === 'terminal') {
    return point.clone();
  }
  const direction = isStart
    ? new THREE.Vector3().subVectors(neighbor, point).normalize()
    : new THREE.Vector3().subVectors(point, neighbor).normalize();

  if (!sealed && connection === 'junction' && trimJunction) {
    const trim = radius * JUNCTION_SURFACE_TRIM;
    return point.clone().addScaledVector(direction, isStart ? trim : -trim);
  }

  const overlapMultiplier = sealed
    ? SEALED_CONNECTION_OVERLAP
    : connection === 'equipment'
      ? EQUIPMENT_CONNECTION_OVERLAP
      : JUNCTION_CONNECTION_OVERLAP;
  const rawOverlap = Math.max(
    radius * overlapMultiplier,
    sealed || connection === 'junction' ? 0 : 0.04,
  );
  const overlap = connection === 'equipment' && !sealed
    ? Math.min(rawOverlap, EQUIPMENT_CONNECTION_MAX_OVERLAP)
    : rawOverlap;
  return point.clone().addScaledVector(direction, isStart ? -overlap : overlap);
}

function extendConnectionEnds(
  points: THREE.Vector3[],
  radius: number,
  sealedStart: boolean,
  sealedEnd: boolean,
  startConnection: NonNullable<PipeLogisticsProps['startConnection']>,
  endConnection: NonNullable<PipeLogisticsProps['endConnection']>,
  junctionTrim: NonNullable<PipeLogisticsProps['junctionTrim']>,
): THREE.Vector3[] {
  if (points.length < 2) return points;
  const extended = points.map((point) => point.clone());
  extended[0] = extendEndpoint(
    points[0],
    points[1],
    radius,
    sealedStart,
    true,
    startConnection,
    junctionTrim === 'start' || junctionTrim === 'both',
  );
  extended[extended.length - 1] = extendEndpoint(
    points[points.length - 1],
    points[points.length - 2],
    radius,
    sealedEnd,
    false,
    endConnection,
    junctionTrim === 'end' || junctionTrim === 'both',
  );
  return extended;
}

/* ── Pipe support bracket (U-clamp + legs) ── */
const PipeSupport: React.FC<{
  position: THREE.Vector3;
  direction: THREE.Vector3; // pipe direction at this point
  radius: number;
  groundY?: number;
}> = ({ position, direction, radius, groundY = 0 }) => {
  const rotation = eulerFromDirection(direction);
  const legH = Math.max(position.y - groundY - 0.02, 0.1);
  const clampR = radius * 1.08;
  const barW = radius * 0.045;
  return (
    <group position={position.toArray()} rotation={rotation}>
      {/* U-clamp (half torus) */}
      <mesh castShadow receiveShadow rotation={[0, 0, 0]}>
        <torusGeometry args={[clampR, barW, 6, 12, Math.PI]} />
        <meshStandardMaterial color={FLANGE_METAL} roughness={0.42} metalness={0.74} />
      </mesh>
      {/* Left leg */}
      <mesh castShadow receiveShadow position={[-clampR, -legH / 2, 0]}>
        <boxGeometry args={[barW * 2, legH, barW * 2]} />
        <meshStandardMaterial color={FLANGE_METAL} roughness={0.42} metalness={0.74} />
      </mesh>
      {/* Right leg */}
      <mesh castShadow receiveShadow position={[clampR, -legH / 2, 0]}>
        <boxGeometry args={[barW * 2, legH, barW * 2]} />
        <meshStandardMaterial color={FLANGE_METAL} roughness={0.42} metalness={0.74} />
      </mesh>
      {/* Base plate */}
      <mesh castShadow receiveShadow position={[0, -legH, 0]}>
        <boxGeometry args={[clampR * 2.1, barW * 1.4, barW * 2.6]} />
        <meshStandardMaterial color={FLANGE_METAL} roughness={0.38} metalness={0.78} />
      </mesh>
    </group>
  );
};

const PipeJunctionWeld: React.FC<{
  position: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
  color: string;
}> = ({ position, direction, radius, color }) => {
  const rotation = eulerFromZDirection(direction);
  return (
    <group position={position.toArray()} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <torusGeometry args={[radius * JUNCTION_WELD_RADIUS, radius * JUNCTION_WELD_THICKNESS, 6, 24]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
};

/* ── Calculate support positions along pipe path ── */
function computeSupportPositions(
  pipePath: THREE.CurvePath<THREE.Vector3>,
  pathLength: number,
  radius: number,
): { position: THREE.Vector3; direction: THREE.Vector3 }[] {
  if (pathLength < MIN_PIPE_LEN_FOR_SUPPORTS) return [];
  const supports: { position: THREE.Vector3; direction: THREE.Vector3 }[] = [];
  const spacing = Math.max(SUPPORT_SPACING, radius * 20);
  const count = Math.floor(pathLength / spacing);
  if (count < 1) return [];
  for (let i = 1; i <= count; i++) {
    const t = (i * spacing) / pathLength;
    if (t >= 0.95) continue; // don't place at very end
    const pt = pipePath.getPointAt(Math.min(t, 1));
    // Skip supports for submerged/underground pipes (Y < 0.5)
    if (pt.y < 0.5) continue;
    const tangent = pipePath.getTangentAt(Math.min(t, 1));
    supports.push({ position: pt, direction: tangent });
  }
  return supports;
}

export const Pipe3D: React.FC<PipeLogisticsProps> = ({
  points,
  radius = 0.1,
  color,
  animated = false,
  flowType = 'none',
  speedMultiplier,
  startConnection = 'terminal',
  endConnection = 'terminal',
  sealedStart = false,
  sealedEnd = false,
  junctionTrim = 'none',
  showSupports = false,
}) => {
  const jointPoints = useMemo(
    () => simplifyCollinearPoints(sanitizePoints(points)),
    [points],
  );

  const pipePoints = useMemo(
    () => extendConnectionEnds(jointPoints, radius, sealedStart, sealedEnd, startConnection, endConnection, junctionTrim),
    [jointPoints, radius, sealedStart, sealedEnd, startConnection, endConnection, junctionTrim],
  );

  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 0; i < pipePoints.length - 1; i++) {
      len += pipePoints[i].distanceTo(pipePoints[i + 1]);
    }
    return len;
  }, [pipePoints]);

  const radialSegments = 32;
  const tubeSegments = Math.max(8, Math.min(360, Math.ceil(pathLength * 10)));
  const pipePath = useMemo(() => buildRoundedPath(pipePoints, radius), [pipePoints, radius]);
  const pipeGeometry = useMemo(() => {
    if (!pipePath || pathLength < 0.008) return null;
    return new THREE.TubeGeometry(pipePath, tubeSegments, radius, radialSegments, false);
  }, [pathLength, pipePath, radialSegments, radius, tubeSegments]);

  // Compute support bracket positions
  const supportPositions = useMemo(() => {
    if (!showSupports || !pipePath || pathLength < MIN_PIPE_LEN_FOR_SUPPORTS) return [];
    return computeSupportPositions(pipePath, pathLength, radius);
  }, [showSupports, pipePath, pathLength, radius]);

  const outerColor = color ?? pipeShellColor(flowType);
  const usesDefaultMetal = !color && flowType === 'none';

  const pipeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: outerColor,
    roughness: usesDefaultMetal ? 0.44 : 0.6,
    metalness: usesDefaultMetal ? 0.62 : 0.03,
    clearcoat: usesDefaultMetal ? 0.18 : 0.12,
    clearcoatRoughness: usesDefaultMetal ? 0.28 : 0.38,
  }), [outerColor, usesDefaultMetal]);

  useEffect(() => () => { pipeMaterial.dispose(); }, [pipeMaterial]);
  useEffect(() => () => { pipeGeometry?.dispose(); }, [pipeGeometry]);

  const routeColor = color ?? pipeShellColor(flowType);
  let flowColor =
    routeColor === PIPE_COLORS.rawWater ||
    routeColor === PIPE_COLORS.deepWater ||
    routeColor === PIPE_COLORS.cleanWater ||
    routeColor === PIPE_WATER
      ? '#38BDF8'
      : routeColor === PIPE_COLORS.processWater
        ? '#5EEAD4'
        : routeColor === PIPE_COLORS.treatedWater
          ? '#34D399'
          : routeColor === PIPE_COLORS.sludge || routeColor === SLUDGE_PIPE_METAL
            ? '#D97706'
            : routeColor === PIPE_COLORS.pac || routeColor === CHEMICAL_PIPE_METAL
              ? '#8B5CF6'
              : routeColor === PIPE_COLORS.cacl2
                ? '#F59E0B'
                : routeColor === PIPE_COLORS.pam
                  ? '#EC4899'
                  : routeColor;

  const flowTexture = useMemo(() => {
    if (flowType === 'none' || !animated) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 256, 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let x = 0; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x + 6, 10);
      ctx.lineTo(x + 22, 16);
      ctx.lineTo(x + 6, 22);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(pathLength * 2.5, 2), 1);
    return tex;
  }, [animated, flowType, pathLength]);

  const flowMaterial = useMemo(() => {
    if (!flowTexture) return null;
    return new THREE.MeshStandardMaterial({
      color: flowColor,
      map: flowTexture,
      transparent: true,
      opacity: 0.28,
      emissive: flowColor,
      emissiveIntensity: 0.04,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }, [flowColor, flowTexture]);

  useEffect(() => () => { flowMaterial?.dispose(); }, [flowMaterial]);

  const texRef = useRef<THREE.Texture | null>(null);
  useEffect(() => {
    texRef.current = flowTexture;
    return () => { flowTexture?.dispose(); };
  }, [flowTexture]);

  useFrame((_, delta) => {
    if (animated && texRef.current) {
      const speed = flowType === 'sludge' ? 0.35 : flowType === 'chemical' ? 0.75 : 0.95;
      texRef.current.offset.x -= delta * speed * (speedMultiplier ?? 1.0);
    }
  });

  if (!pipeGeometry || jointPoints.length < 2 || pipePoints.length < 2) return null;

  const showStartJunctionWeld =
    startConnection === 'junction' &&
    (junctionTrim === 'start' || junctionTrim === 'both');
  const showEndJunctionWeld =
    endConnection === 'junction' &&
    (junctionTrim === 'end' || junctionTrim === 'both');
  const startJunctionDir = showStartJunctionWeld
    ? new THREE.Vector3().subVectors(pipePoints[1], pipePoints[0]).normalize()
    : null;
  const endJunctionDir = showEndJunctionWeld
    ? new THREE.Vector3().subVectors(pipePoints[pipePoints.length - 1], pipePoints[pipePoints.length - 2]).normalize()
    : null;
  const weldColor = usesDefaultMetal ? FLANGE_METAL : outerColor;

  return (
    <group>
      <mesh geometry={pipeGeometry} material={pipeMaterial} castShadow receiveShadow />

      {flowMaterial && (
        <mesh geometry={pipeGeometry} material={flowMaterial} userData={{ bakeExclude: true }} />
      )}

      {showStartJunctionWeld && startJunctionDir && (
        <PipeJunctionWeld
          position={pipePoints[0]}
          direction={startJunctionDir}
          radius={radius}
          color={weldColor}
        />
      )}
      {showEndJunctionWeld && endJunctionDir && (
        <PipeJunctionWeld
          position={pipePoints[pipePoints.length - 1]}
          direction={endJunctionDir}
          radius={radius}
          color={weldColor}
        />
      )}

      {/* ── Pipe supports along long runs ── */}
      {supportPositions.map((sup, i) => (
        <PipeSupport
          key={`support-${i}`}
          position={sup.position}
          direction={sup.direction}
          radius={radius}
        />
      ))}
    </group>
  );
};
