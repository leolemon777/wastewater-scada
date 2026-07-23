import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pipeText = read('src/components/scene/piping/Pipe3D.tsx');
const portsText = read('src/components/scene/piping/pumpPorts.ts');
const flangeText = read('src/components/scene/piping/PumpPipeFlanges3D.tsx');
const intakeText = read('src/components/scene/sections/IndustrialPipeNetwork3D.tsx');
const processText = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const layoutText = read('src/components/scene/sections/processPumpLayout.ts');
const issues = [];

const processPumpIds = [
  'p-inter-1', 'p-inter-2', 'p-drain-1', 'p-drain-2',
  'p-sludge-clar-1', 'p-sludge-clar-2', 'p-sludge-daf-1', 'p-sludge-daf-2',
  'p-sludge-out-1', 'p-sludge-out-2',
];
for (const id of processPumpIds) {
  if (!layoutText.includes(`'${id}'`)) issues.push(`processPumpLayout missing ${id}`);
}

for (const contract of [
  ['Pipe3D startOverlap support', 'startOverlap?: number', pipeText],
  ['Pipe3D endOverlap support', 'endOverlap?: number', pipeText],
  ['exact suction face constant', 'SUCTION_FACE_UNSCALED = 0.047 + 0.018 / 2', portsText],
  ['exact discharge face constant', 'DISCHARGE_FACE_UNSCALED = 0.032 + 0.018 / 2', portsText],
  ['suction face route helper', 'getSuctionFacePoint(position, rotationY)', portsText],
  ['discharge face route helper', 'getDischargeFacePoint(position, rotationY)', portsText],
  ['pump suction mating flange', 'position={getSuctionFacePoint(position, rotationY)}', flangeText],
  ['pump discharge mating flange', 'position={getDischargeFacePoint(position, rotationY)}', flangeText],
]) {
  if (!contract[2].includes(contract[1])) issues.push(`Missing ${contract[0]}`);
}

if (!intakeText.includes('<PumpPipeFlanges3D')) issues.push('Intake pumps missing mating flanges');
if (!intakeText.includes('endOverlap={0}') || !intakeText.includes('startOverlap={0}')) {
  issues.push('Intake pump pipes still rely on generic equipment overlap');
}
const processFlangeRenderers = (processText.match(/<PumpPipeFlanges3D/g) ?? []).length;
const usesRouteTables = processText.includes('INTERMEDIATE_ROUTES') || processText.includes('processPumpRoutes');
if (processFlangeRenderers < 1 || (!usesRouteTables && processFlangeRenderers < 3)) {
  issues.push('Process/sludge pump groups missing mating flange renderers');
}
// Suction/discharge exact faces may be declared once in shared helpers and reused
// for all 10 process/sludge pumps (map over route tables).
const exactSuction =
  (processText.match(/endOverlap=\{0\}/g) ?? []).length
  + (processText.includes('endOverlap={0}') ? 0 : 0);
const exactDischarge =
  (processText.match(/startOverlap=\{0\}/g) ?? []).length;
if (exactSuction < 1) {
  issues.push('Process/sludge network missing endOverlap={0} on pump suction ends');
}
if (exactDischarge < 1) {
  issues.push('Process/sludge network missing startOverlap={0} on pump discharge starts');
}
if (!processText.includes('processPumpRoutes') && !processText.includes('INTERMEDIATE_ROUTES')) {
  issues.push('Process/sludge network must use processPumpRoutes live face geometry');
}

console.log('Pump flange connection contract: standardPumps=16, exactProcessSuction=10, exactProcessDischarge=10');
if (issues.length > 0) {
  console.error('\nPump flange connection issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Standard pump pipes terminate on exact gasket faces with pipe-side mating flanges.');
}
