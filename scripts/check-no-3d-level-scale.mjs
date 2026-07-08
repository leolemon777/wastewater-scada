import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const THREE_D_DIR = path.join(ROOT, 'src/components/3d');
const issues = [];
const stats = {
  files: 0,
};

const FORBIDDEN_PATTERNS = [
  { re: />\s*100%\s*</, label: '100% 3D level tick' },
  { re: />\s*75%\s*</, label: '75% 3D level tick' },
  { re: />\s*50%\s*</, label: '50% 3D level tick' },
  { re: />\s*25%\s*</, label: '25% 3D level tick' },
  { re: />\s*0%\s*</, label: '0% 3D level tick' },
  { re: /液位百分比/, label: '3D liquid-level percentage label' },
  { re: /液位刻度|液位标尺|level\s*scale|level\s*tick/i, label: '3D level scale marker' },
];

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
  stats.files += 1;
  const text = fs.readFileSync(file, 'utf8');
  for (const { re, label } of FORBIDDEN_PATTERNS) {
    const match = text.match(re);
    if (match?.index !== undefined) {
      issues.push(`${rel(file)}:${lineNumber(text, match.index)} forbidden ${label}`);
    }
  }
}

console.log(`3D level scale guard: scannedFiles=${stats.files}`);

if (issues.length > 0) {
  console.error('\n3D level scale issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('No 3D pool wall percentage level scales are present.');
}
