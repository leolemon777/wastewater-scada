/**
 * Sludge dehydration platform layout — single source of truth for deck footprint,
 * south service road, and the one vehicle ramp that links them.
 */

export const SLUDGE_GROUP_ORIGIN: [number, number, number] = [15, 0, 15];

export const SLUDGE_PLATFORM_SIZE: [number, number, number] = [30, 0.5, 12];

export const SLUDGE_PLATFORM_DECK_Y = 0.5;

export const SLUDGE_SOUTH_ROAD_Z = 22.4;

/** World-space deck footprint (group origin + platform size). */
export const SLUDGE_PLATFORM_BOUNDS = {
  minX: SLUDGE_GROUP_ORIGIN[0] - SLUDGE_PLATFORM_SIZE[0] / 2,
  maxX: SLUDGE_GROUP_ORIGIN[0] + SLUDGE_PLATFORM_SIZE[0] / 2,
  minZ: SLUDGE_GROUP_ORIGIN[2] - SLUDGE_PLATFORM_SIZE[2] / 2,
  maxZ: SLUDGE_GROUP_ORIGIN[2] + SLUDGE_PLATFORM_SIZE[2] / 2,
} as const;

/** Screw press sp-1 world center (SludgeSection [15,0,15] + local [4,1,0]). */
export const SLUDGE_SCREW_PRESS_X = 19;
export const SLUDGE_SCREW_PRESS_Z = 15;

/** Ton bag under the screw-press discharge chute (ScrewPress3D local RECEIVING_BAG_*). */
export const SLUDGE_BAG_RECEIVING_X = 21.35;
export const SLUDGE_BAG_RECEIVING_Z = 15.72;

/**
 * Enclosed light-steel room for the screw press, drive and receiving ton bag.
 * The south roll-up opening aligns with the forklift load/retreat path; the
 * west wall carries the shared sludge/PAM pipe penetration at y=2.55.
 */
export const SLUDGE_DEWATERING_HOUSE = {
  position: [19.3, SLUDGE_PLATFORM_DECK_Y, 15.5] as [number, number, number],
  size: [7.6, 3.35, 5.8] as [number, number, number],
  southDoorCenterX: 1.0,
  doorWidth: 3.8,
  doorHeight: 2.8,
  pipeEntryWorld: [15.5, 2.55, 15] as [number, number, number],
} as const;

/** Forklift load stop — south of the chute bag, forks reach north under the discharge. */
export const SLUDGE_LOAD_X = 21.35;
export const SLUDGE_LOAD_Z = 17.17;

/** South roll-up door centreline and clear approach for the dewatering room. */
export const SLUDGE_DEWATERING_DOOR_X =
  SLUDGE_DEWATERING_HOUSE.position[0] + SLUDGE_DEWATERING_HOUSE.southDoorCenterX;
export const SLUDGE_DEWATERING_DOOR_APPROACH_Z =
  SLUDGE_DEWATERING_HOUSE.position[2] + SLUDGE_DEWATERING_HOUSE.size[2] / 2 + 1.6;

/**
 * Merged hazardous-waste warehouse (former 危废库 + adjacent site office footprint).
 * Axis-aligned shell with a north roll-up door facing the sludge service road.
 */
export const HAZWASTE_WAREHOUSE = {
  position: [43.5, 0.04, 24.0] as [number, number, number],
  rotationY: 0,
  size: [14.0, 2.65, 7.6] as [number, number, number],
  doorWidth: 3.6,
  doorHeight: 2.45,
} as const;

/** Door center X (same as building center — forklift enters straight). */
export const HAZWASTE_DOOR_X = 43.5;

/** North apron stop — just outside the roll-up door before driving in. */
export const HAZWASTE_DOOR_APPROACH_Z = 18.55;

/** Interior unload stop — deep enough for the bag to clear the roll-up door. */
export const HAZWASTE_INTERIOR_UNLOAD_Z = 24.35;

/** @deprecated use HAZWASTE_DOOR_* */
export const HAZWASTE_DELIVERY_X = HAZWASTE_DOOR_X;
/** @deprecated use HAZWASTE_DOOR_APPROACH_Z */
export const HAZWASTE_DELIVERY_Z = HAZWASTE_DOOR_APPROACH_Z;

/** After descending the ramp, drive forward (+Z) on flat ground before turning east. */
export const SLUDGE_RUNOUT_Z = 23.65;
export const SLUDGE_SOUTH_RUNOUT_X = 26.0;

/**
 * Approach lanes the forklift uses to reach the warehouse north door.
 * The warehouse body spans roughly x ∈ [36.5, 50.5], z ∈ [20.2, 27.8];
 * the west lane stays clear of the west wall, the north lane sits on the
 * sludge service road (outside the platform deck, maxZ = 21).
 */
export const HAZWASTE_WEST_LANE_X = 34.5;
export const HAZWASTE_NORTH_LANE_Z = 16.0;

/** Interior staging slots (world X/Z) — bags appear here after unload. */
export const HAZWASTE_INTERIOR_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [41.2, 24.35],
  [43.5, 24.35],
  [45.8, 24.35],
  [43.5, 21.35],
] as const;

/** @deprecated use HAZWASTE_DOOR_* */
export const SLUDGE_YARD_X = HAZWASTE_DOOR_X;
/** @deprecated use HAZWASTE_DOOR_APPROACH_Z */
export const SLUDGE_YARD_Z = HAZWASTE_DOOR_APPROACH_Z;

/**
 * One south-facing access ramp aligned with the screw press and south road.
 * zGround > zPlatform: +Z is south (ground road), −Z climbs onto the deck.
 */
export const SLUDGE_ACCESS_RAMP = {
  x: SLUDGE_SCREW_PRESS_X,
  halfWidth: 2.8,
  zGround: SLUDGE_SOUTH_ROAD_Z + 0.95,
  zPlatform: SLUDGE_PLATFORM_BOUNDS.maxZ,
} as const;

export const PATROL_GROUND_Y = 0;

export const SLUDGE_RAMP_MID_Z = (SLUDGE_ACCESS_RAMP.zGround + SLUDGE_ACCESS_RAMP.zPlatform) / 2;

export const SLUDGE_DECK_ENTRY_Z = 20;

/**
 * Driving-surface thickness of the ramp slab at its south (ground) toe.
 * The ramp top face ramps from this thickness up flush to the platform deck
 * (SLUDGE_PLATFORM_DECK_Y) at the north end, so vehicles never sit below or
 * above the concrete they're driving on. Must match PlatformAccessRamp3D.
 */
export const SLUDGE_RAMP_DECK_THICKNESS = 0.11;

export function getSludgeForkliftSurfaceY(x: number, z: number): number {
  const ramp = SLUDGE_ACCESS_RAMP;
  const { minX, maxX, minZ, maxZ } = SLUDGE_PLATFORM_BOUNDS;

  if (Math.abs(x - ramp.x) <= ramp.halfWidth && z <= ramp.zGround && z >= ramp.zPlatform) {
    // At the ramp foot, east-west travel is on flat road — not side-slope on the wedge.
    if (z >= ramp.zGround - 0.06 && Math.abs(x - ramp.x) > 0.55) {
      return PATROL_GROUND_Y;
    }
    // Driving surface rises linearly from the south toe (flush with road, y=0)
    // to the north end where it meets the platform deck flush (y=rise).
    const t = (ramp.zGround - z) / (ramp.zGround - ramp.zPlatform);
    return t * SLUDGE_PLATFORM_DECK_Y;
  }

  if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
    return SLUDGE_PLATFORM_DECK_Y;
  }

  const [warehouseX, , warehouseZ] = HAZWASTE_WAREHOUSE.position;
  const [warehouseWidth, , warehouseDepth] = HAZWASTE_WAREHOUSE.size;
  if (
    x >= warehouseX - warehouseWidth / 2
    && x <= warehouseX + warehouseWidth / 2
    && z >= warehouseZ - warehouseDepth / 2
    && z <= warehouseZ + warehouseDepth / 2
  ) {
    return 0.08;
  }

  return PATROL_GROUND_Y;
}
