import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECTIONS_DIR = path.join(ROOT, 'src/components/3d/sections');
const FITTING_COMPONENT_RE =
  /<(?<component>Pipe(?:WallPort|FloorSleeve|OpenFlange|BlindFlange|InspectionCollar)3D)\b(?<attrs>[\s\S]*?)\/>/g;
const POSITION_RE = /position=\{(?<position>\[[\s\S]*?\]|[A-Za-z_$][\w$.]*)\}/m;

const issues = [];
const stats = {
  files: 0,
  fittings: 0,
  uniqueKeys: 0,
};

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function normalizePosition(position) {
  return position
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\{\s*/g, '{')
    .replace(/\s*\}/g, '}')
    .trim();
}

for (const file of walk(SECTIONS_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const fileRel = rel(file);
  const seen = new Map();
  stats.files += 1;

  let match;
  while ((match = FITTING_COMPONENT_RE.exec(text)) !== null) {
    const component = match.groups.component;
    const attrs = match.groups.attrs;
    const positionMatch = attrs.match(POSITION_RE);
    const line = lineNumber(text, match.index);

    stats.fittings += 1;

    if (!positionMatch) {
      issues.push(`${fileRel}:${line} ${component} missing explicit position prop`);
      continue;
    }

    const position = normalizePosition(positionMatch.groups.position);
    const key = `${component}|${position}`;
    const first = seen.get(key);

    if (first) {
      issues.push(`${fileRel}:${line} duplicate ${component} at position ${position}; first declared at line ${first.line}`);
    } else {
      seen.set(key, { line });
    }
  }

  stats.uniqueKeys += seen.size;
}

console.log(`Duplicate pipe fitting guard: files=${stats.files}, fittings=${stats.fittings}, uniqueKeys=${stats.uniqueKeys}`);

if (issues.length > 0) {
  console.error('\nDuplicate pipe fitting issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('No duplicate same-type pipe fitting declarations share the same position in section files.');
}
