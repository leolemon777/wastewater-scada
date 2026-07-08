import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const THREE_D_DIR = path.join(ROOT, 'src/components/3d');
const issues = [];
let scannedFiles = 0;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

for (const file of walk(THREE_D_DIR)) {
  scannedFiles += 1;
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/HolographicScanner3D|<HolographicScanner3D\b/);
  if (match?.index !== undefined) {
    issues.push(`${rel(file)}:${lineNumber(text, match.index)} holographic scanner selection effect is not allowed`);
  }
}

console.log(`Holographic scanner guard: scannedFiles=${scannedFiles}`);

if (issues.length > 0) {
  console.error('\nHolographic scanner issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('No holographic scanner selection effect is used in the 3D scene.');
}
