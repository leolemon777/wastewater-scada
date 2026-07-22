import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_FILE = 'src/components/3d/equipment/Pump3D.tsx';
const PORTS_FILE = 'src/components/3d/pipes/pumpPorts.ts';

const pumpText = fs.readFileSync(path.join(ROOT, PUMP_FILE), 'utf8');
const portsText = fs.readFileSync(path.join(ROOT, PORTS_FILE), 'utf8');
const issues = [];

function parseVectorLiteral(text, label, re) {
  const match = text.match(re);
  if (!match) {
    issues.push(`Missing ${label}`);
    return null;
  }
  return match.slice(1, 4).map(Number);
}

function parseScale(text) {
  const constScale = text.match(/const\s+MACHINE_SCALE\s*=\s*([0-9.]+)/)?.[1];
  return constScale === undefined ? null : Number(constScale);
}

function sameVector(a, b, epsilon = 0.000001) {
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) <= epsilon);
}

const pumpSuction = parseVectorLiteral(
  pumpText,
  `${PUMP_FILE} PumpProcessFlanges suction group position`,
  /Suction nozzle[\s\S]*?<group\s+position=\{\[([0-9.-]+),\s*([0-9.-]+),\s*([0-9.-]+)\]\}/,
);
const pumpDischarge = parseVectorLiteral(
  pumpText,
  `${PUMP_FILE} PumpProcessFlanges discharge group position`,
  /Discharge nozzle[\s\S]*?<group\s+position=\{\[([0-9.-]+),\s*([0-9.-]+),\s*([0-9.-]+)\]\}/,
);
const portsDischarge = parseVectorLiteral(
  portsText,
  `${PORTS_FILE} DISCHARGE_LOCAL`,
  /DISCHARGE_LOCAL\s*=\s*new THREE\.Vector3\(([0-9.-]+),\s*([0-9.-]+),\s*([0-9.-]+)\)\.multiplyScalar\(MACHINE_SCALE\)/,
);
const portsSuction = parseVectorLiteral(
  portsText,
  `${PORTS_FILE} SUCTION_LOCAL`,
  /SUCTION_LOCAL\s*=\s*new THREE\.Vector3\(([0-9.-]+),\s*([0-9.-]+),\s*([0-9.-]+)\)\.multiplyScalar\(MACHINE_SCALE\)/,
);

const scaleConst = parseScale(portsText);
const pumpScale = pumpText.match(/<group\s+ref=\{machineRef\}\s+scale=\{\[([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)\]\}/)?.slice(1, 4).map(Number) ?? null;

if (scaleConst === null) {
  issues.push(`${PORTS_FILE}: missing MACHINE_SCALE`);
}
if (!pumpScale) {
  issues.push(`${PUMP_FILE}: missing machineRef scale`);
} else if (!pumpScale.every((value) => value === scaleConst)) {
  issues.push(`${PUMP_FILE}: machine scale [${pumpScale.join(', ')}] does not match ${PORTS_FILE} MACHINE_SCALE ${scaleConst}`);
}

if (pumpSuction && portsSuction && !sameVector(pumpSuction, portsSuction)) {
  issues.push(`Pump suction port mismatch: Pump3D [${pumpSuction.join(', ')}] vs pumpPorts [${portsSuction.join(', ')}]`);
}
if (pumpDischarge && portsDischarge && !sameVector(pumpDischarge, portsDischarge)) {
  issues.push(`Pump discharge port mismatch: Pump3D [${pumpDischarge.join(', ')}] vs pumpPorts [${portsDischarge.join(', ')}]`);
}

console.log(
  `Pump port alignment: suction=${pumpSuction?.join(',') ?? 'missing'}, discharge=${pumpDischarge?.join(',') ?? 'missing'}, scale=${scaleConst ?? 'missing'}`,
);

if (issues.length > 0) {
  console.error('\nPump port alignment issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pump3D process port centers match pumpPorts routing anchors.');
}
