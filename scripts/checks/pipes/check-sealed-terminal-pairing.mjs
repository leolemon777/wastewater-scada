import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECTION_DIR = path.join(ROOT, 'src/components/3d/sections');
const issues = [];
let sealedCount = 0;
let pairedCount = 0;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function collectPipeBlocks(text) {
  const blocks = [];
  let index = 0;
  while ((index = text.indexOf('<Pipe3D', index)) >= 0) {
    const end = text.indexOf('/>', index);
    if (end < 0) break;
    blocks.push({ index, end: end + 2, block: text.slice(index, end + 2) });
    index = end + 2;
  }
  return blocks;
}

for (const file of walk(SECTION_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const fileRel = rel(file);

  for (const pipe of collectPipeBlocks(text)) {
    const sealedStart = /\bsealedStart\b/.test(pipe.block);
    const sealedEnd = /\bsealedEnd\b/.test(pipe.block);
    if (!sealedStart && !sealedEnd) continue;

    sealedCount += 1;
    const line = lineNumber(text, pipe.index);
    const startConnection = pipe.block.match(/startConnection="([^"]+)"/)?.[1];
    const endConnection = pipe.block.match(/endConnection="([^"]+)"/)?.[1];

    if (sealedStart && startConnection !== 'terminal') {
      issues.push(`${fileRel}:${line} sealedStart must be a true start terminal`);
    }
    if (sealedEnd && endConnection !== 'terminal') {
      issues.push(`${fileRel}:${line} sealedEnd must be a true end terminal`);
    }

    const following = text.slice(pipe.end, Math.min(text.length, pipe.end + 420));
    const beforeNextPipe = following.split('<Pipe3D')[0];
    const blindIndex = beforeNextPipe.search(/<PipeBlindFlange3D\b/);
    if (blindIndex < 0) {
      issues.push(`${fileRel}:${line} sealed terminal must be immediately paired with PipeBlindFlange3D before the next Pipe3D`);
      continue;
    }

    const beforeBlind = beforeNextPipe.slice(0, blindIndex);
    if (/<PipeOpenFlange3D\b|<PipeWallPort3D\b|<CleanWaterHeaderTerminal\b/.test(beforeBlind)) {
      issues.push(`${fileRel}:${line} sealed terminal context should not mix blind and open/wall terminal fittings`);
      continue;
    }

    pairedCount += 1;
  }
}

console.log(`Sealed terminal pairing: sealedBlocks=${sealedCount}, immediateBlindFlanges=${pairedCount}`);

if (issues.length > 0) {
  console.error('\nSealed terminal pairing issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All sealed pipe terminals are explicitly paired with immediate blind flanges.');
}
