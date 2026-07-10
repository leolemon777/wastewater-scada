/**
 * Patrol routes for site workers — axis-aligned segments on decks and service roads.
 * Equipment anchors mirror section component world positions (group origin + local pos).
 */

import {
  buildOfficeRoundTrip,
  PATROL_OFFICE_APPROACH_BOUNDS,
  PATROL_OFFICE_WALK_BOUNDS,
} from './patrolOfficeLayout';

export const PATROL_GROUND_Y = 0;

/** Site road / corridor constants (aligned with SiteContext3D ground rects). */
export const ROAD_MAIN_Z = 8.3;
/** Main-process platform south apron — deck edge z=−6, stay south of tank walls + railings. */
export const ROAD_SOUTH_PROCESS_Z = -5.88;
/** Ground north of deep-treatment deck — used by all deep-treatment tanks except tk-daf. */
export const ROAD_DEEP_NORTH_Z = -10;
/**
 * tk-daf-only north stand. tk-daf is the deepest basin in this row (hz=4), so
 * its shell north edge (-15 + 4+1.05 + 0.5m margin = -9.45) is too close to the
 * shared -10 lane. A tk-daf stand at z=-10 would sit 0.5m inside its own shell.
 * -9.0 keeps the standard 0.45m+ clearance. Other tanks (hz≤3) stay at -10.
 */
export const ROAD_DEEP_NORTH_Z_DAF = -9.0;
/** Deep south service road. */
export const ROAD_SOUTH_DEEP_Z = -23.4;
export const ROAD_DEEP_CONNECT_X = 34;
/** Chemical dosing building front / back lanes. */
export const ROAD_CHEM_FRONT_Z = -11;
export const ROAD_CHEM_BACK_Z = -19;
export const ROAD_CHEM_WEST_X = -38;
/** Sludge dehydration north service pad. */
export const ROAD_SLUDGE_NORTH_Z = 21.4;
/** DAF sludge pump row (south of deep deck). */
export const ROAD_DAF_SLUDGE_Z = -22.8;
/** Worker capsule radius used for obstacle clearance (world metres, pre-scale). */
export const WORKER_BODY_RADIUS = 0.48;
/** Visual surface height of asphalt / concrete roads — matches SiteContext3D `roadY`. */
export const ROAD_SURFACE_Y = -0.036;

/**
 * Raised concrete platform WALK surface — Platform3D box top (h=0.5 slab → top y=0.5).
 */
export const PLATFORM_DECK_TOP_Y = 0.5;

const PATROL_WALK_CORRIDORS: { minX: number; maxX: number; minZ: number; maxZ: number; surfaceY: number }[] = [
  { minX: -56, maxX: 52, minZ: 6.75, maxZ: 9.85, surfaceY: ROAD_SURFACE_Y },
  { minX: -40, maxX: 2, minZ: -10.35, maxZ: -8.05, surfaceY: ROAD_SURFACE_Y },
  { minX: -48, maxX: 18, minZ: -24.8, maxZ: -22.0, surfaceY: ROAD_SURFACE_Y },
  { minX: 26, maxX: 52, minZ: -24.8, maxZ: -22.0, surfaceY: ROAD_SURFACE_Y },
  { minX: 27.3, maxX: 30.7, minZ: -26, maxZ: 10, surfaceY: ROAD_SURFACE_Y },
  { minX: 30.3, maxX: 31.7, minZ: -26, maxZ: -9, surfaceY: ROAD_SURFACE_Y },
  { minX: 33.3, maxX: 34.7, minZ: -26, maxZ: -9, surfaceY: ROAD_SURFACE_Y },
  { minX: -53.5, maxX: -26.5, minZ: 21.0, maxZ: 25.8, surfaceY: ROAD_SURFACE_Y },
  { minX: 4, maxX: 30, minZ: 19.4, maxZ: 24.6, surfaceY: ROAD_SURFACE_Y },
  { minX: 30, maxX: 50, minZ: -18.0, maxZ: -11.6, surfaceY: ROAD_SURFACE_Y },
  { minX: -39.5, maxX: -36.5, minZ: -20.5, maxZ: -9.5, surfaceY: ROAD_SURFACE_Y },
  {
    minX: PATROL_OFFICE_APPROACH_BOUNDS.minX,
    maxX: PATROL_OFFICE_APPROACH_BOUNDS.maxX,
    minZ: PATROL_OFFICE_APPROACH_BOUNDS.minZ,
    maxZ: PATROL_OFFICE_APPROACH_BOUNDS.maxZ,
    surfaceY: PATROL_OFFICE_APPROACH_BOUNDS.topY,
  },
];

const WORKER_PLATFORMS: { minX: number; maxX: number; minZ: number; maxZ: number; topY: number }[] = [
  { minX: -52, maxX: -28, minZ: 9, maxZ: 21, topY: PLATFORM_DECK_TOP_Y },
  { minX: -45, maxX: 25, minZ: -6, maxZ: 6, topY: PLATFORM_DECK_TOP_Y },
  { minX: -3, maxX: 43, minZ: -21, maxZ: -9, topY: PLATFORM_DECK_TOP_Y },
  { minX: -39, maxX: -1, minZ: -19, maxZ: -11, topY: PLATFORM_DECK_TOP_Y },
  { minX: 0, maxX: 30, minZ: 9, maxZ: 21, topY: PLATFORM_DECK_TOP_Y },
  {
    minX: PATROL_OFFICE_WALK_BOUNDS.minX,
    maxX: PATROL_OFFICE_WALK_BOUNDS.maxX,
    minZ: PATROL_OFFICE_WALK_BOUNDS.minZ,
    maxZ: PATROL_OFFICE_WALK_BOUNDS.maxZ,
    topY: PATROL_OFFICE_WALK_BOUNDS.topY,
  },
];

/** Return walkable surface Y at (x,z) — platform decks beat perimeter roads at overlaps. */
export function getPatrolSurfaceY(x: number, z: number): number {
  for (const p of WORKER_PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      return p.topY;
    }
  }
  for (const c of PATROL_WALK_CORRIDORS) {
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
      return c.surfaceY;
    }
  }
  return ROAD_SURFACE_Y;
}

export interface PatrolDefinition {
  path: [number, number, number][];
  targets: string[];
}

export interface PatrolAnchor {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  focusY?: number;
}

/**
 * World-space equipment footprints — keep in sync with section group origins:
 * MainProcess [-10,0,0], Intake [-40,0,15], DeepTreatment [20,0,-15], Chemical [-20,0,-15].
 */
export const EQUIPMENT_PATROL_ANCHORS: Record<string, PatrolAnchor> = {
  // MainProcessSection
  'tk-ph1': { cx: -40, cz: 0, hx: 3, hz: 3 },
  'tk-fenton': { cx: -34, cz: 0, hx: 3, hz: 3 },
  'tk-ph2': { cx: -28, cz: 0, hx: 3, hz: 3 },
  'tk-coagulation': { cx: -22, cz: 0, hx: 3, hz: 3 },
  'tk-flocculation': { cx: -16, cz: 0, hx: 3, hz: 3 },
  'tk-clarifier': { cx: 2, cz: 0, hx: 4, hz: 4 },
  'tk-ph3': { cx: 11, cz: 0, hx: 3, hz: 3 },
  'tk-intermediate': { cx: 19, cz: 0, hx: 3, hz: 3 },
  'p-sludge-clar-1': { cx: 1, cz: 5, hx: 1.15, hz: 1.15 },
  'p-sludge-clar-2': { cx: 3, cz: 5, hx: 1.15, hz: 1.15 },
  // IntakeSection
  'tk-collection-1': { cx: -40, cz: 15, hx: 3, hz: 3 },
  'tk-collection-2': { cx: -34, cz: 15, hx: 3, hz: 3 },
  // World Z = INTAKE_GROUP.z + LIFT_PUMP_LOCAL_Z = 15 + (-4.85) = 10.15
  'p-lift-1': { cx: -43, cz: 10.15, hx: 1.15, hz: 1.15 },
  // DeepTreatmentSection
  'tk-daf': { cx: 8, cz: -15, hx: 4, hz: 4 },
  'tk-mixing': { cx: 18, cz: -15, hx: 3, hz: 3 },
  'tk-drainage': { cx: 27, cz: -15, hx: 3, hz: 3 },
  'tk-outfall': { cx: 40, cz: -15, hx: 2, hz: 1.5 },
  'p-drain-1': { cx: 32, cz: -17, hx: 1.15, hz: 1.15 },
  'p-drain-2': { cx: 32, cz: -13, hx: 1.15, hz: 1.15 },
  'p-inter-1': { cx: 18, cz: -8, hx: 1.15, hz: 1.15 },
  'p-inter-2': { cx: 16, cz: -8, hx: 1.15, hz: 1.15 },
  // SludgeSection (group [15,0,15])
  'tk-sludge': { cx: 5, cz: 15, hx: 4, hz: 4 },
  'sp-1': { cx: 19, cz: 15, hx: 2, hz: 1.5, focusY: 1.0 },
  'p-sludge-out-1': { cx: 11, cz: 13, hx: 1.15, hz: 1.15 },
  'p-sludge-out-2': { cx: 11, cz: 17, hx: 1.15, hz: 1.15 },
  'p-sludge-daf-1': { cx: 6.8, cz: -20.55, hx: 1.15, hz: 1.15 },
  'p-sludge-daf-2': { cx: 9.2, cz: -20.55, hx: 1.15, hz: 1.15 },
  'p-pac-1': { cx: -35, cz: -15, hx: 1.15, hz: 1.15 },
  'p-daf-coag-1': { cx: -20, cz: -15, hx: 1.15, hz: 1.15 },
  // ChemicalDosingSection
  'tk-ph-pac': { cx: -35, cz: -15, hx: 0.8, hz: 0.8, focusY: 1.7 },
  'tk-ph-cacl2': { cx: -30, cz: -15, hx: 0.8, hz: 0.8, focusY: 1.7 },
  'tk-ph-pam': { cx: -25, cz: -15, hx: 0.8, hz: 0.8, focusY: 1.7 },
  'tk-daf-pac': { cx: -20, cz: -15, hx: 0.8, hz: 0.8, focusY: 1.7 },
  'tk-daf-pam': { cx: -15, cz: -15, hx: 0.8, hz: 0.8, focusY: 1.7 },
  'tk-screw-pam': { cx: -10, cz: -15, hx: 0.8, hz: 0.8, focusY: 1.7 },
};

/** Ordered inspection stops per patrol zone. */
export const INTAKE_STOP_IDS = ['p-lift-1', 'tk-collection-2', 'tk-collection-1'] as const;
export const MAIN_PROCESS_STOP_IDS = [
  'tk-ph1',
  'tk-fenton',
  'tk-ph2',
  'tk-coagulation',
  'tk-flocculation',
  'tk-clarifier',
  'tk-ph3',
  'tk-intermediate',
] as const;
export const DEEP_TREATMENT_STOP_IDS = [
  'tk-daf',
  'tk-mixing',
  'tk-drainage',
  'tk-outfall',
  'p-drain-1',
  'p-drain-2',
  'p-inter-1',
  'p-inter-2',
] as const;
export const CHEMICAL_STOP_IDS = [
  'tk-ph-pac',
  'tk-ph-cacl2',
  'tk-ph-pam',
  'tk-daf-pac',
  'tk-daf-pam',
  'tk-screw-pam',
] as const;
export const SLUDGE_STOP_IDS = ['tk-sludge', 'p-sludge-out-1', 'sp-1', 'p-sludge-out-2'] as const;
export const DAF_SLUDGE_STOP_IDS = ['p-sludge-daf-1', 'p-sludge-daf-2'] as const;

/** @deprecated alias */
export const MAIN_PROCESS_STOP_IDS_LEGACY = MAIN_PROCESS_STOP_IDS;

function wp(x: number, z: number): [number, number, number] {
  return [x, getPatrolSurfaceY(x, z), z];
}

/** Stand on a south patrol lane, south of the anchor footprint (never at tank centre X). */
export function southLaneStand(
  anchor: PatrolAnchor,
  laneZ: number,
  xShift = 0,
): [number, number, number] {
  const x = anchor.cx + xShift;
  const z = Math.min(laneZ, anchor.cz - anchor.hz - 1.25);
  return wp(x, z);
}

/** Stand on a north patrol lane, north of the anchor footprint. */
export function northLaneStand(
  anchor: PatrolAnchor,
  laneZ: number,
  xShift = 0,
): [number, number, number] {
  const x = anchor.cx + xShift;
  return wp(x, laneZ);
}

function buildSouthLanePatrol(
  stopIds: readonly string[],
  laneZ: number,
  xShifts: Partial<Record<string, number>> = {},
): PatrolDefinition {
  const targets = [...stopIds];
  const path = targets.map((id) => {
    const anchor = EQUIPMENT_PATROL_ANCHORS[id];
    return southLaneStand(anchor, laneZ, xShifts[id] ?? 0);
  });
  return { path, targets };
}

function buildIntakePatrol(): PatrolDefinition {
  const targets = [...INTAKE_STOP_IDS];
  const path = targets.map((id) => {
    const anchor = EQUIPMENT_PATROL_ANCHORS[id];
    return wp(anchor.cx, ROAD_MAIN_Z);
  });
  return { path, targets };
}

function buildMainProcessPatrol(): PatrolDefinition {
  return buildSouthLanePatrol(MAIN_PROCESS_STOP_IDS, ROAD_SOUTH_PROCESS_Z, {
    'tk-clarifier': 3.2,
  });
}

function buildDeepTreatmentPatrol(): PatrolDefinition {
  const targets = [...DEEP_TREATMENT_STOP_IDS];
  const path: [number, number, number][] = [
    // tk-daf sits on its own -9.0 lane (shell too wide for the -10 lane);
    // all other deep-treatment tanks stay on the -10 lane.
    northLaneStand(EQUIPMENT_PATROL_ANCHORS['tk-daf'], ROAD_DEEP_NORTH_Z_DAF),
    // Detour corner: step clear of tk-daf's east shell edge (x > 8 + 4 + 0.85 + 0.5 = 13.35)
    // at the -9.0 lane, then drop to the -10 lane. A direct hop from (8, -9.0) to (18, -10)
    // would graze p-inter-1 / p-inter-2 shells (cx=18/16, cz=-8) on the X leg at z=-9.0.
    wp(14, ROAD_DEEP_NORTH_Z_DAF),
    wp(14, ROAD_DEEP_NORTH_Z),
    northLaneStand(EQUIPMENT_PATROL_ANCHORS['tk-mixing'], ROAD_DEEP_NORTH_Z),
    northLaneStand(EQUIPMENT_PATROL_ANCHORS['tk-drainage'], ROAD_DEEP_NORTH_Z),
    northLaneStand(EQUIPMENT_PATROL_ANCHORS['tk-outfall'], ROAD_DEEP_NORTH_Z),
    // p-inter pumps (cz=-8) need stands south of their shell (z ≤ -9.65); -10 is on the
    // shared deep-treatment lane and clears both pumps. The old z=-8.5 sat 0.5m inside them.
    wp(EQUIPMENT_PATROL_ANCHORS['p-inter-1'].cx, ROAD_DEEP_NORTH_Z),
    wp(EQUIPMENT_PATROL_ANCHORS['p-inter-2'].cx, ROAD_DEEP_NORTH_Z),
    // Detour: the vertical drop to the south road happens at x=35 (open ground between
    // p-inter-2 and the p-drain pumps), not at x=32 (p-drain-1/2 cx) — otherwise the Z leg
    // slices through p-drain-1 (cz=-17) on the way down.
    wp(35, ROAD_DEEP_NORTH_Z),
    wp(35, ROAD_SOUTH_DEEP_Z),
    wp(EQUIPMENT_PATROL_ANCHORS['p-drain-1'].cx, ROAD_SOUTH_DEEP_Z),
    wp(EQUIPMENT_PATROL_ANCHORS['p-drain-2'].cx, ROAD_SOUTH_DEEP_Z),
  ];
  return { path, targets };
}

function buildChemicalPatrol(): PatrolDefinition {
  const targets = [...CHEMICAL_STOP_IDS, 'p-pac-1', 'p-daf-coag-1'];
  const path: [number, number, number][] = [
    ...CHEMICAL_STOP_IDS.map((id) => wp(EQUIPMENT_PATROL_ANCHORS[id].cx, ROAD_CHEM_FRONT_Z)),
    // Detour around the chemical dosing building (cx=-20, hx=17 → x∈[-37,-3]):
    // dropping from z=-11 to z=-19 at x=-35 (p-pac-1 cx) would slice through the
    // building interior. Step out to x=-38 (west of the building) before descending.
    wp(-38, ROAD_CHEM_FRONT_Z),
    wp(-38, ROAD_CHEM_BACK_Z),
    wp(EQUIPMENT_PATROL_ANCHORS['p-pac-1'].cx, ROAD_CHEM_BACK_Z),
    wp(EQUIPMENT_PATROL_ANCHORS['p-daf-coag-1'].cx, ROAD_CHEM_BACK_Z),
  ];
  return { path, targets };
}

function buildSludgePatrol(): PatrolDefinition {
  const targets = [...SLUDGE_STOP_IDS];
  const path = targets.map((id) => wp(EQUIPMENT_PATROL_ANCHORS[id].cx, ROAD_SLUDGE_NORTH_Z));
  return { path, targets };
}

function buildDafSludgePatrol(): PatrolDefinition {
  const targets = [...DAF_SLUDGE_STOP_IDS];
  const path = targets.map((id) => wp(EQUIPMENT_PATROL_ANCHORS[id].cx, ROAD_DAF_SLUDGE_Z));
  return { path, targets };
}

/** Active patrol routes — one loop per process zone. */
export const PATROL_DEFINITIONS = {
  intake: buildIntakePatrol(),
  mainProcess: buildMainProcessPatrol(),
  deepTreatment: buildDeepTreatmentPatrol(),
  chemicalLab: buildChemicalPatrol(),
  sludge: buildSludgePatrol(),
  dafSludge: buildDafSludgePatrol(),
} as const satisfies Record<string, PatrolDefinition>;

export type PatrolRouteKey = keyof typeof PATROL_DEFINITIONS;

export const PATROL_ROUTES = {
  intake: PATROL_DEFINITIONS.intake.path,
  mainProcess: PATROL_DEFINITIONS.mainProcess.path,
  deepTreatment: PATROL_DEFINITIONS.deepTreatment.path,
  chemicalLab: PATROL_DEFINITIONS.chemicalLab.path,
  sludge: PATROL_DEFINITIONS.sludge.path,
  dafSludge: PATROL_DEFINITIONS.dafSludge.path,
} as const;

export type PatrolWorkerVariant = 'clipboard' | 'tablet' | 'scanning' | 'probe';

export interface PatrolWorkerDefinition {
  id: string;
  label: string;
  variant: PatrolWorkerVariant;
  routeKey: PatrolRouteKey;
  speed: number;
  pauseTime: number;
  restSlot: number;
  officeRestTime: number;
  patrolPath: [number, number, number][];
  patrolTargets: string[];
  officeToPath: [number, number, number][];
  officeReturnPath: [number, number, number][];
}

const PATROL_WORKER_CONFIGS = [
  {
    id: 'w-intake',
    label: '进水巡检员',
    variant: 'clipboard' as const,
    routeKey: 'intake' as const,
    speed: 0.85,
    pauseTime: 5.0,
    restSlot: 0,
    officeRestTime: 18,
  },
  {
    id: 'w-main',
    label: '主工艺主管',
    variant: 'tablet' as const,
    routeKey: 'mainProcess' as const,
    speed: 1.0,
    pauseTime: 6.0,
    restSlot: 1,
    officeRestTime: 20,
  },
  {
    id: 'w-deep',
    label: '深度处理工程师',
    variant: 'scanning' as const,
    routeKey: 'deepTreatment' as const,
    speed: 0.9,
    pauseTime: 6.5,
    restSlot: 2,
    officeRestTime: 18,
  },
  {
    id: 'w-chem',
    label: '化验分析员',
    variant: 'probe' as const,
    routeKey: 'chemicalLab' as const,
    speed: 0.85,
    pauseTime: 7.0,
    restSlot: 3,
    officeRestTime: 22,
  },
  {
    id: 'w-sludge',
    label: '污泥脱水班长',
    variant: 'tablet' as const,
    routeKey: 'sludge' as const,
    speed: 0.9,
    pauseTime: 6.0,
    restSlot: 4,
    officeRestTime: 18,
  },
  {
    id: 'w-daf-sludge',
    label: '设备维保员',
    variant: 'scanning' as const,
    routeKey: 'dafSludge' as const,
    speed: 0.95,
    pauseTime: 5.5,
    restSlot: 5,
    officeRestTime: 16,
  },
] as const;

function buildPatrolWorker(config: (typeof PATROL_WORKER_CONFIGS)[number]): PatrolWorkerDefinition {
  const def = PATROL_DEFINITIONS[config.routeKey];
  const last = def.path[def.path.length - 1];
  const start = def.path[0];
  const { toOffice, toPatrolStart } = buildOfficeRoundTrip(
    [last[0], last[2]],
    [start[0], start[2]],
    config.restSlot,
    ROAD_MAIN_Z,
  );
  return {
    ...config,
    patrolPath: [...def.path],
    patrolTargets: [...def.targets],
    officeToPath: toOffice.slice(1).map(([x, z]) => wp(x, z)),
    officeReturnPath: toPatrolStart.slice(1).map(([x, z]) => wp(x, z)),
  };
}

/** World-space focal points used to orient workers toward equipment at each stop. */
export const PATROL_EQUIPMENT_FOCUS: Record<string, [number, number, number]> = Object.fromEntries(
  Object.entries(EQUIPMENT_PATROL_ANCHORS).map(([id, a]) => [id, [a.cx, a.focusY ?? 0.5, a.cz]]),
);

export function getPatrolFacingYaw(
  equipmentId: string,
  workerX: number,
  workerZ: number,
): number | null {
  const focus = PATROL_EQUIPMENT_FOCUS[equipmentId];
  if (!focus) return null;
  return Math.atan2(focus[0] - workerX, focus[2] - workerZ);
}

/** Six site workers — each completes one zone loop, rests at the duty office, then resumes. */
export const PATROL_WORKER_ROSTER: PatrolWorkerDefinition[] =
  PATROL_WORKER_CONFIGS.map(buildPatrolWorker);

/** Tank / basin AABBs (world space, xz half-extents) — derived from equipment anchors. */
export const PROCESS_BASIN_AABBS: { cx: number; cz: number; hx: number; hz: number }[] = [
  'tk-collection-1',
  'tk-collection-2',
  'tk-ph1',
  'tk-fenton',
  'tk-ph2',
  'tk-coagulation',
  'tk-flocculation',
  'tk-clarifier',
  'tk-ph3',
  'tk-intermediate',
  'tk-daf',
  'tk-mixing',
  'tk-drainage',
  'tk-outfall',
  'tk-sludge',
].map((id) => {
  const a = EQUIPMENT_PATROL_ANCHORS[id];
  return { cx: a.cx, cz: a.cz, hx: a.hx, hz: a.hz };
});

/** Expanded tank shells (walls + railings + body clearance) — blocks Worker3D movement only. */
export const TANK_PATROL_SHELL_AABBS: { cx: number; cz: number; hx: number; hz: number }[] =
  PROCESS_BASIN_AABBS.map((b) => ({
    cx: b.cx,
    cz: b.cz,
    hx: b.hx + 0.85,
    hz: b.hz + 1.05,
  }));

/** Enclosed building volumes — patrol roads along the perimeter remain outside these boxes. */
export const BUILDING_INTERIOR_AABBS: { cx: number; cz: number; hx: number; hz: number }[] = [
  { cx: -20, cz: -15, hx: 17, hz: 2.8 },
];

/** Pump / skid footprints (world xz) — patrol segments must not cut through these volumes. */
export const PUMP_OBSTACLE_AABBS: { cx: number; cz: number; hx: number; hz: number }[] = [
  'p-drain-1',
  'p-drain-2',
  'p-inter-1',
  'p-inter-2',
  'p-sludge-clar-1',
  'p-sludge-clar-2',
  'p-lift-1',
  'p-sludge-out-1',
  'p-sludge-out-2',
  'p-sludge-daf-1',
  'p-sludge-daf-2',
  'p-pac-1',
  'p-daf-coag-1',
].map((id) => {
  const a = EQUIPMENT_PATROL_ANCHORS[id];
  return { cx: a.cx, cz: a.cz, hx: a.hx, hz: a.hz };
});

/** Combined obstacles used by Worker3D while moving between axis-aligned waypoints. */
export const WORKER_OBSTACLE_AABBS = [
  ...TANK_PATROL_SHELL_AABBS,
  ...BUILDING_INTERIOR_AABBS,
  ...PUMP_OBSTACLE_AABBS,
];

type Aabb = { cx: number; cz: number; hx: number; hz: number };

/** True when a worker body footprint at (x,z) overlaps a blocked volume. */
export function isInsideWorkerObstacle(
  x: number,
  z: number,
  aabbs: Aabb[] = WORKER_OBSTACLE_AABBS,
  margin: number = 0.5,
): boolean {
  for (const a of aabbs) {
    if (Math.abs(x - a.cx) <= a.hx + margin && Math.abs(z - a.cz) <= a.hz + margin) {
      return true;
    }
  }
  return false;
}

/** Sample an axis-aligned segment for pool / pump / building penetration. */
export function segmentCrossesWorkerObstacle(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  aabbs: Aabb[] = WORKER_OBSTACLE_AABBS,
  margin: number = 0.5,
): boolean {
  const span = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  const steps = Math.max(2, Math.ceil(span / 0.35));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sx = x0 + (x1 - x0) * t;
    const sz = z0 + (z1 - z0) * t;
    if (isInsideWorkerObstacle(sx, sz, aabbs, margin)) return true;
  }
  return false;
}

/**
 * Pick a legal axis-aligned micro-step toward a waypoint. Returns `moved:false`
 * when both axes would enter an obstacle — prevents tunneling through pumps.
 */
export function planWorkerStep(
  x: number,
  z: number,
  dx: number,
  dz: number,
  aabbs: Aabb[] = WORKER_OBSTACLE_AABBS,
): { x: number; z: number; moved: boolean } {
  const candidates: [number, number][] = [];
  if (Math.abs(dx) > 1e-6) candidates.push([x + dx, z]);
  if (Math.abs(dz) > 1e-6) candidates.push([x, z + dz]);

  for (const [nx, nz] of candidates) {
    if (segmentCrossesWorkerObstacle(x, z, nx, nz, aabbs, 0.5)) continue;
    const resolved = resolveWorkerObstacles(nx, nz, aabbs, 0.65);
    if (isInsideWorkerObstacle(resolved.x, resolved.z, aabbs, 0.35)) continue;
    if (segmentCrossesWorkerObstacle(x, z, resolved.x, resolved.z, aabbs, 0.35)) continue;
    return { x: resolved.x, z: resolved.z, moved: true };
  }
  return { x, z, moved: false };
}

/** Simple AABB collision response: push (x,z) outside every obstacle by `margin` meters. */
export function resolveWorkerObstacles(
  x: number,
  z: number,
  aabbs: Aabb[] = PROCESS_BASIN_AABBS,
  margin: number = 0.8,
): { x: number; z: number; collided: boolean } {
  let cx = x;
  let cz = z;
  let collided = false;
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const a of aabbs) {
      const minX = a.cx - a.hx - margin;
      const maxX = a.cx + a.hx + margin;
      const minZ = a.cz - a.hz - margin;
      const maxZ = a.cz + a.hz + margin;
      if (cx >= minX && cx <= maxX && cz >= minZ && cz <= maxZ) {
        collided = true;
        moved = true;
        const overlapX = Math.min(cx - minX, maxX - cx);
        const overlapZ = Math.min(cz - minZ, maxZ - cz);
        if (overlapX < overlapZ) {
          cx = cx < a.cx ? minX : maxX;
        } else {
          cz = cz < a.cz ? minZ : maxZ;
        }
      }
    }
    if (!moved) break;
  }
  return { x: cx, z: cz, collided };
}

/** Snap a desired patrol stand outside expanded tank shells (never inside the pool wall). */
export function resolvePatrolStandPosition(
  x: number,
  z: number,
  aabbs: Aabb[] = WORKER_OBSTACLE_AABBS,
  margin: number = WORKER_BODY_RADIUS,
): { x: number; z: number } {
  if (!isInsideWorkerObstacle(x, z, aabbs, margin)) {
    return { x, z };
  }
  const resolved = resolveWorkerObstacles(x, z, aabbs, margin + 0.2);
  if (!isInsideWorkerObstacle(resolved.x, resolved.z, aabbs, margin * 0.9)) {
    return { x: resolved.x, z: resolved.z };
  }
  for (let push = 0.25; push <= 2.5; push += 0.25) {
    if (!isInsideWorkerObstacle(x, z - push, aabbs, margin * 0.9)) {
      return { x, z: z - push };
    }
  }
  return { x: resolved.x, z: resolved.z };
}
