import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG_FILE = path.join(ROOT, 'src/store/useScadaStore.ts');
const SCAN_DIRS = ['src/components', 'src/store'].map((dir) => path.join(ROOT, dir));

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalize(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

const catalogText = fs.readFileSync(CATALOG_FILE, 'utf8');
const equipmentIds = [...catalogText.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((match) => match[1]);
const scanFiles = SCAN_DIRS.flatMap((dir) => walk(dir));
const contentByFile = scanFiles.map((file) => [file, fs.readFileSync(file, 'utf8')]);

const uncovered = [];
const coverage = [];

for (const id of equipmentIds) {
  const refs = contentByFile
    .filter(([file, text]) => {
      const rel = normalize(file);
      return rel !== 'src/store/useScadaStore.ts' && text.includes(id);
    })
    .map(([file]) => normalize(file));

  const uniqueRefs = [...new Set(refs)];
  coverage.push({ id, refs: uniqueRefs });
  if (uniqueRefs.length === 0) uncovered.push(id);
}

if (uncovered.length > 0) {
  console.error('Equipment IDs with no non-catalog references:');
  for (const id of uncovered) console.error(`- ${id}`);
  process.exitCode = 1;
} else {
  console.log(`All ${equipmentIds.length} equipment IDs have at least one non-catalog reference.`);
}

const lowCoverage = coverage.filter(({ refs }) => refs.length === 1);
if (lowCoverage.length > 0) {
  console.log('\nIDs with only one non-catalog reference:');
  for (const { id, refs } of lowCoverage) {
    console.log(`- ${id}: ${refs[0]}`);
  }
}
