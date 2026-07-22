/**
 * Shared intake lift-pump layout - single source of truth for IntakeSection
 * equipment placement and IndustrialPipeNetwork3D flange routing.
 *
 * World position = INTAKE_GROUP + local (x, y, z).
 */
import { INTAKE_GROUP } from '../pipeRouting';

export type V3 = [number, number, number];

/** Pump yaw maps the local suction nozzle toward the collection basins. */
export const LIFT_ROT = Math.PI;

export const LIFT_PUMP_LOCAL_Y = 0.5;
export const LIFT_PUMP_LOCAL_Z = -4.85;

export type LiftSuctionSource = 'collection-1' | 'collection-2';

export const LIFT_PUMPS: ReadonlyArray<{
  id:
    | 'p-lift-1'
    | 'p-lift-2'
    | 'p-lift-3'
    | 'p-lift-4'
    | 'p-gas-lift-1'
    | 'p-gas-lift-2';
  localX: number;
  source: LiftSuctionSource;
}> = [
  // Keep every wall penetration at least 0.5 m away from a basin corner.
  { id: 'p-lift-1', localX: -2.4, source: 'collection-1' },
  { id: 'p-lift-2', localX: -0.8, source: 'collection-1' },
  { id: 'p-lift-3', localX: 3.6, source: 'collection-2' },
  { id: 'p-lift-4', localX: 5.2, source: 'collection-2' },
  { id: 'p-gas-lift-1', localX: 7, source: 'collection-2' },
  { id: 'p-gas-lift-2', localX: 8.4, source: 'collection-2' },
];

export function liftPumpWorldPosition(localX: number): V3 {
  return [
    INTAKE_GROUP[0] + localX,
    LIFT_PUMP_LOCAL_Y,
    INTAKE_GROUP[2] + LIFT_PUMP_LOCAL_Z,
  ];
}

/** Collection basin centres in world space (match IntakeSection tank placement). */
export const COLLECTION_1_WORLD: V3 = [INTAKE_GROUP[0], 0.5, INTAKE_GROUP[2]];
export const COLLECTION_2_WORLD: V3 = [INTAKE_GROUP[0] + 6, 0.5, INTAKE_GROUP[2]];
/** Outer south face of the 6 m collection basins. */
export const COLLECTION_SOUTH_WALL_Z = INTAKE_GROUP[2] - 3 + 0.05;
