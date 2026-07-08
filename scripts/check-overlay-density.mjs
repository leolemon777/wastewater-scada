import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'src/App.tsx');
const CSS = path.join(ROOT, 'src/index.css');

const appText = fs.readFileSync(APP, 'utf8');
const cssText = fs.readFileSync(CSS, 'utf8');
const issues = [];

function requireText(text, pattern, message) {
  if (!pattern.test(text)) issues.push(message);
}

requireText(appText, /function\s+shouldUseCompactOverlay\s*\(\s*\)/, 'App.tsx must keep shouldUseCompactOverlay()');
requireText(appText, /uiDensity'\)\s*===\s*'full'/, 'compact overlay must allow forcing full density via query param');
requireText(appText, /uiDensity'\)\s*===\s*'compact'/, 'compact overlay must allow forcing compact density via query param');
requireText(appText, /window\.innerWidth\s*<=\s*1280/, 'compact overlay must activate only for narrow layouts');
requireText(appText, /function\s+getOverlayScale\s*\(\s*\)/, 'App.tsx must keep getOverlayScale() for overlay scale compensation');
requireText(appText, /return\s+1;\s*\/\/|return\s+1;\s*$/m, 'overlay scale must return 1 (no non-integer transform scale, which causes sub-pixel blur)');
requireText(appText, /document\.documentElement\.style\.setProperty\('--overlay-scale'/, 'App.tsx must write --overlay-scale at runtime');
requireText(appText, /document\.documentElement\.style\.setProperty\('--view-preset-scale'/, 'App.tsx must write --view-preset-scale at runtime');
requireText(appText, /document\.documentElement\.style\.setProperty\('--zoom-tool-scale'/, 'App.tsx must write --zoom-tool-scale at runtime');
requireText(appText, /document\.documentElement\.dataset\.uiDensity\s*=\s*shouldUseCompactOverlay\(\)\s*\?\s*'compact'\s*:\s*'full'/, 'App.tsx must write html[data-ui-density] at runtime');
requireText(appText, /window\.addEventListener\('resize',\s*updateDensity\)/, 'compact overlay density must update on resize');
requireText(appText, /window\.visualViewport\?\.addEventListener\('resize',\s*updateDensity\)/, 'compact overlay scale must update on visualViewport resize');

// Token defaults + the load-bearing compact topbar-height override (read by every
// top-anchored overlay: dashboard, equipment drawer, legend). Per-class topbar
// sizing is owned by the live scada-shell.css components (scada-topbar-v2),
// so those specific selectors are no longer asserted here.
requireText(cssText, /html\[data-ui-density='compact'\]\s*\{\s*--topbar-height:\s*48px;/, 'compact density must force --topbar-height: 48px');
requireText(cssText, /--overlay-scale:\s*1;/, 'CSS must define --overlay-scale default');
requireText(cssText, /--view-preset-scale:\s*1;/, 'CSS must define --view-preset-scale default');
requireText(cssText, /--zoom-tool-scale:\s*1;/, 'CSS must define --zoom-tool-scale default');
requireText(cssText, /--topbar-height:\s*56px;/, 'full density must use a readable 56px topbar height');

console.log('Overlay density guard: runtime marker, compact topbar height, and scale token defaults checked.');

if (issues.length > 0) {
  console.error('\nOverlay density issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Overlay density guards are in place for readable desktop UI and narrow-layout compact mode.');
}
