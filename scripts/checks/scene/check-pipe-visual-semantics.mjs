import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECTION_DIR = path.join(ROOT, 'src/components/scene/sections');
const issues = [];
const stats = {
  pipeBlocks: 0,
  flowTypes: new Map(),
};

const ALLOWED_FLOW_TYPES = new Set(['water', 'sludge', 'chemical', 'none']);

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
    blocks.push({ index, block: text.slice(index, end + 2) });
    index = end + 2;
  }
  return blocks;
}

for (const file of walk(SECTION_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const fileRel = rel(file);

  for (const { index, block } of collectPipeBlocks(text)) {
    stats.pipeBlocks += 1;
    const line = lineNumber(text, index);

    for (const prop of ['radius', 'color', 'flowType', 'animated']) {
      if (!new RegExp(`\\b${prop}=`).test(block)) {
        issues.push(`${fileRel}:${line} Pipe3D missing ${prop}; pipe visual semantics must be explicit`);
      }
    }

    const flowType = block.match(/flowType="([^"]+)"/)?.[1];
    if (!flowType) {
      issues.push(`${fileRel}:${line} Pipe3D flowType must be a string literal for static audit`);
      continue;
    }
    if (!ALLOWED_FLOW_TYPES.has(flowType)) {
      issues.push(`${fileRel}:${line} Pipe3D flowType="${flowType}" is not one of ${[...ALLOWED_FLOW_TYPES].join(', ')}`);
    }
    stats.flowTypes.set(flowType, (stats.flowTypes.get(flowType) ?? 0) + 1);
  }
}

const flowTypeSummary = [...stats.flowTypes.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, count]) => `${key}=${count}`)
  .join(', ');

console.log(`Pipe visual semantics: pipeBlocks=${stats.pipeBlocks}, flowTypes=[${flowTypeSummary}]`);

if (issues.length > 0) {
  console.error('\nPipe visual semantics issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All Pipe3D section blocks declare explicit visual semantics.');
}
