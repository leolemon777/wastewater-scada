import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_PORTS = path.join(ROOT, 'src/components/scene/piping/pumpPorts.ts');
const PIPE_3D = path.join(ROOT, 'src/components/scene/piping/Pipe3D.tsx');

const pumpPortsText = fs.readFileSync(PUMP_PORTS, 'utf8').replace(/\r\n/g, '\n');
const pipeText = fs.readFileSync(PIPE_3D, 'utf8').replace(/\r\n/g, '\n');

function numericConst(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

const dischargeStubLen = numericConst(pumpPortsText, 'DISCHARGE_STUB_LEN');
const suctionStubLen = numericConst(pumpPortsText, 'SUCTION_STUB_LEN');
const equipmentOverlapMultiplier = numericConst(pipeText, 'EQUIPMENT_CONNECTION_OVERLAP');
const directTankSuctionBranch = pumpPortsText.match(
  /export function getDirectTankSuctionBranch\([\s\S]*?\n}\n/,
)?.[0] ?? '';

const issues = [];

if (dischargeStubLen === null) issues.push('Missing DISCHARGE_STUB_LEN in pumpPorts.ts');
if (suctionStubLen === null) issues.push('Missing SUCTION_STUB_LEN in pumpPorts.ts');
if (equipmentOverlapMultiplier === null) issues.push('Missing EQUIPMENT_CONNECTION_OVERLAP in Pipe3D.tsx');

if (dischargeStubLen !== null && dischargeStubLen > 0.18) {
  issues.push(`DISCHARGE_STUB_LEN is ${dischargeStubLen}, expected <= 0.18 to avoid pump-side protruding spools`);
}
if (suctionStubLen !== null && suctionStubLen > 0.12) {
  issues.push(`SUCTION_STUB_LEN is ${suctionStubLen}, expected <= 0.12 to avoid pump-side protruding spools`);
}
if (equipmentOverlapMultiplier !== null && equipmentOverlapMultiplier !== 0) {
  issues.push(
    `EQUIPMENT_CONNECTION_OVERLAP is ${equipmentOverlapMultiplier}; equipment endpoints must remain on authored sealing faces`,
  );
}
if (pipeText.includes('EQUIPMENT_CONNECTION_MAX_OVERLAP')) {
  issues.push('Pipe3D still declares a generic equipment overlap cap; penetration must be explicit per endpoint');
}

if (!directTankSuctionBranch) {
  issues.push('Missing getDirectTankSuctionBranch in pumpPorts.ts');
} else {
  const usesMouthHeight =
    /pt\(\s*tankInsertion\[0\]\s*,\s*mouth\[1\]\s*,\s*tankInsertion\[2\]\s*\)/.test(directTankSuctionBranch)
    || /const wall = pt\(tankInsertion\[0\], mouth\[1\], tankInsertion\[2\]\)/.test(directTankSuctionBranch);
  if (!usesMouthHeight) {
    issues.push('getDirectTankSuctionBranch must place the wall point at mouth height (mouth[1])');
  }
  if (!directTankSuctionBranch.includes('return [poolInner, wall, mouth]')) {
    issues.push('getDirectTankSuctionBranch must return [pool interior, wall sleeve, mouth sealing face] for axial runs');
  }
  if (!directTankSuctionBranch.includes('outside') || !directTankSuctionBranch.includes('alignPt')) {
    issues.push('getDirectTankSuctionBranch must jog outside the basin when the wall port is laterally offset');
  }
  if (!directTankSuctionBranch.includes('* 0.4')) {
    issues.push('getDirectTankSuctionBranch must retain a 0.4m normal penetration into the basin');
  }
  if (/tankInsertion\[1\]/.test(directTankSuctionBranch)) {
    issues.push('getDirectTankSuctionBranch must not use tankInsertion[1]; suction pipes should enter the tank at pump-mouth height');
  }
}

console.log(`Pump pipe geometry: dischargeStubLen=${dischargeStubLen}, suctionStubLen=${suctionStubLen}, equipmentOverlapMultiplier=${equipmentOverlapMultiplier}, directTankSuction=poolInner→wall→sealingFace`);

if (issues.length > 0) {
  console.error('\nPump pipe geometry issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pump pipe routes cross the tank wall and terminate on authored sealing faces without generic overlap.');
}
