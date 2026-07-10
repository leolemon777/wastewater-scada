import * as THREE from 'three';

const MACHINE_SCALE = 0.5;
const DISCHARGE_LOCAL = new THREE.Vector3(0, 1.68, -0.78).multiplyScalar(MACHINE_SCALE);
const SUCTION_LOCAL = new THREE.Vector3(0, 0.78, -1.54).multiplyScalar(MACHINE_SCALE);
/**
 * Suction mouth face offset along the nozzle axis in *unscaled* Pump3D local space
 * (PumpProcessFlanges suction group: mouth disk at local Y ≈ -0.047 after the π/2 X tilt,
 * which is world −Z before pump yaw). Scaled and rotated in getSuctionFacePoint.
 */
const SUCTION_MOUTH_UNSCALED = 0.047;
const DISCHARGE_AXIS = new THREE.Vector3(0, 1, 0);
const SUCTION_AXIS = new THREE.Vector3(0, 0, -1);
const FLANGE_FACE_INSET = -0.025;
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

/** Pipe start at the discharge socket centre; Pipe3D endpoint overlap handles insertion into the pump body. */
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
  const [ox, oy, oz] = axisOffset(rotationY, SUCTION_AXIS, SUCTION_MOUTH_UNSCALED * MACHINE_SCALE);
  return [suction[0] + ox, suction[1] + oy, suction[2] + oz];
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
  const { discharge } = getPumpFlanges(position, rotationY);
  const face = getFlangeFacePoint(discharge, rotationY);
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
  const { discharge } = getPumpFlanges(position, rotationY);
  const face = getFlangeFacePoint(discharge, rotationY);
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
  const { discharge } = getPumpFlanges(position, rotationY);
  const face = getFlangeFacePoint(discharge, rotationY);
  const riserTop = pt(face[0], headerY, face[2]);
  if (Math.abs(face[2] - headerZ) < 1e-6) {
    return [face, riserTop];
  }
  return [face, riserTop, pt(face[0], headerY, headerZ)];
}

/** Suction: manifold → align → approach pump row → flange centre (no stub vertex). */
export function getSuctionBranch(
  position: [number, number, number],
  rotationY: number,
  source: [number, number, number],
): [number, number, number][] {
  const { suction } = getPumpFlanges(position, rotationY);
  return [
    source,
    pt(suction[0], source[1], source[2]),
    pt(suction[0], source[1], suction[2]),
    suction,
  ];
}

/** Tank wall → pump suction mouth face (equipment overlap seats the pipe into the nozzle). */
export function getDirectTankSuctionBranch(
  position: [number, number, number],
  rotationY: number,
  tankInsertion: [number, number, number],
): [number, number, number][] {
  const { suction } = getPumpFlanges(position, rotationY);
  return [pt(tankInsertion[0], suction[1], tankInsertion[2]), suction];
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
