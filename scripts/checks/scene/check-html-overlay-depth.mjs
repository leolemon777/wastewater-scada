import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = path.join(ROOT, 'src/components/scene');
const MAX_HTML_Z = 80;

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

const issues = [];
const stats = {
  html: 0,
  explicitZ: 0,
  maxZ: 0,
};

for (const file of walk(SCAN_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = normalize(file);
  let index = 0;

  while ((index = text.indexOf('<Html', index)) >= 0) {
    const close = text.indexOf('>', index);
    if (close < 0) break;
    const tag = text.slice(index, close + 1);
    const line = lineNumber(text, index);
    stats.html += 1;

    if (!/zIndexRange=/.test(tag)) {
      issues.push(`${rel}:${line} Html overlay missing explicit zIndexRange`);
    } else {
      stats.explicitZ += 1;
      const matches = [...tag.matchAll(/\[\s*(\d+)/g)];
      for (const match of matches) {
        const value = Number(match[1]);
        stats.maxZ = Math.max(stats.maxZ, value);
        if (value > MAX_HTML_Z) {
          issues.push(`${rel}:${line} Html overlay zIndexRange starts at ${value}, expected <= ${MAX_HTML_Z}`);
        }
      }
    }

    index = close + 1;
  }
}

console.log(`3D Html overlays: total=${stats.html}, explicitZ=${stats.explicitZ}, maxDeclaredZ=${stats.maxZ}`);

if (issues.length > 0) {
  console.error('\n3D Html overlay depth issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All 3D Html overlays declare bounded zIndexRange.');
}
