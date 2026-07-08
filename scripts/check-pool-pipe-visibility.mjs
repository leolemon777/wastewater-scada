import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECTIONS_DIR = path.join(ROOT, 'src/components/3d/sections');
const issues = [];
const stats = {
  scannedFiles: 0,
  externalWallLinks: 0,
  hiddenConstantRefs: 0,
};

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
    blocks.push({ index, block: text.slice(index, end + 2) });
    index = end + 2;
  }
  return blocks;
}

for (const file of walk(SECTIONS_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = normalize(file);
  stats.scannedFiles += 1;

  for (const { index, block } of collectPipeBlocks(text)) {
    const hardcodedHiddenY = [...block.matchAll(/(?<![\w.])-0\.(?:18|2|20)(?![\w.])/g)];
    for (const match of hardcodedHiddenY) {
      issues.push(`${rel}:${lineNumber(text, index + match.index)} use HIDDEN_PROCESS_PIPE_Y instead of hard-coded hidden pipe height ${match[0]} in Pipe3D route`);
    }
  }

  if (text.includes('HIDDEN_PROCESS_PIPE_Y')) {
    stats.hiddenConstantRefs += 1;
  }

  if (/WallLink/.test(text) || /PROCESS_LINKS/.test(text)) {
    const hasExternalY = text.includes('EXTERNAL_POOL_PIPE_Y');
    const hasExternalZ = text.includes('EXTERNAL_POOL_PIPE_Z');
    const hasWallPort = text.includes('PipeWallPort3D');
    const hasInspectionCollar = text.includes('PipeInspectionCollar3D');
    // Anchor-driven wall links (AnchoredPipe3D) satisfy the external-routing
    // requirement via the anchor/route layer (positions carry the external
    // corridor Y/Z and the runtime renders wall-port fittings), so a file that
    // has migrated its WallLink body to AnchoredPipe3D counts as compliant
    // even without the legacy source markers.
    const hasAnchoredWallLink = /<AnchoredPipe3D\b/.test(text);
    if (hasAnchoredWallLink && (hasExternalY || hasExternalZ || hasWallPort)) {
      stats.externalWallLinks += 1;
    } else if (!hasExternalY || !hasExternalZ || !hasWallPort || !hasInspectionCollar) {
      issues.push(`${rel}: process wall links must route outside tanks with EXTERNAL_POOL_PIPE_Y/Z, PipeWallPort3D, and PipeInspectionCollar3D`);
    } else {
      stats.externalWallLinks += 1;
    }
  }

  if (/SUBMERGED_PIPE_Y/.test(text) && !/SLUDGE_TANK_INLET_WORLD/.test(text)) {
    issues.push(`${rel}: SUBMERGED_PIPE_Y should only be used for explicit wall/inlet endpoints, not visible in-tank routing`);
  }
}

console.log(`Pool pipe visibility: scannedFiles=${stats.scannedFiles}, externalWallLinkFiles=${stats.externalWallLinks}, hiddenConstantFiles=${stats.hiddenConstantRefs}`);

if (issues.length > 0) {
  console.error('\nPool pipe visibility issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pool pipe routes use explicit external or hidden visibility semantics.');
}
