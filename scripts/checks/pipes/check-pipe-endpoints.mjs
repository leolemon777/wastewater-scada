import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = [
  'src/components/3d/sections',
].map((dir) => path.join(ROOT, dir));

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.tsx$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalize(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
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

const issues = [];
const stats = {
  blocks: 0,
  terminal: 0,
  equipment: 0,
  junction: 0,
  sealed: 0,
  junctionTrim: 0,
  terminalFittings: 0,
};

const OPEN_TERMINAL_FITTING_RE = /PipeOpenFlange3D|CleanWaterHeaderTerminal/;
const BLIND_TERMINAL_FITTING_RE = /PipeBlindFlange3D/;

for (const file of SCAN_DIRS.flatMap((dir) => walk(dir))) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = normalize(file);

  for (const { index, end, block } of collectPipeBlocks(text)) {
    stats.blocks += 1;
    const line = lineNumber(text, index);

    if (!/startConnection=/.test(block)) {
      issues.push(`${rel}:${line} Pipe3D missing startConnection`);
    }
    if (!/endConnection=/.test(block)) {
      issues.push(`${rel}:${line} Pipe3D missing endConnection`);
    }

    const connections = [...block.matchAll(/(?:startConnection|endConnection)="([^"]+)"/g)].map((match) => match[1]);
    const startConnection = block.match(/startConnection="([^"]+)"/)?.[1];
    const endConnection = block.match(/endConnection="([^"]+)"/)?.[1];
    const junctionTrim = block.match(/junctionTrim="([^"]+)"/)?.[1];
    const startJunctionRole = block.match(/startJunctionRole="([^"]+)"/)?.[1];
    const endJunctionRole = block.match(/endJunctionRole="([^"]+)"/)?.[1];

    for (const connection of connections) {
      if (connection === 'terminal') stats.terminal += 1;
      if (connection === 'equipment') stats.equipment += 1;
      if (connection === 'junction') stats.junction += 1;
    }

    if (junctionTrim) {
      stats.junctionTrim += 1;
      const trimsStart = junctionTrim === 'start' || junctionTrim === 'both';
      const trimsEnd = junctionTrim === 'end' || junctionTrim === 'both';
      if (trimsStart && startConnection !== 'junction') {
        issues.push(`${rel}:${line} junctionTrim="${junctionTrim}" trims start but startConnection is not junction`);
      }
      if (trimsEnd && endConnection !== 'junction') {
        issues.push(`${rel}:${line} junctionTrim="${junctionTrim}" trims end but endConnection is not junction`);
      }
    }

    const trimsStart = junctionTrim === 'start' || junctionTrim === 'both';
    const trimsEnd = junctionTrim === 'end' || junctionTrim === 'both';
    if (startJunctionRole && startConnection !== 'junction') {
      issues.push(`${rel}:${line} startJunctionRole used but startConnection is not junction`);
    }
    if (endJunctionRole && endConnection !== 'junction') {
      issues.push(`${rel}:${line} endJunctionRole used but endConnection is not junction`);
    }
    if (startConnection === 'junction' && !trimsStart && !startJunctionRole) {
      issues.push(`${rel}:${line} untrimmed start junction must declare startJunctionRole="handoff" or "continuous"`);
    }
    if (endConnection === 'junction' && !trimsEnd && !endJunctionRole) {
      issues.push(`${rel}:${line} untrimmed end junction must declare endJunctionRole="handoff" or "continuous"`);
    }

    const sealedStart = /\bsealedStart\b/.test(block);
    const sealedEnd = /\bsealedEnd\b/.test(block);

    if (sealedStart || sealedEnd) {
      stats.sealed += 1;
      if (sealedStart && startConnection !== 'terminal') {
        issues.push(`${rel}:${line} sealedStart used but startConnection is not terminal`);
      }
      if (sealedEnd && endConnection !== 'terminal') {
        issues.push(`${rel}:${line} sealedEnd used but endConnection is not terminal`);
      }
    }

    const terminalContext = text.slice(Math.max(0, index - 800), Math.min(text.length, end + 1200));
    const hasOpenTerminalFitting = OPEN_TERMINAL_FITTING_RE.test(terminalContext);
    const hasBlindTerminalFitting = BLIND_TERMINAL_FITTING_RE.test(terminalContext);
    if (hasOpenTerminalFitting || hasBlindTerminalFitting) {
      stats.terminalFittings += 1;
    }
    if (startConnection === 'terminal') {
      if (sealedStart && !hasBlindTerminalFitting) {
        issues.push(`${rel}:${line} sealed start terminal must have an explicit PipeBlindFlange3D nearby`);
      }
      if (!sealedStart && !hasOpenTerminalFitting) {
        issues.push(`${rel}:${line} open start terminal must have an explicit PipeOpenFlange3D or CleanWaterHeaderTerminal nearby`);
      }
    }
    if (endConnection === 'terminal') {
      if (sealedEnd && !hasBlindTerminalFitting) {
        issues.push(`${rel}:${line} sealed end terminal must have an explicit PipeBlindFlange3D nearby`);
      }
      if (!sealedEnd && !hasOpenTerminalFitting) {
        issues.push(`${rel}:${line} open end terminal must have an explicit PipeOpenFlange3D or CleanWaterHeaderTerminal nearby`);
      }
    }
  }
}

console.log(`Pipe3D blocks: ${stats.blocks}`);
console.log(`Endpoint refs: terminal=${stats.terminal}, equipment=${stats.equipment}, junction=${stats.junction}, sealedBlocks=${stats.sealed}, junctionTrimBlocks=${stats.junctionTrim}, terminalFittingContexts=${stats.terminalFittings}`);

if (issues.length > 0) {
  console.error('\nPipe endpoint issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All Pipe3D section blocks declare endpoint semantics.');
}
