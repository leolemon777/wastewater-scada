// Static patrol route checker.
//
// Verifies that every segment of every patrol loop AND every office round-trip
// path stays clear of the runtime obstacle set used by Worker3D. Mirrors the
// runtime model faithfully so that a passing check here matches what workers
// actually experience in the 3D scene:
//
//   - Obstacles: tank shells inflated by hx+0.85 / hz+1.05 (walls + railings),
//                building interiors, and pump footprints — plus the 0.5m
//                runtime avoidance margin that `segmentCrossesWorkerObstacle`
//                applies in patrolRoutes.ts.
//   - Trajectory: workers move "X first, then Z" between waypoints (see
//                Worker3D.tsx). Each leg is therefore checked as two axis-aligned
//                sub-segments, never as a diagonal.
//   - Office round-trip: re-derived from `buildOfficeRoundTrip` via the spine
//                constant so the checker catches regressions in the south-west
//                office approach too.

import fs from 'node:fs';
import path from 'node:path';

const PATROL_FILE = path.join(process.cwd(), 'src/components/3d/patrolRoutes.ts');
const OFFICE_FILE = path.join(process.cwd(), 'src/components/3d/patrolOfficeLayout.ts');
const CATALOG_FILE = path.join(process.cwd(), 'src/store/useScadaStore.ts');
const patrolText = fs.readFileSync(PATROL_FILE, 'utf8');
const officeText = fs.readFileSync(OFFICE_FILE, 'utf8');
const catalogText = fs.readFileSync(CATALOG_FILE, 'utf8');

const equipmentIds = new Set(
  [...catalogText.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]),
);

// --- Numeric consts from patrolRoutes.ts ---
const consts = {};
for (const m of patrolText.matchAll(/export const (\w+) = ([-\d.]+);/g)) {
  consts[m[1]] = Number(m[2]);
}
for (const m of officeText.matchAll(/export const (\w+) = ([-\d.]+);/g)) {
  consts[m[1]] = Number(m[2]);
}

const roadSurfaceY = consts.ROAD_SURFACE_Y ?? -0.036;
const PLATFORM_DECK_TOP_Y = consts.PLATFORM_DECK_TOP_Y ?? 0.5;

// --- Walkable corridors / platforms (must match patrolRoutes.ts) ---
const PATROL_WALK_CORRIDORS = [
  { minX: -56, maxX: 52, minZ: 6.75, maxZ: 9.85, surfaceY: roadSurfaceY },
  { minX: -40, maxX: 2, minZ: -10.35, maxZ: -8.05, surfaceY: roadSurfaceY },
  { minX: -48, maxX: 18, minZ: -24.8, maxZ: -22.0, surfaceY: roadSurfaceY },
  { minX: 26, maxX: 52, minZ: -24.8, maxZ: -22.0, surfaceY: roadSurfaceY },
  { minX: 27.3, maxX: 30.7, minZ: -26, maxZ: 10, surfaceY: roadSurfaceY },
  { minX: 30.3, maxX: 31.7, minZ: -26, maxZ: -9, surfaceY: roadSurfaceY },
  { minX: 33.3, maxX: 34.7, minZ: -26, maxZ: -9, surfaceY: roadSurfaceY },
  { minX: -53.5, maxX: -26.5, minZ: 21.0, maxZ: 25.8, surfaceY: roadSurfaceY },
  { minX: 4, maxX: 30, minZ: 19.4, maxZ: 24.6, surfaceY: roadSurfaceY },
  { minX: 30, maxX: 50, minZ: -18.0, maxZ: -11.6, surfaceY: roadSurfaceY },
  { minX: -39.5, maxX: -36.5, minZ: -20.5, maxZ: -9.5, surfaceY: roadSurfaceY },
  {
    minX: consts.PATROL_OFFICE_APPROACH_BOUNDS_MIN_X ?? -62,
    maxX: consts.PATROL_OFFICE_APPROACH_BOUNDS_MAX_X ?? -48,
    minZ: consts.PATROL_OFFICE_APPROACH_BOUNDS_MIN_Z ?? -24.8,
    maxZ: consts.PATROL_OFFICE_APPROACH_BOUNDS_MAX_Z ?? -22.0,
    surfaceY: consts.PATROL_OFFICE_APPROACH_BOUNDS_TOP_Y ?? -0.036,
  },
];

const WORKER_PLATFORMS = [
  { minX: -52, maxX: -28, minZ: 9, maxZ: 21, topY: PLATFORM_DECK_TOP_Y },
  { minX: -45, maxX: 25, minZ: -6, maxZ: 6, topY: PLATFORM_DECK_TOP_Y },
  { minX: -3, maxX: 43, minZ: -21, maxZ: -9, topY: PLATFORM_DECK_TOP_Y },
  { minX: -39, maxX: -1, minZ: -19, maxZ: -11, topY: PLATFORM_DECK_TOP_Y },
  { minX: 0, maxX: 30, minZ: 9, maxZ: 21, topY: PLATFORM_DECK_TOP_Y },
  {
    minX: consts.PATROL_OFFICE_WALK_BOUNDS_MIN_X ?? -61,
    maxX: consts.PATROL_OFFICE_WALK_BOUNDS_MAX_X ?? -51,
    minZ: consts.PATROL_OFFICE_WALK_BOUNDS_MIN_Z ?? -24.2,
    maxZ: consts.PATROL_OFFICE_WALK_BOUNDS_MAX_Z ?? -18.8,
    topY: consts.PATROL_OFFICE_WALK_BOUNDS_TOP_Y ?? 0.06,
  },
];

function getPatrolSurfaceY(x, z) {
  for (const p of WORKER_PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return p.topY;
  }
  for (const c of PATROL_WALK_CORRIDORS) {
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return c.surfaceY;
  }
  return roadSurfaceY;
}

// --- Equipment anchors ---
function parseAnchors(text) {
  const block = text.match(/export const EQUIPMENT_PATROL_ANCHORS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) return {};
  const anchors = {};
  for (const m of block[1].matchAll(
    /'([^']+)':\s*\{\s*cx:\s*([-\d.]+),\s*cz:\s*([-\d.]+),\s*hx:\s*([-\d.]+),\s*hz:\s*([-\d.]+)/g,
  )) {
    anchors[m[1]] = { cx: Number(m[2]), cz: Number(m[3]), hx: Number(m[4]), hz: Number(m[5]) };
  }
  return anchors;
}

function parseStopIds(text, constName) {
  const block = text.match(new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const;`));
  if (!block) return [];
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function parseAabbs(block) {
  if (!block) return [];
  return [...block.matchAll(/\{\s*cx:\s*([-\d.]+),\s*cz:\s*([-\d.]+),\s*hx:\s*([-\d.]+),\s*hz:\s*([-\d.]+)\s*\}/g)].map(
    (m) => ({ cx: Number(m[1]), cz: Number(m[2]), hx: Number(m[3]), hz: Number(m[4]) }),
  );
}

// Parse a string-ID list used by `.map((id) => anchors[id])` builders (PROCESS_BASIN_AABBS,
// PUMP_OBSTACLE_AABBS) and resolve to anchor-derived AABBs — mirrors how patrolRoutes.ts
// constructs these at runtime.
function parseIdDerivedAabbs(text, constName, anchors) {
  const block = text.match(new RegExp(`export const ${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\]\\.map`));
  if (!block) return [];
  const ids = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return ids
    .map((id) => anchors[id])
    .filter(Boolean)
    .map((a) => ({ cx: a.cx, cz: a.cz, hx: a.hx, hz: a.hz, tag: 'basin' }));
}

const anchors = parseAnchors(patrolText);
const basins = parseIdDerivedAabbs(patrolText, 'PROCESS_BASIN_AABBS', anchors);
const buildingInteriors = parseAabbs(
  patrolText.match(/export const BUILDING_INTERIOR_AABBS[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1],
);
const pumpObstacles = parseIdDerivedAabbs(patrolText, 'PUMP_OBSTACLE_AABBS', anchors);

// --- Runtime obstacle set (must match patrolRoutes.ts WORKER_OBSTACLE_AABBS) ---
// Tanks are inflated by hx+0.85 / hz+1.05 (TANK_PATROL_SHELL_AABBS); pumps and
// buildings are used as-is. The 0.5m margin below mirrors segmentCrossesWorkerObstacle's
// default `margin` parameter — it is applied during collision checks, not baked into the AABBs.
const TANK_SHELL_MARGIN_X = 0.85;
const TANK_SHELL_MARGIN_Z = 1.05;
const RUNTIME_MARGIN = 0.5;

const tankShells = basins.map((b) => ({
  cx: b.cx, cz: b.cz, hx: b.hx + TANK_SHELL_MARGIN_X, hz: b.hz + TANK_SHELL_MARGIN_Z,
  tag: 'tank-shell',
}));
const buildings = buildingInteriors.map((b) => ({ ...b, tag: 'building' }));
const pumps = pumpObstacles.map((b) => ({ ...b, tag: 'pump' }));
const OBSTACLES = [...tankShells, ...buildings, ...pumps];

// --- Runtime collision primitives (mirror patrolRoutes.ts) ---
function isInside(x, z) {
  for (const a of OBSTACLES) {
    if (Math.abs(x - a.cx) <= a.hx + RUNTIME_MARGIN && Math.abs(z - a.cz) <= a.hz + RUNTIME_MARGIN) {
      return a;
    }
  }
  return null;
}

function segCross(x0, z0, x1, z1) {
  const span = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  const steps = Math.max(2, Math.ceil(span / 0.35));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sx = x0 + (x1 - x0) * t;
    const sz = z0 + (z1 - z0) * t;
    const hit = isInside(sx, sz);
    if (hit) return { hit, at: [sx, sz] };
  }
  return null;
}

// --- Lane stand helpers — mirror runtime patrolRoutes.ts exactly (NO min/max clamping) ---
function southLaneStandXZ(anchor, laneZ, xShift = 0) {
  const x = anchor.cx + xShift;
  const z = Math.min(laneZ, anchor.cz - anchor.hz - 1.25);
  return [x, z];
}
function northLaneStandXZ(anchor, laneZ, xShift = 0) {
  // Runtime northLaneStand returns wp(x, laneZ) — no clamping. Earlier versions of this
  // script added Math.max(laneZ, cz+hz+1.25) which produced diagonal false positives.
  return [anchor.cx + xShift, laneZ];
}

// --- Build patrol paths per route (mirrors patrolRoutes.ts build* functions) ---
const laneMain = consts.ROAD_MAIN_Z ?? 8.3;
const laneSouth = consts.ROAD_SOUTH_PROCESS_Z ?? -5.88;
const laneDeepN = consts.ROAD_DEEP_NORTH_Z ?? -10;
const laneDeepNDaf = consts.ROAD_DEEP_NORTH_Z_DAF ?? -9.0;
const laneDeepS = consts.ROAD_SOUTH_DEEP_Z ?? -23.4;
const laneChemF = consts.ROAD_CHEM_FRONT_Z ?? -11;
const laneChemB = consts.ROAD_CHEM_BACK_Z ?? -19;
const laneSludge = consts.ROAD_SLUDGE_NORTH_Z ?? 21.4;
const laneDafSludge = consts.ROAD_DAF_SLUDGE_Z ?? -22.8;

function buildIntakePath() {
  return parseStopIds(patrolText, 'INTAKE_STOP_IDS').map((id) => [anchors[id].cx, laneMain]);
}
function buildMainPath() {
  return parseStopIds(patrolText, 'MAIN_PROCESS_STOP_IDS').map((id) =>
    southLaneStandXZ(anchors[id], laneSouth, id === 'tk-clarifier' ? 3.2 : 0),
  );
}
function buildDeepPath() {
  const ids = parseStopIds(patrolText, 'DEEP_TREATMENT_STOP_IDS');
  return [
    northLaneStandXZ(anchors['tk-daf'], laneDeepNDaf),
    [14, laneDeepNDaf],
    [14, laneDeepN],
    northLaneStandXZ(anchors['tk-mixing'], laneDeepN),
    northLaneStandXZ(anchors['tk-drainage'], laneDeepN),
    northLaneStandXZ(anchors['tk-outfall'], laneDeepN),
    [anchors['p-inter-1'].cx, laneDeepN],
    [anchors['p-inter-2'].cx, laneDeepN],
    [35, laneDeepN],
    [35, laneDeepS],
    [anchors['p-drain-1'].cx, laneDeepS],
    [anchors['p-drain-2'].cx, laneDeepS],
  ];
}
function buildChemPath() {
  const front = parseStopIds(patrolText, 'CHEMICAL_STOP_IDS');
  return [
    ...front.map((id) => [anchors[id].cx, laneChemF]),
    [-38, laneChemF],
    [-38, laneChemB],
    [anchors['p-pac-1'].cx, laneChemB],
    [anchors['p-daf-coag-1'].cx, laneChemB],
  ];
}
function buildSludgePath() {
  return parseStopIds(patrolText, 'SLUDGE_STOP_IDS').map((id) => [anchors[id].cx, laneSludge]);
}
function buildDafSludgePath() {
  return parseStopIds(patrolText, 'DAF_SLUDGE_STOP_IDS').map((id) => [anchors[id].cx, laneDafSludge]);
}

// --- Office round-trip (mirrors patrolOfficeLayout.ts buildOfficeRoundTrip) ---
function axisAlignedPath(points) {
  if (points.length === 0) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const next = points[i];
    const sameX = Math.abs(prev[0] - next[0]) < 1e-3;
    const sameZ = Math.abs(prev[1] - next[1]) < 1e-3;
    if (!sameX && !sameZ) out.push([next[0], prev[1]]);
    const last = out[out.length - 1];
    if (Math.abs(last[0] - next[0]) > 1e-3 || Math.abs(last[1] - next[1]) > 1e-3) {
      out.push(next);
    }
  }
  return out;
}

const REST_SLOTS = [
  [-59.5, -20.2], [-56.5, -20.2], [-53.5, -20.2],
  [-59.5, -22.4], [-56.5, -22.4], [-53.5, -22.4],
];
const OFFICE_DOOR = [consts.PATROL_OFFICE_DOOR_X ?? -56, consts.PATROL_OFFICE_DOOR_Z ?? -24.15];
const OFFICE_APPROACH_Z = consts.PATROL_OFFICE_APPROACH_Z ?? -23.4;
const OFFICE_WEST_LANE_X = consts.PATROL_OFFICE_WEST_LANE_X ?? -48;
const SPINE_X = consts.PATROL_OFFICE_TRANSIT_SPINE_X;

function buildOfficeRoundTrip(lastStop, patrolStart, slot) {
  if (SPINE_X === undefined) {
    throw new Error('PATROL_OFFICE_TRANSIT_SPINE_X missing from patrolOfficeLayout.ts');
  }
  const rest = REST_SLOTS[slot] ?? REST_SLOTS[0];
  const toOffice = axisAlignedPath([
    lastStop,
    [SPINE_X, lastStop[1]],
    [SPINE_X, laneMain],
    [OFFICE_WEST_LANE_X, laneMain],
    [OFFICE_WEST_LANE_X, OFFICE_APPROACH_Z],
    [OFFICE_DOOR[0], OFFICE_APPROACH_Z],
    OFFICE_DOOR,
    rest,
  ]);
  const toPatrolStart = axisAlignedPath([
    rest,
    OFFICE_DOOR,
    [OFFICE_DOOR[0], OFFICE_APPROACH_Z],
    [OFFICE_WEST_LANE_X, OFFICE_APPROACH_Z],
    [OFFICE_WEST_LANE_X, laneMain],
    [SPINE_X, laneMain],
    [SPINE_X, patrolStart[1]],
    patrolStart,
  ]);
  return { toOffice, toPatrolStart };
}

// --- Check a path: every waypoint must be outside obstacles, every leg must be clear ---
function checkPath(label, path, issues) {
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    const hit = isInside(x, z);
    if (hit) {
      issues.push(`${label}: waypoint ${i} [${x.toFixed(2)}, ${z.toFixed(2)}] inside ${hit.tag} (${hit.cx},${hit.cz})`);
    }
    const sy = getPatrolSurfaceY(x, z);
    if (sy < -0.12 || sy > 0.55) {
      issues.push(`${label}: waypoint ${i} invalid surface Y ${sy} at [${x.toFixed(2)}, ${z.toFixed(2)}]`);
    }
  }
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1];
    const [x1, z1] = path[i];
    // Workers move X-first then Z (Worker3D.tsx). Check both axis-aligned sub-legs.
    const xLeg = segCross(x0, z0, x1, z0);
    const zLeg = segCross(x1, z0, x1, z1);
    if (xLeg) {
      issues.push(`${label}: seg ${i - 1}→${i} X-leg [${x0.toFixed(2)},${z0.toFixed(2)}]→[${x1.toFixed(2)},${z0.toFixed(2)}] crosses ${xLeg.hit.tag} (${xLeg.hit.cx},${xLeg.hit.cz})`);
    }
    if (zLeg) {
      issues.push(`${label}: seg ${i - 1}→${i} Z-leg [${x1.toFixed(2)},${z0.toFixed(2)}]→[${x1.toFixed(2)},${z1.toFixed(2)}] crosses ${zLeg.hit.tag} (${zLeg.hit.cz},${zLeg.hit.cz})`);
    }
  }
}

const routeNames = ['intake', 'mainProcess', 'deepTreatment', 'chemicalLab', 'sludge', 'dafSludge'];
const pathBuilders = {
  intake: buildIntakePath,
  mainProcess: buildMainPath,
  deepTreatment: buildDeepPath,
  chemicalLab: buildChemPath,
  sludge: buildSludgePath,
  dafSludge: buildDafSludgePath,
};
const stopIdMap = {
  intake: 'INTAKE_STOP_IDS',
  mainProcess: 'MAIN_PROCESS_STOP_IDS',
  deepTreatment: 'DEEP_TREATMENT_STOP_IDS',
  chemicalLab: 'CHEMICAL_STOP_IDS',
  sludge: 'SLUDGE_STOP_IDS',
  dafSludge: 'DAF_SLUDGE_STOP_IDS',
};
const slotByRoute = { intake: 0, mainProcess: 1, deepTreatment: 2, chemicalLab: 3, sludge: 4, dafSludge: 5 };

const issues = [];

for (const name of routeNames) {
  const targets = parseStopIds(patrolText, stopIdMap[name]);
  const path = pathBuilders[name]();

  checkPath(`[${name}]`, path, issues);

  // Office round-trip appended after the patrol loop, mirroring buildPatrolWorker.
  const last = path[path.length - 1];
  const start = path[0];
  const { toOffice, toPatrolStart } = buildOfficeRoundTrip(last, start, slotByRoute[name]);
  checkPath(`[${name}/office-to]`, toOffice, issues);
  checkPath(`[${name}/office-return]`, toPatrolStart, issues);

  // Validate targets against the equipment catalog.
  for (const id of targets) {
    if (!equipmentIds.has(id)) issues.push(`${name}: unknown target "${id}"`);
    if (!anchors[id]) issues.push(`${name}: missing anchor "${id}"`);
  }
}

// Worker roster sanity check.
const rosterMatch = patrolText.match(/PATROL_WORKER_CONFIGS = \[([\s\S]*?)\] as const;/);
if (!rosterMatch) {
  issues.push('Missing PATROL_WORKER_CONFIGS');
} else {
  const workerCount = [...rosterMatch[1].matchAll(/id:\s*'/g)].length;
  if (workerCount !== 6) {
    issues.push(`Expected 6 patrol workers, found ${workerCount}`);
  }
}

if (issues.length > 0) {
  console.error('Patrol route check failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Patrol routes OK: ${routeNames.join(', ')}; 6 workers + duty office; spine x=${SPINE_X}.`);
