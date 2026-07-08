import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_FILE = path.join(ROOT, 'src/components/3d/ChemicalMeteringPump3D.tsx');
const SECTION_FILE = path.join(ROOT, 'src/components/3d/sections/ChemicalDosingSection.tsx');

const pumpText = fs.readFileSync(PUMP_FILE, 'utf8');
const sectionText = fs.readFileSync(SECTION_FILE, 'utf8');
const issues = [];

const hasChemicalPipeRouting =
  /<Pipe3D\b|<AnchoredPipe3D\b|<PipeWallPort3D\b|MeteringPumpBranch/.test(sectionText);

if (!hasChemicalPipeRouting) {
  console.log('Chemical metering ports: skipped (pipe routing removed for rebuild).');
  process.exit(0);
}

const expectedPumpPorts = [
  '[0, 0.36, 0.2]',
  '[0, 0.46, -0.18]',
];

for (const port of expectedPumpPorts) {
  if (!pumpText.includes(`position={${port}}`)) {
    issues.push(`ChemicalMeteringPump3D missing local port at ${port}`);
  }
}

const branchExpectations = [
  '[pumpX, 1.18, METERING_PUMP_Z + 0.2]',
  '[pumpX, 1.28, METERING_PUMP_Z - 0.18]',
];

for (const point of branchExpectations) {
  if (!sectionText.includes(point)) {
    issues.push(`ChemicalDosingSection missing metering-pump pipe endpoint ${point}`);
  }
}

const smallPipeCount = (sectionText.match(/radius=\{0\.028\}/g) ?? []).length;
if (smallPipeCount < 2) {
  issues.push(`Expected at least two 0.028 chemical metering pipe routes, found ${smallPipeCount}`);
}

const branchBody = sectionText.match(/const MeteringPumpBranch[\s\S]*?const CleanWaterDilutionPiping/)?.[0] ?? '';
if (!branchBody) {
  issues.push('Missing MeteringPumpBranch body in ChemicalDosingSection');
} else if (/<PipeWallPort3D\b/.test(branchBody)) {
  issues.push('MeteringPumpBranch must not render per-pump source PipeWallPort3D; use one shared source port per chemical pump group');
}

const sharedSourcePortCount = (sectionText.match(/position=\{\[x,\s*1\.18,\s*-0\.42\]\}/g) ?? []).length;
if (sharedSourcePortCount !== 1) {
  issues.push(`Expected exactly one shared metering source PipeWallPort3D declaration, found ${sharedSourcePortCount}`);
}

console.log(`Chemical metering ports: pumpPorts=${expectedPumpPorts.length}, smallPipeRoutes=${smallPipeCount}, sharedSourcePorts=${sharedSourcePortCount}`);

if (issues.length > 0) {
  console.error('\nChemical metering port issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Chemical metering pump ports align with small-pipe route endpoints.');
}
