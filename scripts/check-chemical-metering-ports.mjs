import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_FILE = path.join(ROOT, 'src/components/3d/ChemicalMeteringPump3D.tsx');
const ROUTING_FILE = path.join(ROOT, 'src/components/3d/sections/ChemicalPipeRouting.tsx');

const pumpText = fs.readFileSync(PUMP_FILE, 'utf8');
const routingText = fs.readFileSync(ROUTING_FILE, 'utf8');
const issues = [];

const expectedPumpPorts = [
  '[0, 0.36, 0.2]',
  '[0, 0.46, -0.18]',
];

for (const port of expectedPumpPorts) {
  if (!pumpText.includes(`position={${port}}`)) {
    issues.push(`ChemicalMeteringPump3D missing local port at ${port}`);
  }
}

const expectedPumpIds = [
  'p-pac-1', 'p-pac-2', 'p-cacl2-1', 'p-cacl2-2', 'p-pam-1', 'p-pam-2',
  'p-daf-coag-1', 'p-daf-coag-2', 'p-daf-floc-1', 'p-daf-floc-2',
  'p-screw-pam-1', 'p-screw-pam-2',
];
for (const id of expectedPumpIds) {
  if (!routingText.includes(`'${id}'`)) issues.push(`ChemicalPipeRouting missing metering pump ${id}`);
}

for (const token of ['suctionPort', 'dischargePort', 'suctionCenter', 'dischargeCenter']) {
  if (!routingText.includes(token)) issues.push(`ChemicalPipeRouting missing ${token} connection anchor`);
}
if (!/<ChemicalMeteringPump3D\b/.test(routingText)) {
  issues.push('ChemicalPipeRouting does not render ChemicalMeteringPump3D');
}
if (!/const\s+MeteringPumpSkid/.test(routingText)) {
  issues.push('ChemicalPipeRouting missing duty/standby MeteringPumpSkid');
}

const smallPipeCount = (routingText.match(/radius=\{CHEM_BRANCH_R\}/g) ?? []).length;
if (smallPipeCount < 5) issues.push(`Expected at least five metering branch route declarations, found ${smallPipeCount}`);

console.log(`Chemical metering ports: pumpPorts=${expectedPumpPorts.length}, pumpIds=${expectedPumpIds.length}, branchRoutes=${smallPipeCount}`);

if (issues.length > 0) {
  console.error('\nChemical metering port issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Chemical metering pump ports align with small-pipe route endpoints.');
}
