import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_FILE = 'src/components/3d/Pump3D.tsx';
const text = fs.readFileSync(path.join(ROOT, PUMP_FILE), 'utf8');
const issues = [];

const start = text.indexOf('const PumpProcessFlanges:');
const end = text.indexOf('export const Pump3D:', start);
if (start < 0 || end < 0) {
  issues.push(`${PUMP_FILE}: missing PumpProcessFlanges block`);
}

const block = start >= 0 && end >= 0 ? text.slice(start, end) : '';
const cylinderRe = /<cylinderGeometry\s+args=\{\[([\s\S]*?)\]\}\s*\/>/g;
const cylinders = [];
let match;

while ((match = cylinderRe.exec(block)) !== null) {
  const nums = [...match[1].matchAll(/\b\d+(?:\.\d+)?\b/g)].map((part) => Number(part[0]));
  if (nums.length < 4) {
    issues.push(`${PUMP_FILE}: process flange cylinder has non-literal dimensions`);
    continue;
  }
  cylinders.push({
    radius: Math.max(nums[0], nums[1]),
    length: nums[2],
  });
}

const maxRadius = Math.max(...cylinders.map((c) => c.radius), 0);
const maxLength = Math.max(...cylinders.map((c) => c.length), 0);
const boltCount = (block.match(/key=\{`(?:suction|discharge)-bolt-\$\{index\}`\}/g) ?? []).length;

if (cylinders.length !== 8) {
  issues.push(`${PUMP_FILE}: expected 8 process-port cylinders, found ${cylinders.length}`);
}
if (boltCount !== 2) {
  issues.push(`${PUMP_FILE}: expected suction/discharge bolt maps, found ${boltCount}`);
}
if (maxRadius > 0.24) {
  issues.push(`${PUMP_FILE}: pump process flange radius ${maxRadius} exceeds 0.24`);
}
if (maxLength > 0.2) {
  issues.push(`${PUMP_FILE}: pump process flange/nozzle length ${maxLength} exceeds 0.2`);
}
if (!block.includes('x * 0.82') || !block.includes('z * 0.82')) {
  issues.push(`${PUMP_FILE}: pump process bolt circle should stay compact at 0.82 multiplier`);
}

console.log(`Pump process ports: cylinders=${cylinders.length}, maxRadius=${maxRadius}, maxLength=${maxLength}, boltMaps=${boltCount}`);

if (issues.length > 0) {
  console.error('\nPump process port proportion issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pump process ports stay within low-profile close-up limits.');
}
