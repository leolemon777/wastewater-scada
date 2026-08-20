// SPEC-PLAN WP1 / 15：只读试运行 UI 静态守卫。
// 断言现场 UI 无控制入口、无执行性文案、无固定正常值回退、
// Y/DO 指令不驱动物理运行表现、store 不暴露到 window。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const overlay = read('src/components/ui/Overlay.tsx');
const dashboard = read('src/components/ui/DataDashboard.tsx');
const dashboardParts = read('src/components/ui/dashboard-parts.tsx');
const dafTank = read('src/components/scene/equipment/DAFTank3D.tsx');
const pureWaterPump = read('src/components/scene/equipment/PureWaterPump3D.tsx');
const main = read('src/main.tsx');
const realtimeClient = read('src/services/scadaRealtimeClient.ts');

// 1. 现场 UI 不调用任何设备 mutation action
const uiSources = { overlay, dashboard, dashboardParts, dafTank, pureWaterPump };
for (const [name, source] of Object.entries(uiSources)) {
  for (const action of ['toggleEquipmentRunStatus', 'toggleValve', 'toggleAgitator', 'toggleAeration', 'toggleScraper']) {
    assert.equal(source.includes(action), false, `${name} 不得调用 ${action}`);
  }
}

// 2. 执行性/授权性文案不存在
for (const [name, source] of Object.entries({ ...uiSources, main, dashboardParts })) {
  for (const phrase of ['强制启动', '紧急联锁停机', '立即切断', '点击启动', '点击停机', '关闭演示后可手动控制']) {
    assert.equal(source.includes(phrase), false, `${name} 不得出现文案「${phrase}」`);
  }
}
assert.equal(dashboard.includes('设备集控'), false, '「设备集控」必须改为「设备状态」');
assert.equal(dashboard.includes('设备状态'), true, '仪表盘必须显示「设备状态」分区');
assert.equal(overlay.includes('只读监视｜未开放设备控制'), true, '顶栏必须固定显示只读标识');

// 3. 生产路径无固定 pH 正常值回退（SPEC 9.3 / 15）
assert.equal(dafTank.includes("|| '7.20'"), false, 'DAF 面板不得有固定 pH 7.20 回退');
assert.equal(dafTank.includes("|| '7.0'"), false, 'DAF 面板不得有固定 pH 7.0 回退');
assert.equal(dafTank.includes("?? '--'"), true, 'pH 缺值必须显示 --');

// 4. Y/DO 指令不驱动物理运行表现（SPEC 5.6 / 9.1）
assert.equal(dafTank.includes('uWaveIntensity: { value: tankData.aerationRunning'), false,
  'DO 指令不得驱动水面波纹动画');
assert.equal(dafTank.includes('active={Boolean(tankData.scraperRunning)}'), false,
  'DO 指令不得驱动刮沫机/排渣动画');
assert.equal(dafTank.includes("opacity={tankData.aerationRunning"), false,
  'DO 指令不得驱动气泡强度');
assert.equal(dafTank.includes('逻辑输出'), true, 'DAF 面板必须用「逻辑输出」语义展示 DO');
assert.equal(dafTank.includes('物理运行未验证'), true, 'DAF 面板必须标注物理运行未验证');
assert.equal(pureWaterPump.includes("runStatus === 'running' ? 'running'"), false,
  'PLC Y 不得点亮纯水泵运行灯');

// 5. store 不暴露 window；开关控件已替换为状态标签
assert.equal(main.includes('__scadaStore'), false, '不得暴露 window.__scadaStore');
for (const [name, source] of Object.entries(uiSources)) {
  assert.equal(source.includes('scada-switch'), false, `${name} 不得再使用开关控件 scada-switch`);
}

// 6. 实时客户端不构造任何写请求
assert.equal(realtimeClient.toLowerCase().includes('iowrite'), false, '客户端不得出现 iowrite');
assert.equal(realtimeClient.includes('.send('), false, 'WebSocket 客户端不得主动发送业务帧');

console.log('[check] readonly-trial UI guard: assertions passed');
