/**
 * Process / sludge pump pipe geometry — single source of truth.
 *
 * Every suction endpoint lands on getSuctionFacePoint; every discharge
 * endpoint lands on getDischargeFacePoint. Headers sit on the discharge
 * centreline so risers are pure vertical (no mid-air dogleg at the flange).
 */
import {
  getDirectTankSuctionBranch,
  getDischargeFacePoint,
  getDischargeRiser,
  getSuctionFacePoint,
  pt,
} from '../piping/pumpPorts';
import { PROCESS_PUMP_LAYOUT, type Point3, type ProcessPumpPlacement } from './processPumpLayout';
import {
  getAxialTankWallPort,
  type RoutedTankId,
  type TankWall,
} from './tankLayout';

export const PUMP_HEADER_Y = 2.55;
export const PUMP_SUCTION_RADIUS = 0.085;
export const PUMP_DISCHARGE_RADIUS = 0.082;
/**
 * Short runout past the outer riser centreline so the tee is fully enclosed.
 * Keep ≈ header/branch radius (not 0 — that leaves an open white circle at the
 * tee and reads as a broken joint). Ends are pipe-colored plugs, not grey blinds.
 */
export const PUMP_HEADER_END_CLEARANCE = 0.13;

export type ProcessPumpRoute = {
  id: string;
  position: Point3;
  rotationY: number;
  suctionMouth: Point3;
  dischargeFace: Point3;
  /** wall insertion → mouth (axial or single orthogonal spool) */
  suctionPoints: Point3[];
  /** wall-port position = suction polyline start */
  wallPoint: Point3;
  /** face → header height, pure vertical when header shares face X/Z */
  dischargePoints: Point3[];
};

function buildRoute(
  placement: ProcessPumpPlacement,
  sourceTankId: RoutedTankId,
  sourceWall: TankWall,
): ProcessPumpRoute {
  const { position, rotationY, id } = placement;
  const suctionMouth = getSuctionFacePoint(position, rotationY);
  const wallPoint = getAxialTankWallPort(sourceTankId, sourceWall, suctionMouth);
  const suctionPoints = getDirectTankSuctionBranch(position, rotationY, wallPoint);
  const dischargeFace = getDischargeFacePoint(position, rotationY);
  // Pure vertical riser — header is later placed on this face's X/Z.
  const dischargePoints = getDischargeRiser(position, rotationY, PUMP_HEADER_Y);

  return {
    id,
    position: [...position],
    rotationY,
    suctionMouth,
    dischargeFace,
    suctionPoints,
    // getDirectTankSuctionBranch starts inside the basin, then crosses the
    // actual wall sleeve before reaching the pump sealing face.
    wallPoint: suctionPoints.length >= 3 ? suctionPoints[1] : suctionPoints[0],
    dischargePoints,
  };
}

export const INTERMEDIATE_ROUTES = [
  buildRoute(PROCESS_PUMP_LAYOUT.intermediateA, 'tk-intermediate', 'north'),
  buildRoute(PROCESS_PUMP_LAYOUT.intermediateB, 'tk-intermediate', 'north'),
] as const;

export const DRAIN_ROUTES = [
  buildRoute(PROCESS_PUMP_LAYOUT.drainA, 'tk-drainage', 'east'),
  buildRoute(PROCESS_PUMP_LAYOUT.drainB, 'tk-drainage', 'east'),
] as const;

export const CLARIFIER_SLUDGE_ROUTES = [
  buildRoute(PROCESS_PUMP_LAYOUT.clarifierSludgeA, 'tk-clarifier', 'south'),
  buildRoute(PROCESS_PUMP_LAYOUT.clarifierSludgeB, 'tk-clarifier', 'south'),
] as const;

export const DAF_SLUDGE_ROUTES = [
  buildRoute(PROCESS_PUMP_LAYOUT.dafSludgeA, 'tk-daf', 'north'),
  buildRoute(PROCESS_PUMP_LAYOUT.dafSludgeB, 'tk-daf', 'north'),
] as const;

export const SLUDGE_OUT_ROUTES = [
  buildRoute(PROCESS_PUMP_LAYOUT.sludgeOutA, 'tk-sludge', 'east'),
  buildRoute(PROCESS_PUMP_LAYOUT.sludgeOutB, 'tk-sludge', 'east'),
] as const;

export const ALL_PROCESS_PUMP_ROUTES: readonly ProcessPumpRoute[] = [
  ...INTERMEDIATE_ROUTES,
  ...DRAIN_ROUTES,
  ...CLARIFIER_SLUDGE_ROUTES,
  ...DAF_SLUDGE_ROUTES,
  ...SLUDGE_OUT_ROUTES,
];

/** Shared header on discharge centreline; ends flush with the outer riser tees. */
export function buildHeaderOnDischargeFaces(
  routes: readonly ProcessPumpRoute[],
  axis: 'x' | 'z',
  endClearance = PUMP_HEADER_END_CLEARANCE,
): { start: Point3; end: Point3; takeoff: Point3; axisCoord: number } {
  if (routes.length === 0) {
    throw new Error('buildHeaderOnDischargeFaces requires at least one route');
  }
  const y = PUMP_HEADER_Y;
  if (axis === 'x') {
    // Header runs along X at the shared discharge face Z.
    const zs = routes.map((r) => r.dischargeFace[2]);
    const z = zs[0];
    for (const zi of zs) {
      if (Math.abs(zi - z) > 1e-3) {
        throw new Error(
          `buildHeaderOnDischargeFaces(x): discharge faces not coplanar on Z (${zs.join(', ')})`,
        );
      }
    }
    const xs = routes.map((r) => r.dischargeFace[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const start = pt(minX - endClearance, y, z);
    const end = pt(maxX + endClearance, y, z);
    const midX = (minX + maxX) / 2;
    return { start, end, takeoff: pt(midX, y, z), axisCoord: z };
  }
  // Header runs along Z at the shared discharge face X.
  const xs = routes.map((r) => r.dischargeFace[0]);
  const x = xs[0];
  for (const xi of xs) {
    if (Math.abs(xi - x) > 1e-3) {
      throw new Error(
        `buildHeaderOnDischargeFaces(z): discharge faces not coplanar on X (${xs.join(', ')})`,
      );
    }
  }
  const zs = routes.map((r) => r.dischargeFace[2]);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const start = pt(x, y, minZ - endClearance);
  const end = pt(x, y, maxZ + endClearance);
  const midZ = (minZ + maxZ) / 2;
  return { start, end, takeoff: pt(x, y, midZ), axisCoord: x };
}

export const INTERMEDIATE_HEADER = buildHeaderOnDischargeFaces(INTERMEDIATE_ROUTES, 'x');
export const DRAIN_HEADER = buildHeaderOnDischargeFaces(DRAIN_ROUTES, 'z');
export const CLARIFIER_SLUDGE_HEADER = buildHeaderOnDischargeFaces(CLARIFIER_SLUDGE_ROUTES, 'x');
export const DAF_SLUDGE_HEADER = buildHeaderOnDischargeFaces(DAF_SLUDGE_ROUTES, 'x');
export const SLUDGE_OUT_HEADER = buildHeaderOnDischargeFaces(SLUDGE_OUT_ROUTES, 'z');

export function dist3(a: Point3, b: Point3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Discharge polyline is pure vertical (constant X/Z). */
export function dischargeIsPureVertical(route: ProcessPumpRoute, tol = 0.02): boolean {
  const x0 = route.dischargePoints[0][0];
  const z0 = route.dischargePoints[0][2];
  return route.dischargePoints.every(
    (p) => Math.abs(p[0] - x0) <= tol && Math.abs(p[2] - z0) <= tol,
  );
}

/** Suction last point equals sealing face. */
export function suctionEndsOnFace(route: ProcessPumpRoute, tol = 0.05): boolean {
  return dist3(route.suctionPoints[route.suctionPoints.length - 1], route.suctionMouth) <= tol;
}

/** Discharge first point equals sealing face. */
export function dischargeStartsOnFace(route: ProcessPumpRoute, tol = 0.05): boolean {
  return dist3(route.dischargePoints[0], route.dischargeFace) <= tol;
}
