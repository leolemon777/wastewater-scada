import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = path.join(ROOT, 'src');

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

const offenders = [];

for (const file of walk(SCAN_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  let index = 0;

  while ((index = text.indexOf('useScadaStore(', index)) >= 0) {
    const before = text.slice(0, index);
    const line = before.split('\n').length;
    const snippet = text.slice(index, index + 320).replace(/\s+/g, ' ');

    if (
      /=>\s*\(\s*\{/.test(snippet) ||
      /=>\s*\[/.test(snippet) ||
      /return\s*\{/.test(snippet) ||
      /return\s*\[/.test(snippet)
    ) {
      offenders.push({ file: normalize(file), line, snippet });
    }

    index += 'useScadaStore('.length;
  }
}

if (offenders.length > 0) {
  console.error('Potential unstable Zustand selectors found.');
  console.error('Selectors should return primitives or stable references, not fresh objects/arrays.');
  for (const offender of offenders) {
    console.error(`- ${offender.file}:${offender.line}`);
    console.error(`  ${offender.snippet}`);
  }
  process.exitCode = 1;
} else {
  console.log('No obvious unstable Zustand object/array selectors found.');
}
