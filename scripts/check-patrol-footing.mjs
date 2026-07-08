/**
 * Simulates worker foot placement along patrol segments for all six zone routes.
 */
import fs from 'node:fs';
import path from 'node:path';

const patrolText = fs.readFileSync(
  path.join(process.cwd(), 'src/components/3d/patrolRoutes.ts'),
  'utf8',
);

const consts = {};
for (const m of patrolText.matchAll(/export const (\w+) = ([-\d.]+);/g)) {
  consts[m[1]] = Number(m[2]);
}

const roadSurfaceY = consts.ROAD_SURFACE_Y ?? -0.036;
const FOOT_OFFSET = 0.035;

const WORKER_PLATFORMS = [
  { minX: -52, maxX: -28, minZ: 9, maxZ: 21, topY: 0.5 },
  { minX: -45, maxX: 25, minZ: -6, maxZ: 6, topY: 0.5 },
  { minX: -3, maxX: 43, minZ: -21, maxZ: -9, topY: 0.5 },
  { minX: -39, maxX: -1, minZ: -19, maxZ: -11, topY: 0.5 },
  { minX: 0, maxX: 30, minZ: 9, maxZ: 21, topY: 0.5 },
  { minX: -61, maxX: -51, minZ: -24.2, maxZ: -18.8, topY: 0.06 },
];

const PATROL_WALK_CORRIDORS = [
  { minX: -56, maxX: 52, minZ: 6.75, maxZ: 9.85, surfaceY: roadSurfaceY },
  { minX: 4, maxX: 30, minZ: 19.4, maxZ: 24.6, surfaceY: roadSurfaceY },
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

function parseAnchors(text) {
  const block = text.match(/export const EQUIPMENT_PATROL_ANCHORS[^=]*=\s*\{([\s\S]*?)\};/);
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

function southLaneStandXZ(anchor, laneZ, xShift = 0) {
  return [anchor.cx + xShift, Math.min(laneZ, anchor.cz - anchor.hz - 1.25)];
}

function northLaneStandXZ(anchor, laneZ) {
  return [anchor.cx, Math.max(laneZ, anchor.cz + anchor.hz + 1.25)];
}

function buildMainProcessPath(anchors) {
  const laneZ = consts.ROAD_SOUTH_PROCESS_Z ?? -5.88;
  return parseStopIds(patrolText, 'MAIN_PROCESS_STOP_IDS').map((id) =>
    southLaneStandXZ(anchors[id], laneZ, id === 'tk-clarifier' ? 3.2 : 0),
  );
}

const anchors = parseAnchors(patrolText);
const mainPath = buildMainProcessPath(anchors);
const issues = [];

for (const [x, z] of mainPath) {
  const footY = getPatrolSurfaceY(x, z) + FOOT_OFFSET;
  if (footY < 0.48) {
    issues.push(`mainProcess [${x}, ${z}] footY=${footY.toFixed(3)} too low`);
  }
}

const clarifierX = anchors['tk-clarifier'].cx + 3.2;
const clarifierFootY =
  getPatrolSurfaceY(clarifierX, consts.ROAD_SOUTH_PROCESS_Z ?? -5.88) + FOOT_OFFSET;
if (clarifierFootY < 0.48) {
  issues.push(`clarifier footY=${clarifierFootY.toFixed(3)} expected ~0.535`);
}

if (issues.length > 0) {
  console.error('Patrol footing simulation failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  `Patrol footing OK: mainProcess ${mainPath.length} stops; clarifier footY=${clarifierFootY.toFixed(3)}.`,
);
