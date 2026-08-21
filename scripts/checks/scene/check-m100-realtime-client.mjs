import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// scadaRealtimeClient.ts 值导入 m100Realtime.ts，两个模块都 transpile 后以 data:URL 链接。
const transpile = (sourcePath) => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: sourcePath,
  });
  return outputText;
};

const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

const m100StoreCode = transpile(path.join(process.cwd(), 'src/store/m100Realtime.ts'));
const clientCode = transpile(path.join(process.cwd(), 'src/services/scadaRealtimeClient.ts'))
  .replace("from '../store/m100Realtime'", `from '${dataUrl(m100StoreCode)}'`);

const realtime = await import(dataUrl(clientCode));

// 1. 合法气浮帧：点位清洗与工程值透传
const daf = realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'm100.snapshot',
  sourceId: 'm100-daf-01',
  payload: {
    enabled: true,
    connected: true,
    adapterLabel: 'USR-M100 气浮前端只读适配器',
    receivedAt: 1786000000000,
    sequence: 3,
    do: { do01: 1, do02: 0, ignored: 'bad' },
    di: { di01: 0 },
    ai: { ai01: 9516 },
    points: { ph: 4.826 },
  },
}));
assert.equal(daf.sourceId, 'm100-daf-01');
assert.equal(daf.telemetry.connected, true);
assert.deepEqual(daf.telemetry.doPoints, { do01: 1, do02: 0 });
assert.deepEqual(daf.telemetry.aiPoints, { ai01: 9516 });
assert.deepEqual(daf.telemetry.points, { ph: 4.826 });

// 2. 地下池帧
const underground = realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'm100.snapshot',
  sourceId: 'm100-underground-01',
  payload: { connected: true, points: { level: 3.776 } },
}));
assert.equal(underground.sourceId, 'm100-underground-01');
assert.equal(underground.telemetry.points.level, 3.776);

// 3. 断连状态事件
const disconnected = realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'source.status',
  sourceId: 'm100-daf-01',
  payload: { enabled: true, connected: false, sequence: 3 },
}));
assert.deepEqual(disconnected.telemetry, { enabled: true, connected: false });

// 4. enabled=false 帧 → null（不入 store）
assert.equal(realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'm100.snapshot',
  sourceId: 'm100-daf-01',
  payload: { enabled: false, connected: true },
})).telemetry.enabled, false);

// 5. 坏 JSON / 错 schema / 错 sourceId / 缺 connected → null
assert.equal(realtime.decodeM100RealtimeMessage('{bad json'), null);
assert.equal(realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v2', messageType: 'm100.snapshot', sourceId: 'm100-daf-01', payload: {},
})), null);
assert.equal(realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v1', messageType: 'm100.snapshot', sourceId: 'm100-mixing-01', payload: {},
})), null);
assert.equal(realtime.decodeM100RealtimeMessage(JSON.stringify({
  schema: 'scada.v1', messageType: 'm100.snapshot', sourceId: 'm100-daf-01', payload: { enabled: true },
})), null);

// 6. 纯水解码不受 M100 改造影响
assert.equal(realtime.decodeScadaRealtimeMessage(JSON.stringify({
  schema: 'scada.v1', messageType: 'purewater.plc.snapshot', sourceId: 'm100-daf-01', payload: {},
})), null);

// 7. 设备映射：气浮 → tk-daf 运行状态与 pH；地下池 → tk-intermediate 液位百分比
const m100 = await import(dataUrl(m100StoreCode));
const dafPatches = m100.m100EquipmentPatches('m100-daf-01', {
  enabled: true, connected: true, doPoints: { do01: 1, do02: 0 }, points: { ph: 4.8 },
});
assert.equal(dafPatches['tk-daf'].aerationRunning, true);
assert.equal(dafPatches['tk-daf'].scraperRunning, false);
assert.equal(dafPatches['tk-daf'].pH, 4.8);

const undergroundPatches = m100.m100EquipmentPatches('m100-underground-01', {
  enabled: true, connected: true, points: { level: 3.776 },
});
assert.equal(undergroundPatches['tk-intermediate'].levelValue, 3.776);
assert.ok(Math.abs(undergroundPatches['tk-intermediate'].levelPercent - (3.776 / 4.75) * 100) < 0.01);

// 8. 连接看门狗阈值
const info = m100.getM100ConnectionInfo(
  { enabled: true, connected: true, receivedAt: Date.now() - 12_000 },
  Date.now(),
);
assert.equal(info.state, 'stale');

console.log('[check] m100 realtime client + store mapping: assertions passed');
