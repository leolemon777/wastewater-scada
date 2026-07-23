import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PIPE_ROUTING = path.join(ROOT, 'src/components/scene/piping/pipeRouting.ts');
const text = fs.readFileSync(PIPE_ROUTING, 'utf8');

const REQUIRED_KEYS = [
  'rawWater',
  'processWater',
  'deepWater',
  'treatedWater',
  'cleanWater',
  'air',
  'sludge',
  'pac',
  'cacl2',
  'pam',
];
const MIN_DELTA_E = 20;
const issues = [];

const objectMatch = text.match(/export const PIPE_COLORS\s*=\s*\{([\s\S]*?)\}\s*as const;/);
if (!objectMatch) {
  issues.push('Missing export const PIPE_COLORS object in pipeRouting.ts');
}

const colors = {};
if (objectMatch) {
  for (const match of objectMatch[1].matchAll(/(\w+):\s*'(#(?:[0-9a-fA-F]{6}))'/g)) {
    colors[match[1]] = match[2].toUpperCase();
  }
}

for (const key of REQUIRED_KEYS) {
  if (!colors[key]) issues.push(`PIPE_COLORS missing ${key}`);
}

for (const key of Object.keys(colors)) {
  if (!REQUIRED_KEYS.includes(key)) issues.push(`PIPE_COLORS has unexpected key ${key}`);
}

const seen = new Map();
for (const [key, color] of Object.entries(colors)) {
  if (seen.has(color)) {
    issues.push(`PIPE_COLORS ${key} duplicates ${seen.get(color)} color ${color}`);
  }
  seen.set(color, key);
}

function hexToRgb(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function labFromHex(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(hexA, hexB) {
  const a = labFromHex(hexA);
  const b = labFromHex(hexB);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

let minPair = null;
let minDistance = Number.POSITIVE_INFINITY;
const entries = REQUIRED_KEYS.map((key) => [key, colors[key]]).filter(([, color]) => color);

for (let i = 0; i < entries.length; i += 1) {
  for (let j = i + 1; j < entries.length; j += 1) {
    const [keyA, colorA] = entries[i];
    const [keyB, colorB] = entries[j];
    const distance = deltaE(colorA, colorB);
    if (distance < minDistance) {
      minDistance = distance;
      minPair = `${keyA}/${keyB}`;
    }
    if (distance < MIN_DELTA_E) {
      issues.push(`PIPE_COLORS ${keyA} ${colorA} and ${keyB} ${colorB} are too similar: DeltaE=${distance.toFixed(1)} < ${MIN_DELTA_E}`);
    }
  }
}

console.log(`Pipe color distinction: keys=${Object.keys(colors).length}, minDeltaE=${Number.isFinite(minDistance) ? minDistance.toFixed(1) : 'n/a'} (${minPair ?? 'n/a'})`);

if (issues.length > 0) {
  console.error('\nPipe color distinction issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pipe categories use distinct industrial colors for close-up readability.');
}
