import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const issues = [];

const pipe3d = read('src/components/scene/piping/Pipe3D.tsx');
const processNetwork = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const processRoutes = read('src/components/scene/sections/processPumpRoutes.ts');
const intakeLayout = read('src/components/scene/sections/intakeLayout.ts');
const intakeNetwork = read('src/components/scene/sections/IndustrialPipeNetwork3D.tsx');
const header = read('src/components/scene/piping/ConvergingHeader3D.tsx');
const reducer = read('src/components/scene/piping/PumpPipeReducer3D.tsx');

if (!/renderShell\?: boolean/.test(pipe3d) || !/renderShell && <mesh geometry=\{pipeGeometry\}/.test(pipe3d)) {
  issues.push('Pipe3D must support a shell-only structural header with flow overlays rendered separately');
}
if (Number(pipe3d.match(/const\s+EQUIPMENT_CONNECTION_OVERLAP\s*=\s*([0-9.]+)/)?.[1]) !== 0) {
  issues.push('Equipment route overlap must remain zero; penetration is authored explicitly at the endpoint');
}
if (Number(pipe3d.match(/const\s+JUNCTION_CONNECTION_OVERLAP\s*=\s*([0-9.]+)/)?.[1]) !== 0) {
  issues.push('Junction overlap must remain zero so branches cannot protrude through a header');
}
if (!/Only remove genuinely duplicate and collinear vertices/.test(pipe3d) || !/short orthogonal[\s\S]{0,240}diagonal shortcut/.test(pipe3d)) {
  issues.push('Pipe3D point cleanup must preserve authored short orthogonal legs');
}

if (!header.includes('points={[start, end]}') || !header.includes('animated={false}')) {
  issues.push('Converging headers must keep one continuous structural shell (flow animation lives on branch pipes)');
}
const headerCount =
  (processNetwork.match(/<ConvergingHeader3D\b/g) ?? []).length +
  (intakeNetwork.match(/<ConvergingHeader3D\b/g) ?? []).length;
// 5 dual-pump discharge headers + 1 sludge gallery receiving header + 1 intake header
// + 1 collection-2 east-wall suction header (pumps east of the basin draw through it).
if (headerCount !== 8) {
  issues.push(`Expected eight shared-shell pump headers, found ${headerCount}`);
}
// East-of-basin pumps must draw from the collection-2 east wall via the shared
// suction header — never from a floating north-wall point with no basin behind it.
if (!intakeNetwork.includes('network.eastSuctionHeader') || !intakeNetwork.includes("branch.suctionStyle === 'northWall'")) {
  issues.push('Intake network must split north-wall suctions from east-header suction branches');
}

const reducerCount = (processNetwork.match(/<PumpPipeReducer3D\b/g) ?? []).length;
const flangeGroupCount = (processNetwork.match(/<PumpGroupFlanges\b/g) ?? []).length;
if (reducerCount !== 2 || flangeGroupCount !== 5) {
  issues.push(`Expected two reducer declarations inside one five-group pump connection map, found reducers=${reducerCount}, groups=${flangeGroupCount}`);
}
for (const required of ['getSuctionFacePoint', 'getDischargeFacePoint', 'getSuctionDirection', 'getDischargeDirection']) {
  if (!processNetwork.includes(required)) issues.push(`Pump connection reducers are missing ${required}`);
}
if (!reducer.includes('cylinderGeometry args={[pipeRadius, pumpRadius, length')) {
  issues.push('Pump reducer must visibly transition from pumpRadius to pipeRadius');
}

if (!processNetwork.includes('SLUDGE_TANK_WALL_PENETRATION = 0.4') ||
    !processNetwork.includes('SLUDGE_TANK_INLET[2] + SLUDGE_TANK_WALL_PENETRATION')) {
  issues.push('Sludge tank inlet must pass through the wall into the tank interior');
}
if (/'gas'/.test(intakeLayout) || !intakeNetwork.includes('intakePoolInner(branch.wallPoint)')) {
  issues.push('Intake suction routes must use a real collection-basin wall, with no free-air/gas source');
}
if (!intakeLayout.includes('localX: -2.4') || !intakeLayout.includes('localX: 8.4')) {
  issues.push('Intake pump rows must stay clear of collection-basin corners');
}
if (!processNetwork.includes('SludgePumpDischargeRisers') || !processNetwork.includes('routes={SLUDGE_OUT_ROUTES}')) {
  issues.push('Sludge-out pump discharges must rise vertically into the shared ConvergingHeader3D');
}

// NOTE: the old external PH1→intermediate process-water corridor rule was
// removed on purpose — that section is overflow/civil-only now, enforced by
// check-main-process-overflow-only.mjs.

const routeTables = ['INTERMEDIATE_ROUTES', 'DRAIN_ROUTES', 'CLARIFIER_SLUDGE_ROUTES', 'DAF_SLUDGE_ROUTES', 'SLUDGE_OUT_ROUTES'];
for (const table of routeTables) {
  if (!processRoutes.includes(`export const ${table}`)) issues.push(`Missing canonical route table ${table}`);
}
if (!processRoutes.includes('getDirectTankSuctionBranch') || !processRoutes.includes('getDischargeRiser')) {
  issues.push('Canonical pump routes must be generated from exact tank/pump face helpers');
}

console.log(`Physical pipe connections: headers=${headerCount}, reducerDeclarations=${reducerCount}, pumpGroups=${flangeGroupCount}`);
if (issues.length) {
  console.error('\nPhysical pipe connection issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All audited pump, wall, tee, reducer, and corridor connection invariants pass.');
}
