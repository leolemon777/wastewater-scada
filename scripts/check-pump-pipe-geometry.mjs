import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_PORTS = path.join(ROOT, 'src/components/3d/pumpPorts.ts');
const PIPE_3D = path.join(ROOT, 'src/components/3d/Pipe3D.tsx');

const pumpPortsText = fs.readFileSync(PUMP_PORTS, 'utf8').replace(/\r\n/g, '\n');
const pipeText = fs.readFileSync(PIPE_3D, 'utf8').replace(/\r\n/g, '\n');

function numericConst(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

const dischargeStubLen = numericConst(pumpPortsText, 'DISCHARGE_STUB_LEN');
const suctionStubLen = numericConst(pumpPortsText, 'SUCTION_STUB_LEN');
const equipmentOverlapMultiplier = numericConst(pipeText, 'EQUIPMENT_CONNECTION_OVERLAP');
const equipmentMaxOverlap = numericConst(pipeText, 'EQUIPMENT_CONNECTION_MAX_OVERLAP');
const directTankSuctionBranch = pumpPortsText.match(
  /export function getDirectTankSuctionBranch\([\s\S]*?\n}\n/,
)?.[0] ?? '';

const issues = [];

if (dischargeStubLen === null) issues.push('Missing DISCHARGE_STUB_LEN in pumpPorts.ts');
if (suctionStubLen === null) issues.push('Missing SUCTION_STUB_LEN in pumpPorts.ts');
if (equipmentOverlapMultiplier === null) issues.push('Missing EQUIPMENT_CONNECTION_OVERLAP in Pipe3D.tsx');
if (equipmentMaxOverlap === null) issues.push('Missing EQUIPMENT_CONNECTION_MAX_OVERLAP in Pipe3D.tsx');

if (dischargeStubLen !== null && dischargeStubLen > 0.18) {
  issues.push(`DISCHARGE_STUB_LEN is ${dischargeStubLen}, expected <= 0.18 to avoid pump-side protruding spools`);
}
if (suctionStubLen !== null && suctionStubLen > 0.12) {
  issues.push(`SUCTION_STUB_LEN is ${suctionStubLen}, expected <= 0.12 to avoid pump-side protruding spools`);
}
if (equipmentMaxOverlap !== null && equipmentMaxOverlap > 0.12) {
  issues.push(`EQUIPMENT_CONNECTION_MAX_OVERLAP is ${equipmentMaxOverlap}, expected <= 0.12 for close-up pump/wall connections`);
}

if (equipmentOverlapMultiplier !== null && equipmentMaxOverlap !== null) {
  const representativeRadii = [0.075, 0.1, 0.12];
  for (const radius of representativeRadii) {
    const rawOverlap = Math.max(radius * equipmentOverlapMultiplier, 0.04);
    const cappedOverlap = Math.min(rawOverlap, equipmentMaxOverlap);
    if (cappedOverlap <= 0.035) {
      issues.push(`Equipment endpoint overlap ${cappedOverlap.toFixed(3)} is too shallow for radius ${radius}`);
    }
  }
}

if (!directTankSuctionBranch) {
  issues.push('Missing getDirectTankSuctionBranch in pumpPorts.ts');
} else {
  const directBranchKeepsPumpHeight =
    /return\s*\[\s*pt\(tankInsertion\[0\],\s*suction\[1\],\s*tankInsertion\[2\]\),\s*suction\s*\];/.test(directTankSuctionBranch);
  if (!directBranchKeepsPumpHeight) {
    issues.push('getDirectTankSuctionBranch must return [wall-at-pump-height, suction] with no intermediate stub vertex');
  }
  if (/tankInsertion\[1\]/.test(directTankSuctionBranch)) {
    issues.push('getDirectTankSuctionBranch must not use tankInsertion[1]; suction pipes should enter the tank at pump-mouth height');
  }
}

console.log(`Pump pipe geometry: dischargeStubLen=${dischargeStubLen}, suctionStubLen=${suctionStubLen}, equipmentOverlapMultiplier=${equipmentOverlapMultiplier}, equipmentMaxOverlap=${equipmentMaxOverlap}, directTankSuction=straightAtPumpHeight`);

if (issues.length > 0) {
  console.error('\nPump pipe geometry issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pump pipe stub lengths and equipment overlap cap are within close-up geometry limits.');
}
