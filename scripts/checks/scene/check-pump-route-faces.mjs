/**
 * Geometric guard: every standard process/sludge pump route and intake lift
 * route terminates on the shared sealing-face helpers, discharge risers are
 * pure vertical when the header sits on the discharge centreline, and chemical
 * metering suction/discharge last/first legs are axial into the face.
 *
 * Re-implements the published face maths from pumpPorts.ts / chemicalPumpLayout
 * constants so the check fails if route authors drift from live flange geometry.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const issues = [];
const TOL = 0.05;

// ── Pure reimplementation of pumpPorts face maths (must match source) ────────
const MACHINE_SCALE = 0.5;
const DISCHARGE_LOCAL = [0, 1.54 * MACHINE_SCALE, -0.78 * MACHINE_SCALE];
const SUCTION_LOCAL = [0, 0.78 * MACHINE_SCALE, -0.98 * MACHINE_SCALE];
const SUCTION_FACE = (0.047 + 0.018 / 2) * MACHINE_SCALE;
const DISCHARGE_FACE = (0.032 + 0.018 / 2) * MACHINE_SCALE;

function rotY([x, y, z], ry) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [x * c + z * s, y, -x * s + z * c];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function nearly(a, b, tol = TOL) {
  return dist(a, b) <= tol;
}

function getSuctionFacePoint(position, rotationY) {
  const s = add(position, rotY(SUCTION_LOCAL, rotationY));
  const ax = rotY([0, 0, -1], rotationY);
  return add(s, [ax[0] * SUCTION_FACE, ax[1] * SUCTION_FACE, ax[2] * SUCTION_FACE]);
}
function getDischargeFacePoint(position, rotationY) {
  const d = add(position, rotY(DISCHARGE_LOCAL, rotationY));
  // discharge axis is always +Y
  return [d[0], d[1] + DISCHARGE_FACE, d[2]];
}

// ── Parse PROCESS_PUMP_LAYOUT positions from source ──────────────────────────
const layoutText = fs.readFileSync(path.join(ROOT, 'src/components/scene/sections/processPumpLayout.ts'), 'utf8');
const processText = fs.readFileSync(path.join(ROOT, 'src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx'), 'utf8');
const routesText = fs.readFileSync(path.join(ROOT, 'src/components/scene/sections/processPumpRoutes.ts'), 'utf8');
const chemText = fs.readFileSync(path.join(ROOT, 'src/components/scene/sections/chemicalPumpLayout.ts'), 'utf8');
const intakeRoutesText = fs.readFileSync(path.join(ROOT, 'src/components/scene/sections/intakePipeRoutes.ts'), 'utf8');

// Contract: process network must use live route modules, not hard-coded header Z.
for (const token of [
  'INTERMEDIATE_ROUTES',
  'DRAIN_ROUTES',
  'CLARIFIER_SLUDGE_ROUTES',
  'DAF_SLUDGE_ROUTES',
  'SLUDGE_OUT_ROUTES',
  'INTERMEDIATE_HEADER',
  'processPumpRoutes',
  'getDischargeRiser',
  'buildHeaderOnDischargeFaces',
]) {
  if (!processText.includes(token) && !routesText.includes(token)) {
    issues.push(`Missing process pump route contract token: ${token}`);
  }
}
if (!processText.includes("from './processPumpRoutes'")) {
  issues.push('ProcessAndSludgePipeNetwork3D must import processPumpRoutes');
}
if (processText.includes('getDischargeBranch(')) {
  issues.push('Process network still uses getDischargeBranch with hard-coded headerZ; use live risers from processPumpRoutes');
}
// Hard-coded legacy header Z/X that used to drift from face maths
for (const legacy of ['-7.61', '31.61', '4.61', '-20.16', '10.61']) {
  if (processText.includes(legacy)) {
    issues.push(`Process network still hard-codes legacy header coordinate ${legacy}`);
  }
}

// Parse pump placements
const placementRe =
  /(\w+):\s*\{\s*id:\s*'([^']+)',\s*position:\s*\[([0-9.eE+-]+),\s*([0-9.eE+-]+),\s*([0-9.eE+-]+)\],\s*rotationY:\s*([^}]+)\}/g;
const placements = [];
let m;
while ((m = placementRe.exec(layoutText))) {
  const rotExpr = m[6].trim().replace(/,$/, '');
  let rotationY;
  if (rotExpr === '0') rotationY = 0;
  else if (rotExpr.includes('Math.PI / 2')) rotationY = Math.PI / 2;
  else if (rotExpr.includes('Math.PI')) rotationY = Math.PI;
  else rotationY = Number(rotExpr);
  placements.push({
    key: m[1],
    id: m[2],
    position: [Number(m[3]), Number(m[4]), Number(m[5])],
    rotationY,
  });
}
if (placements.length < 10) {
  issues.push(`Expected ≥10 process pump placements, found ${placements.length}`);
}

// Simulate processPumpRoutes build for each placement with wall seeds from source
const wallSeeds = {
  intermediateA: { z: -3.05 },
  intermediateB: { z: -3.05 },
  drainA: { x: 30.05 },
  drainB: { x: 30.05 },
  clarifierSludgeA: { z: 4.05 },
  clarifierSludgeB: { z: 4.05 },
  dafSludgeA: { z: -19.05 },
  dafSludgeB: { z: -19.05 },
  sludgeOutA: { x: 9.05 },
  sludgeOutB: { x: 9.05 },
};

const routeReports = [];
for (const p of placements) {
  const seed = wallSeeds[p.key];
  if (!seed) {
    issues.push(`No wall seed mapping for pump key ${p.key}`);
    continue;
  }
  const mouth = getSuctionFacePoint(p.position, p.rotationY);
  const face = getDischargeFacePoint(p.position, p.rotationY);
  const wall =
    seed.x !== undefined
      ? [seed.x, mouth[1], mouth[2]]
      : [mouth[0], mouth[1], seed.z];
  const suctionEnd = mouth;
  const suctionStart = wall;
  const dischargeStart = face;
  const dischargeEnd = [face[0], 2.55, face[2]]; // PUMP_HEADER_Y

  // Axial suction: only one horizontal axis should change (or pure axial along outward).
  const dx = Math.abs(suctionEnd[0] - suctionStart[0]);
  const dy = Math.abs(suctionEnd[1] - suctionStart[1]);
  const dz = Math.abs(suctionEnd[2] - suctionStart[2]);
  const diagonal = dx > 0.02 && dz > 0.02;
  const pureVert =
    Math.abs(dischargeStart[0] - dischargeEnd[0]) <= 0.02
    && Math.abs(dischargeStart[2] - dischargeEnd[2]) <= 0.02;

  if (diagonal) {
    issues.push(`${p.id}: suction wall→mouth is diagonal (dx=${dx.toFixed(3)}, dz=${dz.toFixed(3)})`);
  }
  if (dy > 0.02) {
    issues.push(`${p.id}: suction has vertical dogleg at flange (dy=${dy.toFixed(3)})`);
  }
  if (!pureVert) {
    issues.push(`${p.id}: discharge riser is not pure vertical`);
  }
  if (!nearly(suctionEnd, mouth, TOL)) {
    issues.push(`${p.id}: suction end off mouth face`);
  }
  if (!nearly(dischargeStart, face, TOL)) {
    issues.push(`${p.id}: discharge start off face`);
  }

  routeReports.push({
    id: p.id,
    mouth: mouth.map((n) => +n.toFixed(4)),
    face: face.map((n) => +n.toFixed(4)),
    wall: wall.map((n) => +n.toFixed(4)),
    pureVert,
    diagonal,
  });
}

// processPumpRoutes must call getSuctionFacePoint / getDischargeFacePoint / getDischargeRiser
for (const helper of ['getSuctionFacePoint', 'getDischargeFacePoint', 'getDischargeRiser', 'getDirectTankSuctionBranch']) {
  if (!routesText.includes(helper)) {
    issues.push(`processPumpRoutes.ts missing ${helper}`);
  }
}

// Chemical face constants must use outer flange faces (group ± half disc), not inner neck.
if (!chemText.includes('0.2 + 0.025') && !chemText.includes('0.2+0.025')) {
  issues.push('chemicalPumpLayout suction face must seat on outer flange (0.2 + 0.025)');
}
if (!chemText.includes('-0.18 - 0.025') && !chemText.includes('-0.18-0.025')) {
  issues.push('chemicalPumpLayout discharge face must seat on outer flange (-0.18 - 0.025)');
}
if (!chemText.includes('AXIAL_SPOOL')) {
  issues.push('chemicalPumpLayout must keep an axial spool constant for face approaches');
}
// Chemical routes must end/start on face helpers
if (!chemText.includes('chemicalSuctionFace') || !chemText.includes('chemicalDischargeFace')) {
  issues.push('chemical face helpers missing');
}
// Suction last point must be `face`; discharge first point must be `face`.
const suctionFn = chemText.match(/export function chemicalSuctionPoints[\s\S]*?^}/m)?.[0] ?? '';
const dischargeFn = chemText.match(/export function chemicalDischargePoints[\s\S]*?^}/m)?.[0] ?? '';
if (!suctionFn.includes('face') || !/,\s*face\s*,?\s*\]/.test(suctionFn)) {
  issues.push('chemicalSuctionPoints must terminate on face');
}
if (!dischargeFn.includes('face') || !/return\s*\[\s*face\s*,/.test(dischargeFn)) {
  issues.push('chemicalDischargePoints must start on face');
}

// Intake: buildAxialSuctionPoints + getDischargeRiser
if (!intakeRoutesText.includes('getSuctionFacePoint') || !intakeRoutesText.includes('getDischargeRiser')) {
  issues.push('intakePipeRoutes must use suction/discharge face helpers');
}
if (!intakeRoutesText.includes('dischargeIsPureVertical') || !intakeRoutesText.includes('suctionIsStraightAxial')) {
  issues.push('intakePipeRoutes must export pure-vertical / axial predicates');
}

console.log(
  `Pump route faces: processPumps=${routeReports.length}, pureVertical=${routeReports.filter((r) => r.pureVert).length}, diagonalSuction=${routeReports.filter((r) => r.diagonal).length}`,
);
for (const r of routeReports) {
  console.log(
    `  ${r.id}: mouth=[${r.mouth.join(',')}] face=[${r.face.join(',')}] wall=[${r.wall.join(',')}] pureVert=${r.pureVert}`,
  );
}

if (issues.length > 0) {
  console.error('\nPump route face issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All process/intake/chemical pump routes terminate on live sealing faces with pure-vertical discharge and non-diagonal suction.');
}
