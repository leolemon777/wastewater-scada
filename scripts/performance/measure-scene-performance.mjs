// measure-scene-performance.mjs —— SPEC-PLAN 16.3（WP6.0）3D 性能测量。
// 用法：npm run perf:scene [-- --quick]（开发基线用 --quick；硬门槛验收用完整参数并只认目标工控机结果）
// 机制：Node 静态服务 dist -> Playwright(msedge, 1920x1080@100%, 硬件加速) ->
//       逐相机位 set camera/controls -> 预热 -> rAF 采样 frame time 分位数 +
//       renderer.info(calls/triangles/geometries/textures) + context loss 计数。
// 输出：scripts/performance/results/<timestamp>.json + 控制台摘要。
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..', '..');
const profile = JSON.parse(fs.readFileSync(path.join(__dirname, 'scene-profile.json'), 'utf8'));

const quick = process.argv.includes('--quick');
const sampling = quick ? profile.sampling.quickOverride : profile.sampling;
const viewport = profile.targetMachine.viewport;

const dist = path.join(repo, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ 不存在，先 npm run build');
  process.exit(1);
}

// --- 极简静态服务（dist，SPA fallback） ---
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(dist, urlPath);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`静态服务: http://127.0.0.1:${port}（模式: ${quick ? 'QUICK（非验收）' : 'FULL'}，采样 ${sampling.warmupSeconds}s 预热 + ${sampling.sampleSeconds}s × ${sampling.rounds} 轮/位）`);

// --- 浏览器 ---
const browser = await chromium.launch({ channel: 'msedge', headless: false });
const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
const contextLosses = [];
page.on('console', (message) => {
  if (message.text().includes('webglcontextlost')) contextLosses.push(Date.now());
});

await page.goto(`http://127.0.0.1:${port}/?perf=1`, { waitUntil: 'load', timeout: 60_000 });
// 等待渲染钩子就绪
await page.waitForFunction(() => window.__scadaGl && window.__scadaCamera && window.__scadaControls, null, { timeout: 60_000 });
console.log('渲染钩子就绪（__scadaGl/__scadaCamera/__scadaControls）');

// 注入 rAF 采样器与 context-loss 监听
const INJECT = () => {
  window.__perfSamples = [];
  window.__perfArmed = false;
  let last = performance.now();
  const loop = (now) => {
    if (window.__perfArmed) window.__perfSamples.push(now - last);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.log('webglcontextlost observed');
  });
};
await page.evaluate(INJECT);

const results = { capturedAt: new Date().toISOString(), mode: quick ? 'quick' : 'full', machine: 'dev-workstation (baseline)', cameras: [] };

for (const camera of profile.cameras) {
  await page.evaluate(([position, target]) => {
    const cam = window.__scadaCamera;
    const controls = window.__scadaControls;
    cam.position.set(...position);
    controls.target.set(...target);
    controls.update();
    window.__perfArmed = false;
    window.__perfSamples = [];
    // renderer.info 复位（autoReset 默认开，读每帧值即可）
  }, [camera.position, camera.target]);

  const roundResults = [];
  for (let round = 1; round <= sampling.rounds; round++) {
    await page.waitForTimeout(sampling.warmupSeconds * 1000);
    const sample = await page.evaluate(async (seconds) => {
      window.__perfSamples = [];
      window.__perfArmed = true;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      window.__perfArmed = false;
      const times = [...window.__perfSamples].sort((a, b) => a - b);
      const pick = (p) => (times.length ? times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))] : null);
      const gl = window.__scadaGl;
      return {
        frames: times.length,
        fps: times.length ? times.length / seconds : 0,
        frameTimeMsP50: pick(50),
        frameTimeMsP95: pick(95),
        frameTimeMsP99: pick(99),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        pixelRatio: gl.getPixelRatio(),
      };
    }, sampling.sampleSeconds);
    roundResults.push(sample);
  }

  const avg = (key) => roundResults.reduce((sum, r) => sum + (r[key] ?? 0), 0) / roundResults.length;
  const worst = (key, dir) => dir === 'min' ? Math.min(...roundResults.map(r => r[key] ?? 0)) : Math.max(...roundResults.map(r => r[key] ?? 0));
  const entry = {
    camera: camera.id,
    label: camera.label,
    rounds: roundResults,
    summary: {
      fpsMin: worst('fps', 'min'),
      frameTimeMsP95Worst: worst('frameTimeMsP95', 'max'),
      drawCallsAvg: Math.round(avg('drawCalls')),
      trianglesAvg: Math.round(avg('triangles')),
      geometries: roundResults.at(-1)?.geometries ?? 0,
      textures: roundResults.at(-1)?.textures ?? 0,
      pixelRatio: roundResults.at(-1)?.pixelRatio ?? null,
    },
  };
  results.cameras.push(entry);
  console.log(`[${camera.label}] FPS(min)=${entry.summary.fpsMin.toFixed(1)} P95(worst)=${entry.summary.frameTimeMsP95Worst?.toFixed(1)}ms calls=${entry.summary.drawCallsAvg} tris=${entry.summary.trianglesAvg} geos=${entry.summary.geometries} tex=${entry.summary.textures}`);
}

results.contextLoss = contextLosses.length;

const resultsDir = path.join(__dirname, 'results');
fs.mkdirSync(resultsDir, { recursive: true });
const outFile = path.join(resultsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}${quick ? '-quick' : ''}.json`);
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(`\n结果: ${outFile}`);
console.log(`Context loss: ${contextLosses.length}`);
console.log(quick ? '（QUICK 模式：开发基线趋势用，非 SPEC 16.3 验收）' : '（FULL 模式：硬门槛判定仅认目标工控机同配置结果）');

await browser.close();
server.close();
