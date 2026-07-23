import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CSS = path.join(ROOT, 'src/styles/index.css');
const text = fs.readFileSync(CSS, 'utf8');
const issues = [];

const FORBIDDEN_CSS_GRADIENT_RE = /\b(?:linear|radial|conic)-gradient\s*\(/g;

function lineNumber(index) {
  return text.slice(0, index).split('\n').length;
}

let match;
while ((match = FORBIDDEN_CSS_GRADIENT_RE.exec(text)) !== null) {
  issues.push(`src/styles/index.css:${lineNumber(match.index)} decorative CSS gradient "${match[0]}" is not allowed in the SCADA UI shell`);
}

console.log('Decorative CSS gradient guard: scanned src/styles/index.css');

if (issues.length > 0) {
  console.error('\nDecorative CSS gradient issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('No decorative CSS gradients are used in the UI shell.');
}
