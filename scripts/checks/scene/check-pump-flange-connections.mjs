/**
 * Pump–pipe face joint contracts:
 * - routes terminate on published sealing faces (helpers in pumpPorts)
 * - controlled seat depth PUMP_FACE_SEAT (gap-free, no volute stabbing)
 * - pipe-side closed flange hub + Pipe3D equipment end plug
 * - intake has no same-radius twin collar on the nozzle
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pipeText = read('src/components/scene/piping/Pipe3D.tsx');
const portsText = read('src/components/scene/piping/pumpPorts.ts');
const flangeText = read('src/components/scene/piping/PumpPipeFlanges3D.tsx');
const openFlangeText = read('src/components/scene/piping/PipeOpenFlange3D.tsx');
const intakeText = read('src/components/scene/sections/IndustrialPipeNetwork3D.tsx');
const processText = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const layoutText = read('src/components/scene/sections/processPumpLayout.ts');
const issues = [];

function numericExport(text, name) {
  const match = text.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

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
  ['pump suction face helper', 'getSuctionFacePoint', flangeText],
  ['pump discharge face helper', 'getDischargeFacePoint', flangeText],
  ['pipe flange outset (clear of body)', 'PIPE_FLANGE_OUTSET', flangeText],
  ['equipment end plug', 'PipeEquipmentEndPlug', pipeText],
]) {
  if (!contract[2].includes(contract[1])) issues.push(`Missing ${contract[0]}`);
}

const seat = numericExport(portsText, 'PUMP_FACE_SEAT');
const seatMax = numericExport(portsText, 'PUMP_FACE_SEAT_MAX');
if (seat == null) {
  issues.push('Missing exported PUMP_FACE_SEAT in pumpPorts.ts');
} else if (seat < 0.03 || seat > 0.06) {
  issues.push(`PUMP_FACE_SEAT=${seat}; keep in 0.03–0.06 (seat without volute stabbing)`);
}
if (seatMax == null || (seat != null && seatMax < seat)) {
  issues.push('PUMP_FACE_SEAT_MAX must be exported and ≥ PUMP_FACE_SEAT');
}

// Closed flange face — hollow open mouths read as cut green pipes end-on.
if (!openFlangeText.includes('Solid hub') && !/radius \* 1\.0[0-9]/.test(openFlangeText)) {
  issues.push('PipeOpenFlange3D must fill the bore with a solid hub (no hollow end-on ring)');
}

if (!intakeText.includes('<PumpPipeFlanges3D')) issues.push('Intake pumps missing mating flanges');
if (!intakeText.includes('PUMP_FACE_SEAT') || !processText.includes('PUMP_FACE_SEAT')) {
  issues.push('Intake and process networks must seat pump faces with shared PUMP_FACE_SEAT');
}
if ((intakeText.match(/<PumpPipeReducer3D\b/g) ?? []).length > 0) {
  issues.push('Intake must not stack same-radius PumpPipeReducer3D collars (reads as twin pipes)');
}

// Explicit non-zero seat at pump faces (not generic EQUIPMENT_CONNECTION_OVERLAP).
if (!/endOverlap=\{PUMP_FACE_SEAT\}/.test(intakeText) && !/endOverlap=\{PUMP_FACE_SEAT\}/.test(processText)) {
  issues.push('Pump suction ends must use endOverlap={PUMP_FACE_SEAT}');
}
if (!/startOverlap=\{PUMP_FACE_SEAT\}/.test(intakeText) || !/startOverlap=\{PUMP_FACE_SEAT\}/.test(processText)) {
  issues.push('Pump discharge starts must use startOverlap={PUMP_FACE_SEAT}');
}

const processFlangeRenderers = (processText.match(/<PumpPipeFlanges3D/g) ?? []).length;
const usesRouteTables = processText.includes('INTERMEDIATE_ROUTES') || processText.includes('processPumpRoutes');
if (processFlangeRenderers < 1 || (!usesRouteTables && processFlangeRenderers < 3)) {
  issues.push('Process/sludge pump groups missing mating flange renderers');
}
if (!processText.includes('processPumpRoutes') && !processText.includes('INTERMEDIATE_ROUTES')) {
  issues.push('Process/sludge network must use processPumpRoutes live face geometry');
}

// Generic equipment overlap must stay 0 so only explicit face seats apply.
const generic = Number(pipeText.match(/const\s+EQUIPMENT_CONNECTION_OVERLAP\s*=\s*([0-9.]+)/)?.[1]);
if (generic !== 0) {
  issues.push(`EQUIPMENT_CONNECTION_OVERLAP must stay 0 (found ${generic}); use explicit PUMP_FACE_SEAT`);
}

console.log(
  `Pump flange connection contract: PUMP_FACE_SEAT=${seat}, max=${seatMax}, closedHub=yes, equipmentPlug=yes`,
);
if (issues.length > 0) {
  console.error('\nPump flange connection issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Standard pump pipes terminate on exact gasket faces with controlled seat and closed mating flanges.');
}
