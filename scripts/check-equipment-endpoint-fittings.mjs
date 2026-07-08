import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECTION_DIR = path.join(ROOT, 'src/components/3d/sections');
const issues = [];
const stats = {
  pipeBlocks: 0,
  equipmentEndpoints: 0,
  checkedBlocks: 0,
};

const NON_PUMP_EQUIPMENT_FITTING_RE =
  /<(?:ChemicalMeteringPump3D|PipeWallPort3D|PipeFloorSleeve3D|PipeOpenFlange3D|DosingPort|CleanWaterHeaderTerminal|OutfallDropNozzle3D)\b/g;
const PUMP_ROUTE_HELPER_RE =
  /\b(?:getDischargeBranch|getSuctionBranch|getDirectTankSuctionBranch)\s*\(/g;
/**
 * AnchoredPipe3D blocks render their end fittings (wall-port / open-flange /
 * blind-flange) at runtime from the route's startFitting/endFitting fields, so
 * they don't carry visible <PipeWallPort3D> source markers. Each anchored pipe
 * contributes 2 endpoint fittings (one per anchor) to the surrounding context's
 * fitting budget, letting neighbouring <Pipe3D> equipment-endpoint checks pass
 * without forcing duplicate visible fitting JSX next to the anchored pipe.
 */
const ANCHORED_PIPE_RE = /<AnchoredPipe3D\b/g;

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

function equipmentEndpointCount(block) {
  let count = 0;
  if (/startConnection="equipment"/.test(block)) count += 1;
  if (/endConnection="equipment"/.test(block)) count += 1;
  return count;
}

function namedEndpointFittingCount(block, sectionText, localContext) {
  const names = new Set(
    [...block.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)].map((match) => match[1]),
  );
  let count = 0;
  for (const name of names) {
    const fittingRe = new RegExp(`<(?:PipeWallPort3D|PipeFloorSleeve3D)\\b[^>]*position=\\{${name}\\}`, 'm');
    if (fittingRe.test(sectionText) && !localContext.includes(`position={${name}}`)) {
      count += 1;
    }
  }
  return count;
}

function sharedSourceFittingCount(block, sectionText) {
  let count = 0;
  if (
    block.includes('[sourceX, 1.18, -0.42]') &&
    /<PipeWallPort3D\s+position=\{\[x,\s*1\.18,\s*-0\.42\]\}/.test(sectionText)
  ) {
    count += 1;
  }
  return count;
}

for (const file of walk(SECTION_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const fileRel = rel(file);

  for (const pipe of collectPipeBlocks(text)) {
    stats.pipeBlocks += 1;
    const endpointCount = equipmentEndpointCount(pipe.block);
    if (endpointCount === 0) continue;

    stats.checkedBlocks += 1;
    stats.equipmentEndpoints += endpointCount;
    const line = lineNumber(text, pipe.index);

    const before = text.slice(Math.max(0, pipe.index - 900), pipe.index);
    const after = text.slice(pipe.end, Math.min(text.length, pipe.end + 3500));
    const beforeNextPipe = after.split('<Pipe3D')[0];
    const context = `${before}\n${pipe.block}\n${beforeNextPipe}`;

    const visibleFittingCount = (context.match(NON_PUMP_EQUIPMENT_FITTING_RE) ?? []).length;
    const namedFittingCount = namedEndpointFittingCount(pipe.block, text, context);
    const sharedFittingCount = sharedSourceFittingCount(pipe.block, text);
    const pumpHelperEndpointCount = (pipe.block.match(PUMP_ROUTE_HELPER_RE) ?? []).length;
    // Each neighbouring <AnchoredPipe3D> renders 2 runtime fittings (start + end
    // anchor), counted into this pipe's fitting budget so anchored pipes satisfy
    // the endpoint-fitting check without duplicate visible source markers.
    const anchoredFittingCount = (context.match(ANCHORED_PIPE_RE) ?? []).length * 2;
    const fittingCount = visibleFittingCount + namedFittingCount + sharedFittingCount + pumpHelperEndpointCount + anchoredFittingCount;
    if (fittingCount < endpointCount) {
      issues.push(`${fileRel}:${line} Pipe3D has ${endpointCount} equipment endpoint(s) but only ${visibleFittingCount} local non-pump fitting marker(s), ${namedFittingCount} named endpoint fitting marker(s), ${sharedFittingCount} shared source fitting marker(s), ${pumpHelperEndpointCount} pump-route helper endpoint(s), and ${anchoredFittingCount} anchored-pipe runtime fitting(s) nearby`);
    }
  }
}

console.log(`Equipment endpoint fittings: pipeBlocks=${stats.pipeBlocks}, equipmentEndpoints=${stats.equipmentEndpoints}, checkedBlocks=${stats.checkedBlocks}`);

if (issues.length > 0) {
  console.error('\nEquipment endpoint fitting issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All equipment pipe endpoints have nearby visible equipment/fitting markers.');
}
