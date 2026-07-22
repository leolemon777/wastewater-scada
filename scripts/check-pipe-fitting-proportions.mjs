import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const FITTING_RULES = [
  {
    file: 'src/components/3d/PipeWallPort3D.tsx',
    maxRadiusMultiplier: 1.24,
    maxLengthMultiplier: 0.08,
  },
  {
    file: 'src/components/3d/PipeOpenFlange3D.tsx',
    maxRadiusMultiplier: 1.26,
    maxLengthMultiplier: 0.15,
  },
  {
    file: 'src/components/3d/PipeBlindFlange3D.tsx',
    maxRadiusMultiplier: 1.26,
    maxLengthMultiplier: 0.12,
  },
  {
    file: 'src/components/3d/PipeFloorSleeve3D.tsx',
    maxRadiusMultiplier: 1.2,
    maxLengthMultiplier: 0.05,
  },
  {
    file: 'src/components/3d/PipeInspectionCollar3D.tsx',
    maxRadiusMultiplier: 1.12,
    maxLengthMultiplier: 0.08,
  },
];

const PIPE_3D = 'src/components/3d/Pipe3D.tsx';
const issues = [];
const stats = [];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function radiusMultipliers(expression) {
  return [...expression.matchAll(/radius\s*\*\s*([0-9.]+)/g)].map((match) => Number(match[1]));
}

function numericConst(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

function checkCylinderArgs(rule) {
  const text = read(rule.file);
  const cylinderRe = /<cylinderGeometry\s+args=\{\[([\s\S]*?)\]\}\s*\/>/g;
  let count = 0;
  let maxRadius = 0;
  let maxLength = 0;
  let match;

  while ((match = cylinderRe.exec(text)) !== null) {
    count += 1;
    const args = match[1];
    const multipliers = radiusMultipliers(args);
    const line = lineNumber(text, match.index);

    if (multipliers.length < 3) {
      issues.push(`${rule.file}:${line} cylinderGeometry should use radius-based low-profile dimensions`);
      continue;
    }

    const [topRadius, bottomRadius, length] = multipliers;
    maxRadius = Math.max(maxRadius, topRadius, bottomRadius);
    maxLength = Math.max(maxLength, length);

    if (topRadius > rule.maxRadiusMultiplier || bottomRadius > rule.maxRadiusMultiplier) {
      issues.push(`${rule.file}:${line} cylinder radius multiplier ${Math.max(topRadius, bottomRadius)} exceeds ${rule.maxRadiusMultiplier}`);
    }
    if (length > rule.maxLengthMultiplier) {
      issues.push(`${rule.file}:${line} cylinder length multiplier ${length} exceeds ${rule.maxLengthMultiplier}`);
    }
  }

  stats.push(`${rule.file}: cylinders=${count}, maxRadius=${maxRadius}, maxLength=${maxLength}`);
}

for (const rule of FITTING_RULES) {
  checkCylinderArgs(rule);
}

const pipeText = read(PIPE_3D);
const junctionOverlap = numericConst(pipeText, 'JUNCTION_CONNECTION_OVERLAP');
const junctionSurfaceTrim = numericConst(pipeText, 'JUNCTION_SURFACE_TRIM');
const sealedOverlap = numericConst(pipeText, 'SEALED_CONNECTION_OVERLAP');
const bendRadiusMultiplier = numericConst(pipeText, 'BEND_RADIUS_MULTIPLIER');

if (/PipeJunctionWeld|JUNCTION_WELD_/.test(pipeText)) {
  issues.push(`${PIPE_3D}: tee joins must use centreline mesh overlap, not a protruding weld-ring patch`);
}
if (junctionOverlap === null) {
  issues.push(`${PIPE_3D}: missing JUNCTION_CONNECTION_OVERLAP`);
} else if (junctionOverlap < 0.2 || junctionOverlap > 0.5) {
  issues.push(`${PIPE_3D}: JUNCTION_CONNECTION_OVERLAP ${junctionOverlap} must stay within 0.2–0.5R so open tube rings close inside the host without creating a visible dead leg`);
}
if (sealedOverlap === null) {
  issues.push(`${PIPE_3D}: missing SEALED_CONNECTION_OVERLAP`);
} else if (sealedOverlap !== 0) {
  issues.push(`${PIPE_3D}: SEALED_CONNECTION_OVERLAP must stay 0 so capped pipe ends do not extend beyond blind flanges`);
}
if (junctionSurfaceTrim === null) {
  issues.push(`${PIPE_3D}: missing JUNCTION_SURFACE_TRIM`);
} else if (junctionSurfaceTrim !== 0) {
  issues.push(`${PIPE_3D}: JUNCTION_SURFACE_TRIM must stay 0 so tee branches reach the host centreline`);
}
if (bendRadiusMultiplier === null) {
  issues.push(`${PIPE_3D}: missing BEND_RADIUS_MULTIPLIER`);
} else if (bendRadiusMultiplier < 1.0 || bendRadiusMultiplier > 5) {
  issues.push(`${PIPE_3D}: BEND_RADIUS_MULTIPLIER ${bendRadiusMultiplier} should stay between 1.0 and 5 (1.0 ≈ a standard 1D elbow for orthogonal banks; higher = long-radius fillet)`);
}
if (/<sphereGeometry\b/.test(pipeText)) {
  issues.push(`${PIPE_3D}: Pipe3D must not use sphereGeometry as a junction/bend patch`);
}
stats.push(`${PIPE_3D}: teeMode=centerline-overlap, junctionOverlap=${junctionOverlap}, junctionSurfaceTrim=${junctionSurfaceTrim}, sealedOverlap=${sealedOverlap}, bendRadiusMultiplier=${bendRadiusMultiplier}`);

console.log('Pipe fitting proportions:');
for (const stat of stats) console.log(`- ${stat}`);

if (issues.length > 0) {
  console.error('\nPipe fitting proportion issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All shared pipe fittings stay within low-profile close-up limits.');
}
