import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'src/app/App.tsx');
const STORE = path.join(ROOT, 'src/store/useScadaStore.ts');

const appText = fs.readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');
const storeText = fs.readFileSync(STORE, 'utf8').replace(/\r\n/g, '\n');
const issues = [];

function has(pattern, label) {
  if (!pattern.test(appText) && !pattern.test(storeText)) {
    issues.push(label);
  }
}

if (!/performanceMode:\s*false/.test(storeText)) {
  issues.push('useScadaStore default performanceMode must stay false so the 3D view opens in high-quality mode');
}

if (!/scenePaletteMode:\s*'bright'/.test(storeText)) {
  issues.push('useScadaStore default scenePaletteMode must stay bright for the daytime realistic station palette');
}

if (!/function\s+getCanvasDpr\s*\(\s*performanceMode:\s*boolean\s*\)/.test(appText)) {
  issues.push('App.tsx must keep a dedicated getCanvasDpr(performanceMode) helper');
}

has(/if\s*\(\s*performanceMode\s*\)\s*return\s+Math\.min\(deviceDpr,\s*1\.5\)/, 'performance mode DPR cap should remain <= 1.5 (raised from 1.25 to avoid visible softness on high-DPI displays)');
has(/return\s+Math\.min\(Math\.max\(deviceDpr,\s*2\),\s*2\)/, 'high-quality DPR must super-sample at 2x for crisp close-up edges (clarity is non-negotiable; perf wins come from MSAA/shadows, not lowering render resolution)');
has(/shadows=\{/, 'Canvas shadows must stay configured (high-quality enables shadow maps; navigation may gate them off as an intentional optimisation)');
has(/antialias:\s*true/, 'Canvas WebGL antialias must stay enabled');
has(/powerPreference:\s*'high-performance'/, 'Canvas should request high-performance GPU preference');
has(/toneMapping:\s*THREE\.ACESFilmicToneMapping/, 'Canvas should use ACESFilmic tone mapping per spec');
has(/THREE\.Texture\.DEFAULT_ANISOTROPY\s*=\s*Math\.min\(8,\s*maxAniso\)/, 'texture anisotropy should stay enabled for sharper close-up floor/wall views');
has(/\{!performanceMode\s*&&\s*<Preload all\s*\/>\}/, 'high-quality mode should keep preloading scene assets');
has(/from\s+'@react-three\/postprocessing'/, '@react-three/postprocessing must be imported for edge anti-aliasing');
// SPEC-PLAN 16.2（WP6）：删除无 Effect 的 EffectComposer——AA 由 Canvas 原生
// antialias:true（上行断言）承担；效果 composer 不再默认挂载。

console.log('Scene render quality defaults: performanceMode=false, palette=bright, highQualityDpr=2x, native antialias + percentage shadows; perf-mode: DPR<=1.25, shadows off (SPEC 16.2)');

if (issues.length > 0) {
  console.error('\nScene render quality issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Scene render quality defaults and close-up clarity guards are in place.');
}
