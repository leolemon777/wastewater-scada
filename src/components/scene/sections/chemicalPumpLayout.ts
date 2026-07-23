export type ChemicalPoint = [number, number, number];

export const CHEMICAL_DOSING_ORIGIN: ChemicalPoint = [-20, 0, -15];
export const CHEMICAL_METERING_RADIUS = 0.028;
/**
 * Yaw π flips the skid so suction (local +Z flange) faces the tank row (−Z)
 * and discharge (local −Z flange) faces the delivery gallery (+Z).
 */
export const CHEMICAL_PUMP_ROTATION_Y = Math.PI;

const PUMP_Y = 0.82;
// Front edge of the raised chemical plinth; the 0.55-deep skids remain supported.
const PUMP_Z = -14.05;
const TANK_Z = -15;
const TANK_RADIUS = 0.6;

/**
 * Outer sealing faces of ChemicalMeteringPump3D process flanges (unrotated local).
 * Suction group centre (0, 0.36, 0.2): flange disc half-height 0.025 along local +Z.
 * Discharge group centre (0, 0.46, -0.18): flange disc half-height 0.025 along local −Z.
 * Routes seat on these outer faces — not the inner nozzle neck.
 */
const SUCTION_LOCAL: ChemicalPoint = [0, 0.36, 0.2 + 0.025];
const DISCHARGE_LOCAL: ChemicalPoint = [0, 0.46, -0.18 - 0.025];
/** Local outward normals of the sealing faces (pipe-side). */
const SUCTION_OUTWARD_LOCAL: ChemicalPoint = [0, 0, 1];
const DISCHARGE_OUTWARD_LOCAL: ChemicalPoint = [0, 0, -1];
/** Axial spool length outside the face before any tee/lateral (survives Pipe3D min-run collapse). */
const AXIAL_SPOOL = 0.28;

export interface ChemicalPumpPlacement {
  id: string;
  position: ChemicalPoint;
  rotationY: number;
}

export interface ChemicalPumpGroup {
  key: string;
  color: string;
  tankId: string;
  tankX: number;
  pumps: readonly [ChemicalPumpPlacement, ChemicalPumpPlacement];
  tankOutlet: ChemicalPoint;
  deliveryTakeoff: ChemicalPoint;
}

function rotateY(point: ChemicalPoint, rotationY: number): ChemicalPoint {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return [point[0] * c + point[2] * s, point[1], -point[0] * s + point[2] * c];
}

function makePump(id: string, x: number): ChemicalPumpPlacement {
  return { id, position: [x, PUMP_Y, PUMP_Z], rotationY: CHEMICAL_PUMP_ROTATION_Y };
}

function makeGroup(
  key: string,
  color: string,
  tankId: string,
  tankX: number,
  ids: readonly [string, string],
): ChemicalPumpGroup {
  const pumps = [makePump(ids[0], tankX - 0.45), makePump(ids[1], tankX + 0.45)] as const;
  // Delivery takeoff sits on the discharge outward axis of the group centreline.
  const sampleFace = chemicalDischargeFace(pumps[0]);
  const outward = rotateY(DISCHARGE_OUTWARD_LOCAL, CHEMICAL_PUMP_ROTATION_Y);
  const takeoffZ = sampleFace[2] + outward[2] * AXIAL_SPOOL;
  return {
    key,
    color,
    tankId,
    tankX,
    pumps,
    tankOutlet: [tankX, PUMP_Y + SUCTION_LOCAL[1], TANK_Z + TANK_RADIUS],
    deliveryTakeoff: [tankX, sampleFace[1], takeoffZ],
  };
}

export const CHEMICAL_PUMP_GROUPS: readonly ChemicalPumpGroup[] = [
  makeGroup('ph-pac', '#D97706', 'tk-ph-pac', -35, ['p-pac-1', 'p-pac-2']),
  makeGroup('ph-cacl2', '#E2E8F0', 'tk-ph-cacl2', -30, ['p-cacl2-1', 'p-cacl2-2']),
  makeGroup('ph-pam', '#BAE6FD', 'tk-ph-pam', -25, ['p-pam-1', 'p-pam-2']),
  makeGroup('daf-pac', '#D97706', 'tk-daf-pac', -20, ['p-daf-coag-1', 'p-daf-coag-2']),
  makeGroup('daf-pam', '#BAE6FD', 'tk-daf-pam', -15, ['p-daf-floc-1', 'p-daf-floc-2']),
  makeGroup('screw-pam', '#BAE6FD', 'tk-screw-pam', -10, ['p-screw-pam-1', 'p-screw-pam-2']),
];

export function chemicalWorldToLocal(point: readonly [number, number, number]): ChemicalPoint {
  return [
    point[0] - CHEMICAL_DOSING_ORIGIN[0],
    point[1] - CHEMICAL_DOSING_ORIGIN[1],
    point[2] - CHEMICAL_DOSING_ORIGIN[2],
  ];
}

function portFace(pump: ChemicalPumpPlacement, local: ChemicalPoint): ChemicalPoint {
  const offset = rotateY(local, pump.rotationY);
  return [
    pump.position[0] + offset[0],
    pump.position[1] + offset[1],
    pump.position[2] + offset[2],
  ];
}

export function chemicalSuctionFace(pump: ChemicalPumpPlacement): ChemicalPoint {
  return portFace(pump, SUCTION_LOCAL);
}

export function chemicalDischargeFace(pump: ChemicalPumpPlacement): ChemicalPoint {
  return portFace(pump, DISCHARGE_LOCAL);
}

export function chemicalSuctionOutward(pump: ChemicalPumpPlacement): ChemicalPoint {
  return rotateY(SUCTION_OUTWARD_LOCAL, pump.rotationY);
}

export function chemicalDischargeOutward(pump: ChemicalPumpPlacement): ChemicalPoint {
  return rotateY(DISCHARGE_OUTWARD_LOCAL, pump.rotationY);
}

/**
 * Tank-side suction: shared manifold height at mouth Y → lateral to mouth X →
 * pure axial spool into the sealing face (last leg ≥ AXIAL_SPOOL so Pipe3D
 * collapse cannot turn it into a diagonal).
 */
export function chemicalSuctionPoints(group: ChemicalPumpGroup, pump: ChemicalPumpPlacement): ChemicalPoint[] {
  const face = chemicalSuctionFace(pump);
  const outward = chemicalSuctionOutward(pump);
  const joint: ChemicalPoint = [
    face[0] + outward[0] * AXIAL_SPOOL,
    face[1] + outward[1] * AXIAL_SPOOL,
    face[2] + outward[2] * AXIAL_SPOOL,
  ];
  // Manifold runs along X at joint Z (tank side of face).
  return [
    [group.tankX, face[1], joint[2]],
    [joint[0], joint[1], joint[2]],
    face,
  ];
}

export function chemicalSuctionHeaderPoints(group: ChemicalPumpGroup): ChemicalPoint[] {
  const face = chemicalSuctionFace(group.pumps[0]);
  const outward = chemicalSuctionOutward(group.pumps[0]);
  const manifoldZ = face[2] + outward[2] * AXIAL_SPOOL;
  return [group.tankOutlet, [group.tankX, face[1], manifoldZ]];
}

/**
 * Discharge: sealing face → pure axial spool → lateral to shared delivery takeoff.
 */
export function chemicalDischargePoints(group: ChemicalPumpGroup, pump: ChemicalPumpPlacement): ChemicalPoint[] {
  const face = chemicalDischargeFace(pump);
  const outward = chemicalDischargeOutward(pump);
  const joint: ChemicalPoint = [
    face[0] + outward[0] * AXIAL_SPOOL,
    face[1] + outward[1] * AXIAL_SPOOL,
    face[2] + outward[2] * AXIAL_SPOOL,
  ];
  // Shared takeoff is on the group centreline at the same axial station.
  return [face, joint, [group.deliveryTakeoff[0], joint[1], joint[2]]];
}
