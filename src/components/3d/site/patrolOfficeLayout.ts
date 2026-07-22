/** Patrol duty office — southwest material yard (former sand pile area). */

export const PATROL_OFFICE_ORIGIN: [number, number, number] = [-56, 0.04, -21.5];
export const PATROL_OFFICE_SIZE: [number, number, number] = [10, 2.8, 5];

/** North door — opens onto the north service lane at z ≈ −18.0.
 *  The north wall sits at world z = −21.5 + 2.5 = −19.0; the door
 *  threshold is just outside (+Z) at z ≈ −18.85. */
export const PATROL_OFFICE_DOOR_X = -56;
export const PATROL_OFFICE_DOOR_Z = -18.85;

/** North service lane used for office approach / worker return legs. */
export const PATROL_OFFICE_APPROACH_Z = -18.0;

/** West connector on the main east–west road before turning south to the office. */
export const PATROL_OFFICE_WEST_LANE_X = -48;

/**
 * North–south transit spine used by every office round-trip.
 *
 * Patrol stops sit tight against equipment (tank walls + railings + pumps), so
 * a vertical leg drawn at `lastStop[0]` or `patrolStart[0]` slices straight
 * through that equipment's runtime shell. Instead, workers first slide along
 * their current safe lane (constant Z) to this X — verified clear of every
 * tank shell (hx+0.85 / hz+1.05 + 0.5m runtime margin) and pump footprint
 * along the full z≈-26..+22 corridor — and only then run north/south.
 *
 * -50 sits in the open strip between the duty office (west edge x≈-61) and the
 * westernmost process tank tk-ph1 (cx=-40, east shell edge x≈-36.15).
 */
export const PATROL_OFFICE_TRANSIT_SPINE_X = -50;

/** Interior walk slab top (slightly above foundation). */
export const PATROL_OFFICE_FLOOR_Y = 0.06;

/** Six assigned rest positions inside the office (world XZ). */
export const PATROL_OFFICE_REST_SLOTS: [number, number][] = [
  [-59.5, -20.2],
  [-56.5, -20.2],
  [-53.5, -20.2],
  [-59.5, -22.4],
  [-56.5, -22.4],
  [-53.5, -22.4],
];

/** Walkable office interior — used by getPatrolSurfaceY. */
export const PATROL_OFFICE_WALK_BOUNDS = {
  minX: -61,
  maxX: -51,
  minZ: -24.2,
  maxZ: -18.8,
  topY: PATROL_OFFICE_FLOOR_Y,
} as const;

/** North approach pad linking the west lane to the north door. */
export const PATROL_OFFICE_APPROACH_BOUNDS = {
  minX: -62,
  maxX: -47,
  minZ: -19.8,
  maxZ: -17.0,
  topY: -0.036,
} as const;

/** Build axis-aligned path between ordered XZ points (inserts L-turn corners). */
export function axisAlignedPath(points: [number, number][]): [number, number][] {
  if (points.length === 0) return [];
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const next = points[i];
    const sameX = Math.abs(prev[0] - next[0]) < 1e-3;
    const sameZ = Math.abs(prev[1] - next[1]) < 1e-3;
    if (!sameX && !sameZ) {
      out.push([next[0], prev[1]]);
    }
    const last = out[out.length - 1];
    if (Math.abs(last[0] - next[0]) > 1e-3 || Math.abs(last[1] - next[1]) > 1e-3) {
      out.push(next);
    }
  }
  return out;
}

/**
 * Round-trip office transit from the last patrol stop back to patrol start.
 * `mainRoadZ` is the primary east–west corridor (ROAD_MAIN_Z) used before the west–north leg.
 *
 * The vertical north/south legs are routed via `PATROL_OFFICE_TRANSIT_SPINE_X`
 * rather than the patrol stops' own X coordinates — the latter sit on top of
 * equipment footprints and would produce a vertical segment that pierces tank
 * walls / pumps. Workers first side-step along their current safe lane (constant Z)
 * to the spine, then run north/south on the spine.
 *
 * Door is now on the NORTH face (+Z direction, world z ≈ −18.85).
 * Workers travel south from the main road, peel west at WEST_LANE_X, then stop
 * just north of the building (APPROACH_Z ≈ −18.0) before stepping to the door.
 */
export function buildOfficeRoundTrip(
  lastStop: [number, number],
  patrolStart: [number, number],
  restSlotIndex: number,
  mainRoadZ: number,
): { toOffice: [number, number][]; toPatrolStart: [number, number][] } {
  const rest = PATROL_OFFICE_REST_SLOTS[restSlotIndex] ?? PATROL_OFFICE_REST_SLOTS[0];
  const door: [number, number] = [PATROL_OFFICE_DOOR_X, PATROL_OFFICE_DOOR_Z];
  const spineX = PATROL_OFFICE_TRANSIT_SPINE_X;

  const toOffice = axisAlignedPath([
    lastStop,
    [spineX, lastStop[1]],
    [spineX, mainRoadZ],
    [PATROL_OFFICE_WEST_LANE_X, mainRoadZ],
    [PATROL_OFFICE_WEST_LANE_X, PATROL_OFFICE_APPROACH_Z],
    [PATROL_OFFICE_DOOR_X, PATROL_OFFICE_APPROACH_Z],
    door,
    rest,
  ]);

  const toPatrolStart = axisAlignedPath([
    rest,
    door,
    [PATROL_OFFICE_DOOR_X, PATROL_OFFICE_APPROACH_Z],
    [PATROL_OFFICE_WEST_LANE_X, PATROL_OFFICE_APPROACH_Z],
    [PATROL_OFFICE_WEST_LANE_X, mainRoadZ],
    [spineX, mainRoadZ],
    [spineX, patrolStart[1]],
    patrolStart,
  ]);

  return { toOffice, toPatrolStart };
}
