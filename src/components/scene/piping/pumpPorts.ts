import * as THREE from 'three';

const MACHINE_SCALE = 0.5;
/** Exact Pump3D discharge-nozzle group centre (extended nozzle). */
const DISCHARGE_LOCAL = new THREE.Vector3(0, 1.58, -0.78).multiplyScalar(MACHINE_SCALE);
/** Exact Pump3D suction-nozzle group centre (extended nozzle). */
const SUCTION_LOCAL = new THREE.Vector3(0, 0.78, -1.14).multiplyScalar(MACHINE_SCALE);
/**
 * Suction mouth face offset along the nozzle axis in *unscaled* Pump3D local space
 * (PumpProcessFlanges suction group: mouth disk at local Y ≈ -0.047 after the π/2 X tilt,
 * which is world −Z before pump yaw). Scaled and rotated in getSuctionFacePoint.
 */
// PumpProcessFlanges uses an 0.018-deep sealing disc centred at -0.047 / +0.032.
// Route anchors sit on the *outer face* of those discs, not at the group centre.
const SUCTION_FACE_UNSCALED = 0.047 + 0.018 / 2;
const DISCHARGE_FACE_UNSCALED = 0.032 + 0.018 / 2;
const DISCHARGE_AXIS = new THREE.Vector3(0, 1, 0);
const SUCTION_AXIS = new THREE.Vector3(0, 0, -1);
const FLANGE_FACE_INSET = DISCHARGE_FACE_UNSCALED * MACHINE_SCALE;
/**
 * Controlled pipe seat past the published sealing face into the nozzle/gasket.
 * Deep enough to kill the air-gap "separated" look; shallow enough that the
 * green shell stays inside the nozzle and does not stab through the volute
 * (nozzle ~0.11 m after scale 0.5; seat must stay well under that).
 */
export const PUMP_FACE_SEAT = 0.045;
/** Hard upper bound for static checks — anything deeper risks volute stabbing. */
export const PUMP_FACE_SEAT_MAX = 0.06;
/** Legacy constants kept for geometry guard scripts; routes no longer insert stub vertices. */
const DISCHARGE_STUB_LEN = 0;
const SUCTION_STUB_LEN = 0;

function rotationQuat(rotationY: number) {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
}

function axisOffset(rotationY: number, axis: THREE.Vector3, length: number): [number, number, number] {
  const q = rotationQuat(rotationY);
  const offset = axis.clone().applyQuaternion(q).multiplyScalar(length);
  return [offset.x, offset.y, offset.z];
}

function worldAxis(rotationY: number, axis: THREE.Vector3, multiplier = 1): [number, number, number] {
  const q = rotationQuat(rotationY);
  const vector = axis.clone().applyQuaternion(q).multiplyScalar(multiplier).normalize();
  return [vector.x, vector.y, vector.z];
}

/** Outlet / inlet flange centres from Pump3D geometry (scale 0.5). */
export function getPumpFlanges(
  position: [number, number, number],
  rotationY = 0,
): {
  discharge: [number, number, number];
  suction: [number, number, number];
} {
  const q = rotationQuat(rotationY);
  const base = new THREE.Vector3(...position);
  const discharge = DISCHARGE_LOCAL.clone().applyQuaternion(q).add(base);
  const suction = SUCTION_LOCAL.clone().applyQuaternion(q).add(base);
  return {
    discharge: [discharge.x, discharge.y, discharge.z],
    suction: [suction.x, suction.y, suction.z],
  };
}

/** Exact outer sealing face of the pump discharge flange. */
export function getFlangeFacePoint(
  flange: [number, number, number],
  rotationY: number,
  inset = FLANGE_FACE_INSET,
): [number, number, number] {
  const [ox, oy, oz] = axisOffset(rotationY, DISCHARGE_AXIS, inset);
  return [flange[0] + ox, flange[1] + oy, flange[2] + oz];
}

/** Short vertical spool leaving the discharge flange before any header run. */
export function getFlangeStub(
  flange: [number, number, number],
  rotationY: number,
  length = DISCHARGE_STUB_LEN,
): [number, number, number] {
  const [ox, oy, oz] = axisOffset(rotationY, DISCHARGE_AXIS, length);
  return [flange[0] + ox, flange[1] + oy, flange[2] + oz];
}

/** Suction stub just outside the inlet face so suction pipe approaches from the pump mouth, not through the pump body. */
export function getSuctionStub(
  flange: [number, number, number],
  rotationY: number,
  length = SUCTION_STUB_LEN,
): [number, number, number] {
  const [ox, oy, oz] = axisOffset(rotationY, SUCTION_AXIS, length);
  return [flange[0] + ox, flange[1] + oy, flange[2] + oz];
}

/**
 * Outer suction mouth centre (flange face the process pipe seats into).
 * Offset from the suction group centre along the outward suction axis.
 */
export function getSuctionFacePoint(
  position: [number, number, number],
  rotationY: number,
): [number, number, number] {
  const { suction } = getPumpFlanges(position, rotationY);
  const [ox, oy, oz] = axisOffset(rotationY, SUCTION_AXIS, SUCTION_FACE_UNSCALED * MACHINE_SCALE);
  return [suction[0] + ox, suction[1] + oy, suction[2] + oz];
}

export function getDischargeFacePoint(
  position: [number, number, number],
  rotationY: number,
): [number, number, number] {
  const { discharge } = getPumpFlanges(position, rotationY);
  return getFlangeFacePoint(discharge, rotationY);
}

export function getDischargeDirection(rotationY: number): [number, number, number] {
  return worldAxis(rotationY, DISCHARGE_AXIS);
}

export function getSuctionDirection(rotationY: number): [number, number, number] {
  return worldAxis(rotationY, SUCTION_AXIS);
}

/** Discharge: flange face → riser → header branch (Pipe3D fillets the 90° corner). */
export function getDischargeBranch(
  position: [number, number, number],
  rotationY: number,
  headerY: number,
  headerZ: number,
): [number, number, number][] {
  const face = getDischargeFacePoint(position, rotationY);
  if (Math.abs(face[2] - headerZ) < 1e-6) {
    // Header shares the discharge flange Z: short vertical riser only (no over-motor run).
    return [face, pt(face[0], headerY, face[2])];
  }
  return [face, pt(face[0], headerY, face[2]), pt(face[0], headerY, headerZ)];
}

/** Vertical discharge riser from flange face up to header height at the same X/Z. */
export function getDischargeRiser(
  position: [number, number, number],
  rotationY: number,
  headerY: number,
): [number, number, number][] {
  const face = getDischargeFacePoint(position, rotationY);
  return [face, pt(face[0], headerY, face[2])];
}

/**
 * Discharge: flange face → short vertical riser → short horizontal spool to the
 * shared header centreline at (headerY, headerZ). Header must sit on the volute
 * / collection side of the pump (same side as the discharge nozzle), never on
 * the motor-cowl side, so the horizontal leg does not span the motor barrel.
 */
export function getDischargeToHeader(
  position: [number, number, number],
  rotationY: number,
  headerY: number,
  headerZ: number,
): [number, number, number][] {
  const face = getDischargeFacePoint(position, rotationY);
  const riserTop = pt(face[0], headerY, face[2]);
  if (Math.abs(face[2] - headerZ) < 1e-6) {
    return [face, riserTop];
  }
  return [face, riserTop, pt(face[0], headerY, headerZ)];
}

/** Suction: manifold → align → approach pump row → exact pump sealing face. */
export function getSuctionBranch(
  position: [number, number, number],
  rotationY: number,
  source: [number, number, number],
): [number, number, number][] {
  const mouth = getSuctionFacePoint(position, rotationY);
  return [
    source,
    pt(mouth[0], source[1], source[2]),
    pt(mouth[0], source[1], mouth[2]),
    mouth,
  ];
}

/**
 * Tank wall → exact pump suction sealing face.
 * Forces the wall point onto mouth height so the spool never approaches with
 * a vertical dogleg at the flange (void/side-hit look in close-up).
 * When the wall port is laterally offset from the mouth (corner clamp), jog
 * outside the basin first so the run never cuts the coping diagonally.
 */
export function getDirectTankSuctionBranch(
  position: [number, number, number],
  rotationY: number,
  tankInsertion: [number, number, number],
): [number, number, number][] {
  const mouth = getSuctionFacePoint(position, rotationY);
  const wall = pt(tankInsertion[0], mouth[1], tankInsertion[2]);
  const outX = mouth[0] - wall[0];
  const outZ = mouth[2] - wall[2];
  const outLen = Math.hypot(outX, outZ);
  if (outLen < 1e-6) return [mouth];
  const ox = outX / outLen;
  const oz = outZ / outLen;
  // Penetrate just past the inner face along the wall normal (into the basin).
  const poolInner = pt(wall[0] - ox * 0.4, mouth[1], wall[2] - oz * 0.4);

  // Pure axial: wall and mouth already share X (N/S wall) or Z (E/W wall).
  if (Math.abs(wall[0] - mouth[0]) < 0.04 || Math.abs(wall[2] - mouth[2]) < 0.04) {
    return [poolInner, wall, mouth];
  }

  // Lateral offset (corner clamp): stay outside the wall, then turn to the mouth.
  const outside = pt(wall[0] + ox * 0.35, mouth[1], wall[2] + oz * 0.35);
  const alignPt =
    Math.abs(oz) >= Math.abs(ox)
      ? pt(mouth[0], mouth[1], outside[2]) // north/south wall: jog in X outside
      : pt(outside[0], mouth[1], mouth[2]); // east/west wall: jog in Z outside
  return [poolInner, wall, outside, alignPt, mouth];
}

/**
 * Elevated axial suction: wall high → run high → drop outside mouth → axial into mouth.
 * Much more visible in wide/intake cameras than a deck-height pin stub.
 */
export function getElevatedAxialSuctionBranch(
  position: [number, number, number],
  rotationY: number,
  tankInsertion: [number, number, number],
  runY = 1.32,
  approachOut = 0.22,
): [number, number, number][] {
  const mouth = getSuctionFacePoint(position, rotationY);
  const [ox, oy, oz] = axisOffset(rotationY, SUCTION_AXIS, approachOut);
  const approach = pt(mouth[0] + ox, mouth[1] + oy, mouth[2] + oz);
  const wallHigh = pt(mouth[0], runY, tankInsertion[2]);
  const approachHigh = pt(approach[0], runY, approach[2]);
  const approachLow = pt(approach[0], mouth[1], approach[2]);
  return [wallHigh, approachHigh, approachLow, mouth];
}

/** World position of the external suction joint (for open-flange fittings). */
export function getSuctionJointPoint(
  position: [number, number, number],
  rotationY: number,
  jointLen = 0.22,
): [number, number, number] {
  const mouth = getSuctionFacePoint(position, rotationY);
  const [ox, oy, oz] = axisOffset(rotationY, SUCTION_AXIS, jointLen);
  return [mouth[0] + ox, mouth[1] + oy, mouth[2] + oz];
}

export function pt(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}
