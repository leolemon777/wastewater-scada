import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * Shared pipe-fitting proportion guard.
 *
 * Current fitting design language (see component docblocks):
 * - PipeWallPort3D / PipeOpenFlange3D close bores with solid pipe-coloured
 *   hubs; thin parts are expressed through radius-derived locals such as
 *   hubT / flangeT / sleeveLen (`Math.max(radius * N, floor)`) so small
 *   chemical lines still render readable fittings.
 * - Pipe3D PipeJunctionWeld is a cast tee: one header-centred sphere body, a
 *   flared saddle socket, and a single restrained gasket/weld ring.
 *
 * This guard keeps that language low-profile: every cylinder dimension must
 * be radius-proportional (literal `radius * N` or a declared derived local),
 * radii/lengths stay under per-file caps, and the tee body stays restrained.
 */
const FITTING_RULES = [
  {
    file: 'src/components/scene/piping/PipeWallPort3D.tsx',
    maxRadiusMultiplier: 1.6, // exterior bolted flange ring 1.55
    maxLengthMultiplier: 0.8, // sleeveLen 0.7
    derivedLocals: { sleeveLen: 0.8, hubT: 0.2, flangeT: 0.12 },
  },
  {
    file: 'src/components/scene/piping/PipeOpenFlange3D.tsx',
    maxRadiusMultiplier: 1.35, // outer bolted ring 1.32
    maxLengthMultiplier: 0.2, // hubT 0.18
    derivedLocals: { hubT: 0.2, flangeT: 0.12 },
  },
  {
    file: 'src/components/scene/piping/PipeBlindFlange3D.tsx',
    maxRadiusMultiplier: 1.26,
    maxLengthMultiplier: 0.12,
    derivedLocals: {},
  },
];

const PIPE_3D = 'src/components/scene/piping/Pipe3D.tsx';
const issues = [];
const stats = [];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function numericConst(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

/** Resolve `const name = Math.max(radius * X, floor)` → X. */
function derivedLocalMultiplier(text, name) {
  const match = text.match(
    new RegExp(`const\\s+${name}\\s*=\\s*Math\\.max\\(radius\\s*\\*\\s*([0-9.]+)\\s*,`),
  );
  return match ? Number(match[1]) : null;
}

/**
 * Classify one cylinder dimension slot:
 * - `radius * N`           → { value: N }
 * - `IDENT` / `IDENT * N`  → derived local, value = definitionMultiplier × N
 * Returns null when the slot is not radius-proportional.
 */
function classifySlot(slot, rule, localMultipliers) {
  const literal = slot.match(/^radius\s*\*\s*([0-9.]+)$/);
  if (literal) return { value: Number(literal[1]) };

  const ident = slot.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s*\*\s*([0-9.]+))?$/);
  if (ident && Object.prototype.hasOwnProperty.call(rule.derivedLocals, ident[1])) {
    const base = localMultipliers[ident[1]];
    if (base == null) return null;
    return { value: base * (ident[2] ? Number(ident[2]) : 1) };
  }
  return null;
}

function checkCylinderArgs(rule) {
  const text = read(rule.file);
  const cylinderRe = /<cylinderGeometry\s+args=\{\[([\s\S]*?)\]\}\s*\/>/g;
  const localMultipliers = {};
  for (const [name, cap] of Object.entries(rule.derivedLocals)) {
    const multiplier = derivedLocalMultiplier(text, name);
    if (multiplier == null) {
      issues.push(`${rule.file}: derived local "${name}" must stay Math.max(radius * N, floor)`);
    } else if (multiplier > cap) {
      issues.push(`${rule.file}: derived local "${name}" radius multiplier ${multiplier} exceeds ${cap}`);
    }
    localMultipliers[name] = multiplier;
  }

  let count = 0;
  let maxRadius = 0;
  let maxLength = 0;
  let match;

  while ((match = cylinderRe.exec(text)) !== null) {
    count += 1;
    const slots = match[1].split(',').map((s) => s.trim());
    const line = lineNumber(text, match.index);

    if (slots.length < 3) {
      issues.push(`${rule.file}:${line} cylinderGeometry should declare radius/length slots`);
      continue;
    }

    const [topSlot, bottomSlot, lengthSlot] = slots;
    const top = classifySlot(topSlot, rule, localMultipliers);
    const bottom = classifySlot(bottomSlot, rule, localMultipliers);
    const length = classifySlot(lengthSlot, rule, localMultipliers);

    if (!top || !bottom || !length) {
      issues.push(`${rule.file}:${line} cylinderGeometry should use radius-proportional low-profile dimensions`);
      continue;
    }

    maxRadius = Math.max(maxRadius, top.value, bottom.value);
    maxLength = Math.max(maxLength, length.value);

    if (top.value > rule.maxRadiusMultiplier || bottom.value > rule.maxRadiusMultiplier) {
      issues.push(`${rule.file}:${line} cylinder radius multiplier ${Math.max(top.value, bottom.value)} exceeds ${rule.maxRadiusMultiplier}`);
    }
    if (length.value > rule.maxLengthMultiplier) {
      issues.push(`${rule.file}:${line} cylinder length multiplier ${length.value} exceeds ${rule.maxLengthMultiplier}`);
    }
  }

  stats.push(`${rule.file}: cylinders=${count}, maxRadius=${maxRadius.toFixed(2)}, maxLength=${maxLength.toFixed(2)}`);
}

for (const rule of FITTING_RULES) {
  checkCylinderArgs(rule);
}

const pipeText = read(PIPE_3D);
const weldThickness = Number(pipeText.match(/const\s+JUNCTION_WELD_THICKNESS\s*=\s*([0-9.]+)/)?.[1]);
const junctionOverlap = numericConst(pipeText, 'JUNCTION_CONNECTION_OVERLAP');
const junctionSurfaceTrim = numericConst(pipeText, 'JUNCTION_SURFACE_TRIM');
const sealedOverlap = numericConst(pipeText, 'SEALED_CONNECTION_OVERLAP');
const bendRadiusMultiplier = numericConst(pipeText, 'BEND_RADIUS_MULTIPLIER');

if (!Number.isFinite(weldThickness)) {
  issues.push(`${PIPE_3D}: missing JUNCTION_WELD_THICKNESS`);
} else if (weldThickness > 0.02) {
  issues.push(`${PIPE_3D}: JUNCTION_WELD_THICKNESS ${weldThickness} exceeds 0.02 (restrained gasket ring)`);
}
if (junctionOverlap === null) {
  issues.push(`${PIPE_3D}: missing JUNCTION_CONNECTION_OVERLAP`);
} else if (junctionOverlap !== 0) {
  issues.push(`${PIPE_3D}: JUNCTION_CONNECTION_OVERLAP must stay 0 so tee endpoints do not protrude through headers`);
}
if (sealedOverlap === null) {
  issues.push(`${PIPE_3D}: missing SEALED_CONNECTION_OVERLAP`);
} else if (sealedOverlap !== 0) {
  issues.push(`${PIPE_3D}: SEALED_CONNECTION_OVERLAP must stay 0 so capped pipe ends do not extend beyond blind flanges`);
}
if (junctionSurfaceTrim === null) {
  issues.push(`${PIPE_3D}: missing JUNCTION_SURFACE_TRIM`);
} else if (junctionSurfaceTrim < 0.85 || junctionSurfaceTrim > 0.98) {
  issues.push(`${PIPE_3D}: JUNCTION_SURFACE_TRIM ${junctionSurfaceTrim} should stay between 0.85 and 0.98 for flush tee joins`);
}
if (bendRadiusMultiplier === null) {
  issues.push(`${PIPE_3D}: missing BEND_RADIUS_MULTIPLIER`);
} else if (bendRadiusMultiplier < 2.0 || bendRadiusMultiplier > 5) {
  issues.push(`${PIPE_3D}: BEND_RADIUS_MULTIPLIER ${bendRadiusMultiplier} should stay between 2.0 and 5 (lower = tighter elbows, less protruding straight stubs)`);
}

// Cast tee body: at most one sphereGeometry, sized off the header radius.
const teeSpheres = [...pipeText.matchAll(/<sphereGeometry\s+args=\{\[headerRadius\s*\*\s*([0-9.]+)\s*,/g)];
const looseSpheres = [...pipeText.matchAll(/<sphereGeometry\b/g)].length - teeSpheres.length;
if (looseSpheres > 0) {
  issues.push(`${PIPE_3D}: sphereGeometry is only allowed as the header-radius cast tee body`);
}
if (teeSpheres.length > 1) {
  issues.push(`${PIPE_3D}: expected a single cast tee body sphere, found ${teeSpheres.length}`);
}
for (const sphere of teeSpheres) {
  const multiplier = Number(sphere[1]);
  if (multiplier > 1.2) {
    issues.push(`${PIPE_3D}: cast tee body sphere multiplier ${multiplier} exceeds 1.2 × headerRadius`);
  }
}

// Flared saddle socket proportions stay bounded.
const saddle = pipeText.match(/saddleRadius\s*=\s*Math\.max\(radius\s*\*\s*([0-9.]+)\s*,\s*headerRadius\s*\*\s*([0-9.]+)\s*\)/);
if (!saddle) {
  issues.push(`${PIPE_3D}: missing bounded saddleRadius = Math.max(radius * N, headerRadius * M)`);
} else {
  if (Number(saddle[1]) > 1.3) issues.push(`${PIPE_3D}: saddleRadius branch multiplier ${saddle[1]} exceeds 1.3`);
  if (Number(saddle[2]) > 1.25) issues.push(`${PIPE_3D}: saddleRadius header multiplier ${saddle[2]} exceeds 1.25`);
}
const collar = pipeText.match(/collarLen\s*=\s*Math\.max\(radius\s*\*\s*([0-9.]+)\s*,/);
if (!collar) {
  issues.push(`${PIPE_3D}: missing bounded collarLen = Math.max(radius * N, floor)`);
} else if (Number(collar[1]) > 1.0) {
  issues.push(`${PIPE_3D}: collarLen radius multiplier ${collar[1]} exceeds 1.0`);
}

stats.push(`${PIPE_3D}: teeSpheres=${teeSpheres.length}, junctionWeldThickness=${weldThickness}, junctionOverlap=${junctionOverlap}, junctionSurfaceTrim=${junctionSurfaceTrim}, sealedOverlap=${sealedOverlap}, bendRadiusMultiplier=${bendRadiusMultiplier}`);

console.log('Pipe fitting proportions:');
for (const stat of stats) console.log(`- ${stat}`);

if (issues.length > 0) {
  console.error('\nPipe fitting proportion issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All shared pipe fittings stay within low-profile close-up limits.');
}
