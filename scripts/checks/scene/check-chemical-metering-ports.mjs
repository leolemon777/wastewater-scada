import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const pumpText = read('src/components/scene/equipment/ChemicalMeteringPump3D.tsx');
const sectionText = read('src/components/scene/sections/ChemicalDosingSection.tsx');
const layoutText = read('src/components/scene/sections/chemicalPumpLayout.ts');
const routingText = read('src/components/scene/sections/ChemicalPipeRouting.tsx');
const issues = [];

for (const port of ['[0, 0.36, 0.2]', '[0, 0.46, -0.18]']) {
  if (!pumpText.includes(`position={${port}}`)) {
    issues.push(`ChemicalMeteringPump3D missing local process port ${port}`);
  }
}

const expectedPumpIds = [
  'p-pac-1', 'p-pac-2', 'p-cacl2-1', 'p-cacl2-2', 'p-pam-1', 'p-pam-2',
  'p-daf-coag-1', 'p-daf-coag-2', 'p-daf-floc-1', 'p-daf-floc-2',
  'p-screw-pam-1', 'p-screw-pam-2',
];
for (const id of expectedPumpIds) {
  if (!layoutText.includes(`'${id}'`)) issues.push(`chemicalPumpLayout missing ${id}`);
}

if (!sectionText.includes('<ChemicalMeteringPump3D')) {
  issues.push('ChemicalDosingSection does not instantiate ChemicalMeteringPump3D');
}
if (!sectionText.includes('CHEMICAL_PUMP_GROUPS.flatMap')) {
  issues.push('ChemicalDosingSection must render every duty/standby pump group');
}

for (const helper of [
  'chemicalSuctionHeaderPoints',
  'chemicalSuctionPoints',
  'chemicalDischargePoints',
  'chemicalSuctionFace',
  'chemicalDischargeFace',
]) {
  if (!routingText.includes(`${helper}(`)) issues.push(`ChemicalPipeRouting missing ${helper} route usage`);
}

if (!routingText.includes('radius={CHEMICAL_METERING_RADIUS}')) {
  issues.push('Chemical metering branches do not use the shared metering radius');
}
if (!routingText.includes('endOverlap={0}')) {
  issues.push('Chemical suction branches must stop exactly on pump flange faces');
}
if (!routingText.includes('startOverlap={0}')) {
  issues.push('Chemical discharge branches must start exactly on pump flange faces');
}
if (!routingText.includes('pumpGroup(\'ph-pac\').deliveryTakeoff')) {
  issues.push('Chemical delivery lines still bypass the pump discharge manifold');
}

console.log(`Chemical metering network: groups=6, pumps=${expectedPumpIds.length}, exactFaces=2, routedHelpers=5`);

if (issues.length > 0) {
  console.error('\nChemical metering connection issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All chemical delivery lines pass through modelled duty/standby metering pumps.');
}
