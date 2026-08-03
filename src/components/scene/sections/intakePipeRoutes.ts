/**
 * Intake lift → PH1 route builder (single topology source).
 *
 * Topology (first principles):
 *   collection wall ──axial spool──► pump suction mouth
 *   pump discharge face ──vertical riser──► shared header
 *   header aligned takeoff ──drop below slab──► buried transfer ──rise into PH1
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
} from '../piping/pumpPorts';
import {
  HIDDEN_PROCESS_PIPE_Y,
  WALKWAY_OVERHEAD_PIPE_Y,
} from '../piping/pipeRouting';
import {
  COLLECTION_SOUTH_WALL_Z,
  LIFT_PUMPS,
  LIFT_ROT,
  liftPumpWorldPosition,
  type LiftSuctionSource,
  type V3,
} from './intakeLayout';

export const INTAKE_RAW_WATER_R = 0.1;
/** ~ pump suction nozzle bore after scale 0.5 (Pump3D nozzle r≈0.0825). */
export const INTAKE_SUCTION_R = 0.085;
/** Match discharge nozzle bore so the riser seats flush on the pump flange. */
export const INTAKE_DISCHARGE_R = 0.085;
// Keep the lift header above the pump-bay pedestrian route; the PH1 transfer
// drops below the slab immediately after its header takeoff.
export const INTAKE_HEADER_Y = WALKWAY_OVERHEAD_PIPE_Y;
export const INTAKE_MIN_SUCTION_LEN = 0.55;
export const PH1_INLET: V3 = [-40, 1.12, -3.05];
/** Buried collection-to-PH1 transfer centreline below the site slab. */
export const PH1_TRANSFER_UNDERGROUND_Y = HIDDEN_PROCESS_PIPE_Y;
/** Exposed straight length around each above-ground 90° elbow. */
export const PH1_VISIBLE_ELBOW_LEG = 0.72;
export const INTAKE_FLANGE_TOLERANCE_M = 0.08;
export const INTAKE_HEADER_END_CLEARANCE = 0.14;
/** External joint length outside suction mouth (hosts pipe-side open flange). */
export const INTAKE_SUCTION_JOINT_LEN = 0;
/** Short normal penetration so the suction shell visibly enters the basin. */
export const INTAKE_WALL_PENETRATION = 0.45;

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

function suctionWallPoint(_source: LiftSuctionSource, mouth: V3): V3 {
  // Both lift-pump banks draw from a collection-basin wall. There is no free
  // air/gas source: every suction flange must resolve to a physical tank wall.
  return pt(mouth[0], mouth[1], COLLECTION_SOUTH_WALL_Z);
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
  ph1VisibleElbows: Array<{ previous: V3; corner: V3; next: V3 }>;
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

  // Compact blind-end clearance only; long decorative overhangs read as orphan pipes.
  const headerStart: V3 = [minX - INTAKE_HEADER_END_CLEARANCE, INTAKE_HEADER_Y, headerZ];
  const headerEnd: V3 = [maxX + INTAKE_HEADER_END_CLEARANCE, INTAKE_HEADER_Y, headerZ];

  // PH1 inlet and the header overlap in X. Drop beside the header, run the long
  // north/south transfer below the site slab, then rise only at the PH1 wall.
  // This keeps the pipe clear of the PH1 platform, guardrails, and agitator.
  const ph1Takeoff: V3 = [PH1_INLET[0], INTAKE_HEADER_Y, headerZ];
  const headerDropElbow: V3 = [
    PH1_INLET[0],
    INTAKE_HEADER_Y,
    headerZ - PH1_VISIBLE_ELBOW_LEG,
  ];
  const headerBuriedEntry: V3 = [
    PH1_INLET[0],
    PH1_TRANSFER_UNDERGROUND_Y,
    headerDropElbow[2],
  ];
  const ph1BuriedRiser: V3 = [
    PH1_INLET[0],
    PH1_TRANSFER_UNDERGROUND_Y,
    PH1_INLET[2] - PH1_VISIBLE_ELBOW_LEG,
  ];
  const ph1WallEntryElbow: V3 = [
    PH1_INLET[0],
    PH1_INLET[1],
    ph1BuriedRiser[2],
  ];
  const ph1TransferPoints: V3[] = [
    ph1Takeoff,
    headerDropElbow,
    headerBuriedEntry,
    ph1BuriedRiser,
    ph1WallEntryElbow,
    PH1_INLET,
  ];
  const ph1VisibleElbows = [
    { previous: ph1Takeoff, corner: headerDropElbow, next: headerBuriedEntry },
    { previous: ph1BuriedRiser, corner: ph1WallEntryElbow, next: PH1_INLET },
  ];

  return {
    pumps,
    headerY: INTAKE_HEADER_Y,
    headerZ,
    headerStart,
    headerEnd,
    ph1Inlet: PH1_INLET,
    ph1TransferPoints,
    ph1VisibleElbows,
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
