import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

const networkText = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const mainProcessText = read('src/components/scene/sections/MainProcessSection.tsx');
const flowMapText = read('docs/architecture/pipe-flow-map.md');
const issues = [];

const forbiddenNetworkTokens = [
  'PIPE_COLORS.processWater',
  'FLOC_OUTLET',
  'CLARIFIER_INLET',
  'CLARIFIER_OUTLET',
  'PH3_INLET',
  'PH3_OUTLET',
  'INTERMEDIATE_INLET',
  'PROCESS_CORRIDOR_Z',
  'facingWallBridge',
];

for (const token of forbiddenNetworkTokens) {
  if (networkText.includes(token)) {
    issues.push(`External PH1-to-intermediate process-water routing returned: ${token}`);
  }
}

if (!networkText.includes('PH1 → intermediate basin transfers are overflow/civil channels.')) {
  issues.push('Process network must retain the overflow/civil-channel contract comment');
}

const cascadeCount = (mainProcessText.match(/<OverflowCascade3D\b/g) ?? []).length;
if (cascadeCount < 4) {
  issues.push(`Expected at least 4 modelled overflow cascades in the adjacent basin train, found ${cascadeCount}`);
}

if (
  !flowMapText.includes(
    'PH1 → 芬顿 → PH2 → 混凝 → 絮凝 → 沉淀 → PH3 → 中间池整段按溢流/土建连通处理',
  )
) {
  issues.push('Pipe flow map must document the full PH1-to-intermediate overflow/civil route');
}
if (!flowMapText.includes('禁止补画外部闭式工艺水管')) {
  issues.push('Pipe flow map must explicitly forbid restoring external closed process-water pipes');
}

console.log(
  `Main-process overflow contract: cascades=${cascadeCount}, forbiddenExternalTokens=${forbiddenNetworkTokens.length}`,
);

if (issues.length > 0) {
  console.error('\nMain-process overflow-only issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('PH1 through intermediate remains overflow/civil-only with no external process-water pipes.');
}
