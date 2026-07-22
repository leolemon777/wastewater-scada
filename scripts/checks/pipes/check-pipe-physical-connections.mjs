import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const issues = [];

const pipe3d = read('src/components/3d/pipes/Pipe3D.tsx');
const intakeLayout = read('src/components/3d/sections/intakeLayout.ts');
const intakeNetwork = read('src/components/3d/sections/IndustrialPipeNetwork3D.tsx');
const processNetwork = read('src/components/3d/sections/ProcessAndSludgePipeNetwork3D.tsx');
const chemicalNetwork = read('src/components/3d/sections/ChemicalPipeRouting.tsx');
const scadaScene = read('src/components/3d/SCADAScene.tsx');
const convergingHeader = read('src/components/3d/pipes/ConvergingHeader3D.tsx');
const openFlange = read('src/components/3d/pipes/PipeOpenFlange3D.tsx');
const blindFlange = read('src/components/3d/pipes/PipeBlindFlange3D.tsx');
const wallPort = read('src/components/3d/pipes/PipeWallPort3D.tsx');

if (/PipeJunctionWeld|JUNCTION_WELD_/.test(pipe3d)) {
  issues.push('Pipe3D still renders a separate protruding junction weld ring');
}
if (!/const\s+JUNCTION_SURFACE_TRIM\s*=\s*0\s*;/.test(pipe3d)) {
  issues.push('Tee branches must reach the header centreline (JUNCTION_SURFACE_TRIM = 0)');
}
if (!/const\s+EQUIPMENT_CONNECTION_MAX_OVERLAP\s*=\s*0\.04\s*;/.test(pipe3d)) {
  issues.push('Equipment connection overlap must remain capped at 0.04 m');
}
if (!/const\s+JUNCTION_CONNECTION_OVERLAP\s*=\s*0\.35\s*;/.test(pipe3d)) {
  issues.push('Pipe junctions must retain a hidden 0.35R overlap to close open TubeGeometry end rings');
}
if (!pipe3d.includes('const hiddenJunctionOverlap = radius * JUNCTION_CONNECTION_OVERLAP;')) {
  issues.push('Trim-marked tee branches do not extend into the host pipe to bury their open end rings');
}
if (!convergingHeader.includes('points={[start, end]}') ||
    (convergingHeader.match(/renderShell=\{false\}/g) ?? []).length !== 2) {
  issues.push('Converging headers must use one continuous solid shell plus two flow-only directional legs');
}

if (/'gas'/.test(intakeLayout)) issues.push('Intake layout still contains a free-air gas suction source');
for (const cornerX of ['localX: -3,', 'localX: 3,', 'localX: 9,']) {
  if (intakeLayout.includes(cornerX)) issues.push(`Intake pump remains on a basin corner: ${cornerX}`);
}
if (!/\[wall\[0\], wall\[1\], wall\[2\] \+ 0\.45\]/.test(intakeNetwork)) {
  issues.push('Intake basin penetration is not normal to the north wall');
}
if (/<PipeOpenFlange3D\b/.test(intakeNetwork)) {
  issues.push('Intake suction still contains a detached pipe-side open flange');
}

const wallJumperBody = processNetwork.match(/function wallJumper[\s\S]*?\n}/)?.[0] ?? '';
if (!wallJumperBody || /from\[0\]\s*[+-]|to\[0\]\s*[+-]/.test(wallJumperBody)) {
  issues.push('wallJumper basin insertion changes X and therefore enters the wall diagonally');
}
if (!processNetwork.includes('SLUDGE_TANK_INLET[2] + WALL_PEN')) {
  issues.push('Sludge-tank inlet does not extend toward the basin interior (+Z)');
}
for (const forbiddenCorner of [
  'const DAF_OUTLET: Point = [12,',
  'const MIXING_INLET: Point = [15,',
  'const MIXING_OUTLET: Point = [21,',
  'const DRAINAGE_INLET: Point = [24,',
]) {
  if (processNetwork.includes(forbiddenCorner)) issues.push(`Deep-treatment wall port remains on a corner: ${forbiddenCorner}`);
}

const convergingHeaderCount =
  (intakeNetwork.match(/<ConvergingHeader3D\b/g) ?? []).length +
  (processNetwork.match(/<ConvergingHeader3D\b/g) ?? []).length;
if (convergingHeaderCount !== 5) {
  issues.push(`Expected 5 shared-shell converging pump headers, found ${convergingHeaderCount}`);
}

const reducerUseCount = (processNetwork.match(/<PumpConnectionReducers\b/g) ?? []).length;
if (reducerUseCount !== 10) issues.push(`Expected reducers on 10 process/sludge pumps, found ${reducerUseCount}`);

if (!processNetwork.includes('const SLUDGE_OUT_DISCHARGE_A: Point[] = [') ||
    !processNetwork.includes('const SLUDGE_OUT_DISCHARGE_B: Point[] = [') ||
    (processNetwork.match(/SLUDGE_TO_PRESS_TAKEOFF,/g) ?? []).length < 2 ||
    !processNetwork.includes('points={SLUDGE_OUT_DISCHARGE_A}') ||
    !processNetwork.includes('points={SLUDGE_OUT_DISCHARGE_B}')) {
  issues.push('Sludge-out pumps must use two continuous flange-to-riser-to-takeoff tubes');
}
if (!scadaScene.includes('position={[13.5, 0.5, 19.2]} rotation={[0, 0, 0]} cabinetName="4# 污泥脱水控制柜"')) {
  issues.push('Sludge dewatering cabinet is not in the clear front-side service position');
}

const chemicalPumpIdCount = new Set(
  [...chemicalNetwork.matchAll(/'p-(?:pac|pam|cacl2|daf-coag|daf-floc|screw-pam)-[^']+'/g)].map((m) => m[0]),
).size;
if (chemicalPumpIdCount !== 12) issues.push(`Expected 12 chemical duty/standby pump IDs, found ${chemicalPumpIdCount}`);

for (const [name, text] of [
  ['PipeOpenFlange3D', openFlange],
  ['PipeBlindFlange3D', blindFlange],
  ['PipeWallPort3D', wallPort],
]) {
  if (/Pipe Stub \(colored\)|radius \* 0\.14|radius \* 0\.11/.test(text)) {
    issues.push(`${name} still contains a protruding coloured pipe stub`);
  }
}

console.log(`Physical pipe connections: convergingHeaders=${convergingHeaderCount}, processPumpReducers=${reducerUseCount}, chemicalPumpIds=${chemicalPumpIdCount}`);
if (issues.length) {
  console.error('\nPhysical pipe connection issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All audited pump, wall, tee, flange, and header-flow connection invariants pass.');
}
