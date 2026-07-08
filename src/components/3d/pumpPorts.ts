import * as THREE from 'three';

const MACHINE_SCALE = 0.5;
const DISCHARGE_LOCAL = new THREE.Vector3(0, 1.68, -0.78).multiplyScalar(MACHINE_SCALE);
const SUCTION_LOCAL = new THREE.Vector3(0, 0.78, -1.54).multiplyScalar(MACHINE_SCALE);
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
  return [face, pt(face[0], headerY, face[2]), pt(face[0], headerY, headerZ)];
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

/** Tank wall → pump suction flange (equipment overlap seats the pipe into the pump). */
export function getDirectTankSuctionBranch(
  position: [number, number, number],
  rotationY: number,
  tankInsertion: [number, number, number],
): [number, number, number][] {
  const { suction } = getPumpFlanges(position, rotationY);
  return [pt(tankInsertion[0], suction[1], tankInsertion[2]), suction];
}

export function pt(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}
