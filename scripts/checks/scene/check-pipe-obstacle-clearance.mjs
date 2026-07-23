import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

const networkText = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const sceneText = read('src/components/scene/SCADAScene.tsx');
const cabinetText = read('src/components/scene/equipment/DistributionCabinet3D.tsx');
const tankLayoutText = read('src/components/scene/sections/tankLayout.ts');
const issues = [];

function numberConst(text, name) {
  const match = text.match(new RegExp(`(?:const|export const)\\s+${name}\\s*=\\s*(-?[0-9.]+)`));
  return match ? Number(match[1]) : null;
}

function vectorBeforeLabel(text, label) {
  const match = text.match(new RegExp(`position=\\{\\[(-?[0-9.]+),\\s*(-?[0-9.]+),\\s*(-?[0-9.]+)\\]\\}[^\\n]*${label}`));
  return match ? match.slice(1, 4).map(Number) : null;
}

function rotatedHalfExtents(size, rotationY) {
  const [sx, , sz] = size;
  const c = Math.abs(Math.cos(rotationY));
  const s = Math.abs(Math.sin(rotationY));
  return [sx * c / 2 + sz * s / 2, size[1] / 2, sx * s / 2 + sz * c / 2];
}

const declaredCorridorZ = numberConst(networkText, 'PROCESS_CORRIDOR_Z');
const corridorClearance = numberConst(networkText, 'PROCESS_CORRIDOR_CLEARANCE');
const processRadius = numberConst(networkText, 'PROCESS_RADIUS');
const clarifierLayout = tankLayoutText.match(
  /'tk-clarifier':\s*\{\s*center:\s*\[(-?[0-9.]+),\s*(-?[0-9.]+),\s*(-?[0-9.]+)\],\s*size:\s*\[(-?[0-9.]+),\s*(-?[0-9.]+),\s*(-?[0-9.]+)\]/,
);
const cabinetPosition = vectorBeforeLabel(sceneText, 'cabinetName="2# 沉淀回流控制柜"');
const cabinetSize = /<boxGeometry args=\{\[0\.72,\s*1\.7,\s*0\.42\]\}/.test(cabinetText)
  ? [0.72, 1.7, 0.42]
  : null;
const cabinetRotationY = /rotation=\{\[0,\s*0,\s*0\]\}[\s\S]{0,120}cabinetName="2# 沉淀回流控制柜"/.test(sceneText)
  ? 0
  : Math.PI / 2;

if (declaredCorridorZ === null && corridorClearance === null) {
  issues.push('Missing PROCESS_CORRIDOR_Z or PROCESS_CORRIDOR_CLEARANCE');
}
if (processRadius === null) issues.push('Missing PROCESS_RADIUS');
if (!clarifierLayout) issues.push('Missing canonical clarifier layout');
if (!cabinetPosition) issues.push('Missing fixed 2# clarifier-return cabinet position');
if (!cabinetSize) issues.push('Missing DistributionCabinet3D chassis dimensions');

const corridorZ = declaredCorridorZ ?? (
  clarifierLayout && corridorClearance !== null
    ? Number(clarifierLayout[3]) - Number(clarifierLayout[6]) / 2 - 0.05 - corridorClearance
    : null
);

if (corridorZ !== null && processRadius !== null && cabinetPosition && cabinetSize) {
  const [cabinetX, , cabinetZ] = cabinetPosition;
  const [, , halfZ] = rotatedHalfExtents(cabinetSize, cabinetRotationY);
  const visualClearance = 0.12;
  const zClearance = Math.abs(corridorZ - cabinetZ) - halfZ - processRadius;
  if (zClearance < visualClearance) {
    issues.push(
      `Process corridor z=${corridorZ} leaves only ${zClearance.toFixed(2)}m from the 2# cabinet at x=${cabinetX}, z=${cabinetZ}; route must clear the cabinet volume`,
    );
  }
}

if (corridorZ !== null && clarifierLayout) {
  const centerZ = Number(clarifierLayout[3]);
  const depth = Number(clarifierLayout[6]);
  const clarifierNorthWall = centerZ - depth / 2 - 0.05;
  const wallGap = clarifierNorthWall - corridorZ;
  if (wallGap < 0.2) {
    issues.push(`Process corridor is too close to the clarifier wall: gap=${wallGap.toFixed(2)}m`);
  }
  if (wallGap > 1.2) {
    issues.push(`Process corridor is too far outside the clarifier wall: gap=${wallGap.toFixed(2)}m; this invites visual crossings with nearby equipment`);
  }
}

console.log(`Pipe obstacle clearance: processCorridorZ=${corridorZ}, cabinetClearanceChecked=${Boolean(cabinetPosition && cabinetSize)}`);

if (issues.length > 0) {
  console.error('\nPipe obstacle clearance issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Process corridors clear fixed control cabinets and remain outside the tank wall envelope.');
}
