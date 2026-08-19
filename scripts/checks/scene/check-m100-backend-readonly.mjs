import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const transport = read('services/ScadaHub/Adapters/M100/HttpM100IOTransport.cs');
const collector = read('services/ScadaHub/Adapters/M100/M100Collector.cs');
const endpoints = read('services/ScadaHub/Api/M100Endpoints.cs');
const program = read('services/ScadaHub/Program.cs');
const publisher = read('services/ScadaHub/Realtime/ScadaWebSocketPublisher.cs');
const appSettings = JSON.parse(read('services/ScadaHub/appsettings.json'));
const example = JSON.parse(read('services/ScadaHub/appsettings.local.example.json'));
const gitignore = read('.gitignore');
const store = read('src/store/useScadaStore.ts');
const m100Store = read('src/store/m100Realtime.ts');
const app = read('src/app/App.tsx');

// 1. 传输层只读：仅 GET ioread.cgi，禁止任何写端点
assert.match(transport, /ioread\.cgi\?read/);
assert.doesNotMatch(transport, /iowrite/i);
assert.doesNotMatch(transport, /PostAsync|PutAsync|DeleteAsync|SendAsync.*HttpContent/);

// 2. 采集器只广播，不写设备
assert.match(collector, /ReadIOAsync/);
assert.doesNotMatch(collector, /iowrite/i);

// 3. REST 端点 GET-only
assert.match(endpoints, /MapGet/);
assert.doesNotMatch(endpoints, /MapPost|MapPut|MapPatch|MapDelete|MapDelete/);

// 4. Program 注册完整且验证器生效
assert.match(program, /M100Options/);
assert.match(program, /M100OptionsValidator/);
assert.match(program, /AddHostedService<M100PollingService>/);
assert.match(program, /MapM100Endpoints/);

// 5. WebSocket 建连回放 M100 初始帧（多源）
assert.match(publisher, /GetAllSnapshotEnvelopes/);

// 6. appsettings 默认禁用且不携带 IP/凭据；example 仅占位
assert.equal(appSettings.M100.Enabled, false);
for (const device of appSettings.M100.Devices) {
  assert.equal(device.IpAddress, '');
  assert.equal(device.Username, '');
  assert.equal(device.Password, '');
}
assert.equal(example.M100.Enabled, false);
for (const device of example.M100.Devices) {
  assert.equal(device.Username, '');
  assert.equal(device.Password, '');
}
assert.match(gitignore, /appsettings\.local\.json/);

// 7. 前端 demo 互斥：真实 M100 帧接管设备后 wastewater demo tick 不再覆盖
assert.match(store, /m100LiveEquipmentIds/);
assert.match(store, /m100LiveEquipmentIds\.includes\(id\)/);
assert.match(store, /ingestM100Telemetry/);
assert.match(store, /refreshM100Connections/);
assert.match(app, /onM100Telemetry/);
assert.match(app, /refreshM100Connections/);

// 8. store 映射单向：只产 patch，不存在反向写路径
assert.match(m100Store, /m100EquipmentPatches/);
assert.doesNotMatch(m100Store, /iowrite|WebSocket\.send|fetch\(/);

console.log('[check] m100 backend readonly + demo mutex: assertions passed');
