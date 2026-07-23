import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

const files = {
  pipe: read('src/components/scene/piping/Pipe3D.tsx'),
  pump: read('src/components/scene/equipment/Pump3D.tsx'),
  tankLayout: read('src/components/scene/sections/tankLayout.ts'),
  processRoutes: read('src/components/scene/sections/processPumpRoutes.ts'),
  intakeRoutes: read('src/components/scene/sections/intakePipeRoutes.ts'),
  processNetwork: read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx'),
  intakeSection: read('src/components/scene/sections/IntakeSection.tsx'),
  mainSection: read('src/components/scene/sections/MainProcessSection.tsx'),
  deepSection: read('src/components/scene/sections/DeepTreatmentSection.tsx'),
  sludgeSection: read('src/components/scene/sections/SludgeSection.tsx'),
};

const issues = [];

function numericConst(text, name) {
  const match = text.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

if (files.pipe.includes('collapseShortSegments')) {
  issues.push('Pipe3D still collapses short orthogonal legs, which can create diagonal or missing connection spools');
}
if (!/normalizePipePolyline[\s\S]*?simplifyCollinearPoints\(sanitizePoints\(points\)\)/.test(files.pipe)) {
  issues.push('Pipe3D normalization must only sanitize points and remove truly collinear vertices');
}
if (numericConst(files.pipe, 'EQUIPMENT_CONNECTION_OVERLAP') !== 0) {
  issues.push('Generic equipment endpoint overlap must stay at zero; authored route endpoints are sealing faces');
}

if (!files.tankLayout.includes('export const TANK_LAYOUT')) {
  issues.push('Missing canonical TANK_LAYOUT shared by equipment placement and route generation');
}
for (const [label, text] of [
  ['IntakeSection', files.intakeSection],
  ['MainProcessSection', files.mainSection],
  ['DeepTreatmentSection', files.deepSection],
  ['SludgeSection', files.sludgeSection],
]) {
  if (!text.includes("from './tankLayout'")) {
    issues.push(`${label} must place routed tanks from the canonical tankLayout table`);
  }
}
if (!files.processRoutes.includes('getAxialTankWallPort')) {
  issues.push('Process pump suction routes must derive their wall point from canonical tank geometry');
}
if (files.processRoutes.includes('WALL_SEEDS')) {
  issues.push('Process pump routes still contain independent hard-coded tank wall seeds');
}
if (!files.processNetwork.includes('getTankWallPort')) {
  issues.push('Process/sludge network must derive tank endpoints from canonical wall-port helpers');
}
if (/const\s+(?:FLOC_OUTLET|CLARIFIER_INLET|DAF_INLET|SLUDGE_TANK_INLET)\s*:\s*Point\s*=\s*\[/.test(files.processNetwork)) {
  issues.push('Process/sludge tank endpoints must not revert to hard-coded coordinate literals');
}

const processHeaderClearance = numericConst(files.processRoutes, 'PUMP_HEADER_END_CLEARANCE');
const intakeHeaderClearance = numericConst(files.intakeRoutes, 'INTAKE_HEADER_END_CLEARANCE');
for (const [label, value] of [
  ['PUMP_HEADER_END_CLEARANCE', processHeaderClearance],
  ['INTAKE_HEADER_END_CLEARANCE', intakeHeaderClearance],
]) {
  if (value === null) {
    issues.push(`Missing ${label}`);
  } else if (value > 0.3) {
    issues.push(`${label} is ${value}; header blind ends should not leave a visible half-pipe overhang`);
  }
}

if (/machineRef\.current\.position\./.test(files.pump)) {
  issues.push('Pump skid/process-flange group moves at runtime and can separate from its static pipe endpoints');
}

console.log(
  `Pipe connection contracts: processHeaderClearance=${processHeaderClearance}, intakeHeaderClearance=${intakeHeaderClearance}`,
);

if (issues.length > 0) {
  console.error('\nPipe connection contract issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Canonical tank ports, rigid pump faces, exact endpoints, and compact headers are enforced.');
}
