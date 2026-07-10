/**
 * Intake lift → PH1 route builder (single topology source).
 *
 * Topology (first principles):
 *   collection wall ──axial spool──► pump suction mouth
 *   pump discharge face ──vertical riser──► shared header
 *   header west takeoff ──► PH1 inlet
 *
 * Visual rules:
 *   - Exactly one suction + one discharge polyline per pump
 *   - Suction last segment axial into mouth (no elevated mid-bay spaghetti)
 *   - Discharge pure vertical (no short horizontal tees)
 *   - Header ends are sealed terminals with blind flanges
 */
import {
  getDischargeRiser,
  getFlangeFacePoint,
  getPumpFlanges,
  getSuctionDirection,
  getSuctionFacePoint,
  getSuctionJointPoint,
  pt,
} from '../pumpPorts';
import {
  COLLECTION_SOUTH_WALL_Z,
  LIFT_PUMPS,
  LIFT_ROT,
  liftPumpWorldPosition,
  type LiftSuctionSource,
  type V3,
} from './intakeLayout';

export const INTAKE_RAW_WATER_R = 0.1;
/** ~ pump suction nozzle bore after scale 0.5 */
export const INTAKE_SUCTION_R = 0.09;
export const INTAKE_DISCHARGE_R = 0.085;
export const INTAKE_HEADER_Y = 2.15;
export const INTAKE_MIN_SUCTION_LEN = 0.55;
export const PH1_INLET: V3 = [-40, 1.12, -3.05];
export const INTAKE_FLANGE_TOLERANCE_M = 0.08;
/** External joint length outside suction mouth (hosts pipe-side open flange). */
export const INTAKE_SUCTION_JOINT_LEN = 0.18;

export type IntakePumpRoute = {
  id: string;
  source: LiftSuctionSource;
  position: V3;
  suctionMouth: V3;
  suctionJoint: V3;
  dischargeFace: V3;
  wallPoint: V3;
  /** wall → joint → mouth (collinear axial) */
  suctionPoints: V3[];
  /** face → riser top (pure vertical) */
  dischargePoints: V3[];
};

function suctionWallPoint(source: LiftSuctionSource, mouth: V3): V3 {
  if (source === 'collection-1' || source === 'collection-2') {
    // Same X as mouth, mouth height, collection south wall — pure axial Z run.
    return pt(mouth[0], mouth[1], COLLECTION_SOUTH_WALL_Z);
  }
  // Gas lifts: free axial stub north of mouth.
  return pt(mouth[0], mouth[1], mouth[2] + 0.7);
}

/**
 * Axial suction: wall → external joint → mouth.
 * All three points share mouth Y and mouth X so the path is a single straight
 * process spool (no elevated elbows that read as mid-air stubs).
 */
export function buildAxialSuctionPoints(
  position: V3,
  rotationY: number,
  wallPoint: V3,
  jointLen = INTAKE_SUCTION_JOINT_LEN,
): { mouth: V3; joint: V3; points: V3[] } {
  const mouth = getSuctionFacePoint(position, rotationY);
  const joint = getSuctionJointPoint(position, rotationY, jointLen);
  // Force wall onto the mouth centreline (X/Y) so the approach cannot side-hit.
  const wall = pt(mouth[0], mouth[1], wallPoint[2]);
  return { mouth, joint, points: [wall, joint, mouth] };
}

export function buildIntakeLiftPipeNetwork(): {
  pumps: IntakePumpRoute[];
  headerY: number;
  headerZ: number;
  headerStart: V3;
  headerEnd: V3;
  ph1Inlet: V3;
  ph1TransferPoints: V3[];
  ph1Takeoff: V3;
} {
  const pumps: IntakePumpRoute[] = LIFT_PUMPS.map((branch) => {
    const position = liftPumpWorldPosition(branch.localX);
    const flanges = getPumpFlanges(position, LIFT_ROT);
    const dischargeFace = getFlangeFacePoint(flanges.discharge, LIFT_ROT);
    const wallSeed = suctionWallPoint(branch.source, getSuctionFacePoint(position, LIFT_ROT));
    const { mouth, joint, points: suctionPoints } = buildAxialSuctionPoints(
      position,
      LIFT_ROT,
      wallSeed,
    );
    const dischargePoints = getDischargeRiser(position, LIFT_ROT, INTAKE_HEADER_Y);

    return {
      id: branch.id,
      source: branch.source,
      position,
      suctionMouth: mouth,
      suctionJoint: joint,
      dischargeFace,
      wallPoint: suctionPoints[0],
      suctionPoints,
      dischargePoints,
    };
  });

  // Header sits on discharge face Z so each riser is pure vertical into the tee.
  const headerZ = pumps[0].dischargeFace[2];
  const xs = pumps.map((p) => p.dischargeFace[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Short blind overhang past first/last riser (not so long it reads as a free boom).
  const headerStart: V3 = [minX - 0.4, INTAKE_HEADER_Y, headerZ];
  const headerEnd: V3 = [maxX + 0.4, INTAKE_HEADER_Y, headerZ];

  // PH1 continues from the exact west header endpoint. The previous takeoff
  // sat 0.15 m inside the capped header and made the export tube pass through
  // the blind flange.
  const ph1Takeoff: V3 = headerStart;
  const westClearX = minX - 1.8;

  const ph1TransferPoints: V3[] = [
    ph1Takeoff,
    [westClearX, INTAKE_HEADER_Y, headerZ],
    [westClearX, INTAKE_HEADER_Y, 3.8],
    [westClearX, PH1_INLET[1], 3.8],
    [PH1_INLET[0], PH1_INLET[1], 3.8],
    PH1_INLET,
  ];

  return {
    pumps,
    headerY: INTAKE_HEADER_Y,
    headerZ,
    headerStart,
    headerEnd,
    ph1Inlet: PH1_INLET,
    ph1TransferPoints,
    ph1Takeoff,
  };
}

export function dist3(a: V3, b: V3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function dir3(a: V3, b: V3): V3 | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return null;
  return [dx / len, dy / len, dz / len];
}

/** Last suction segment · outward normal; into mouth ≈ −1. */
export function suctionApproachDot(route: IntakePumpRoute): number {
  const outward = getSuctionDirection(LIFT_ROT);
  const n = route.suctionPoints.length;
  const approach = dir3(route.suctionPoints[n - 2], route.suctionPoints[n - 1]);
  if (!approach) return 0;
  return approach[0] * outward[0] + approach[1] * outward[1] + approach[2] * outward[2];
}

export function dischargeIsPureVertical(route: IntakePumpRoute, tol = 0.02): boolean {
  const x0 = route.dischargePoints[0][0];
  const z0 = route.dischargePoints[0][2];
  return route.dischargePoints.every(
    (p) => Math.abs(p[0] - x0) <= tol && Math.abs(p[2] - z0) <= tol,
  );
}

export function dischargeMeetsHeader(
  route: IntakePumpRoute,
  headerY: number,
  headerZ: number,
  tol = INTAKE_FLANGE_TOLERANCE_M,
): boolean {
  const top = route.dischargePoints[route.dischargePoints.length - 1];
  return Math.abs(top[1] - headerY) <= tol && Math.abs(top[2] - headerZ) <= tol;
}

export function suctionIsStraightAxial(route: IntakePumpRoute, tol = 0.02): boolean {
  const x0 = route.suctionPoints[0][0];
  const y0 = route.suctionPoints[0][1];
  return route.suctionPoints.every(
    (p) => Math.abs(p[0] - x0) <= tol && Math.abs(p[1] - y0) <= tol,
  );
}
