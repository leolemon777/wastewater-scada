import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const issues = [];
const stats = [];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function extractBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return null;
  const end = text.indexOf(endMarker, start);
  if (end < 0) return null;
  return { text: text.slice(start, end), offset: start };
}

function parseCylinderArgs(block, relPath) {
  const cylinderRe = /<cylinderGeometry\s+args=\{\[([\s\S]*?)\]\}\s*\/>/g;
  const cylinders = [];
  let match;

  while ((match = cylinderRe.exec(block.text)) !== null) {
    const values = [...match[1].matchAll(/\b\d+(?:\.\d+)?\b/g)].map((part) => Number(part[0]));

    if (values.length < 4) {
      issues.push(`${relPath}:${lineNumber(block.text, match.index)} has non-literal cylinder dimensions`);
      continue;
    }

    const lengthOptions = values.slice(2, -1);
    cylinders.push({
      line: lineNumber(block.text, match.index),
      topRadius: values[0],
      bottomRadius: values[1],
      length: Math.max(...lengthOptions),
    });
  }

  return cylinders;
}

function checkBlock({ relPath, startMarker, endMarker, label, expectedCount, maxRadius, maxLength }) {
  const fileText = read(relPath);

  if (!/<Pipe3D\b|<PipeWallPort3D\b|CleanWaterHeaderTerminal|MeteringPumpBranch|DosingPort/.test(fileText)) {
    stats.push(`${label}: skipped (pipe routing removed for rebuild)`);
    return;
  }

  const block = extractBlock(fileText, startMarker, endMarker);

  if (!block) {
    issues.push(`${relPath}: missing ${label} block`);
    return;
  }

  const cylinders = parseCylinderArgs(block, relPath);
  if (cylinders.length !== expectedCount) {
    issues.push(`${relPath}: expected ${expectedCount} cylinders in ${label}, found ${cylinders.length}`);
  }

  let blockMaxRadius = 0;
  let blockMaxLength = 0;

  for (const cylinder of cylinders) {
    const radius = Math.max(cylinder.topRadius, cylinder.bottomRadius);
    blockMaxRadius = Math.max(blockMaxRadius, radius);
    blockMaxLength = Math.max(blockMaxLength, cylinder.length);

    if (radius > maxRadius) {
      issues.push(`${relPath}:${cylinder.line} ${label} radius ${radius} exceeds ${maxRadius}`);
    }
    if (cylinder.length > maxLength) {
      issues.push(`${relPath}:${cylinder.line} ${label} length ${cylinder.length} exceeds ${maxLength}`);
    }
  }

  stats.push(`${label}: cylinders=${cylinders.length}, maxRadius=${blockMaxRadius}, maxLength=${blockMaxLength}`);
}

checkBlock({
  relPath: 'src/components/scene/sections/ChemicalPipeRouting.tsx',
  startMarker: 'const DosingPort:',
  endMarker: '/** Overhead chemical dosing lines',
  label: 'chemical dosing terminal',
  expectedCount: 3,
  maxRadius: 0.09,
  maxLength: 0.1,
});

checkBlock({
  relPath: 'src/components/scene/sections/ChemicalDosingSection.tsx',
  startMarker: 'const CleanWaterHeaderTerminal:',
  endMarker: 'const MeteringPumpBranch:',
  label: 'clean-water header terminal',
  expectedCount: 3,
  maxRadius: 0.065,
  maxLength: 0.12,
});

console.log('Small pipe terminal proportions:');
for (const stat of stats) console.log(`- ${stat}`);

if (issues.length > 0) {
  console.error('\nSmall pipe terminal proportion issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Small pipe terminals stay within low-profile close-up limits.');
}
