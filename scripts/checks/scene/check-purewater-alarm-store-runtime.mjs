import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = process.cwd();

function transpile(relativePath) {
  const fileName = path.join(ROOT, relativePath);
  const source = fs.readFileSync(fileName, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName,
  }).outputText;
}

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

const scenariosUrl = dataUrl(transpile('src/store/demoScenarios.ts'));
const plcUrl = dataUrl(transpile('src/store/pureWaterPlc.ts'));
const m100Url = dataUrl(transpile('src/store/m100Realtime.ts'));
const zustandUrl = pathToFileURL(path.join(ROOT, 'node_modules/zustand/esm/index.mjs')).href;

let storeSource = transpile('src/store/useScadaStore.ts');
storeSource = storeSource
  .replace("from 'zustand'", `from '${zustandUrl}'`)
  .replace("from './demoScenarios'", `from '${scenariosUrl}'`)
  .replace("from './pureWaterPlc'", `from '${plcUrl}'`)
  .replace("from './m100Realtime'", `from '${m100Url}'`);

const { useScadaStore } = await import(dataUrl(storeSource));
const clearAlarmBits = Object.fromEntries(
  Array.from({ length: 16 }, (_, index) => [`M${400 + index}`, false]),
);
const frameTime = Date.now();

useScadaStore.getState().ingestPureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime,
  sequence: 100,
  bits: {
    ...clearAlarmBits,
    X000: true,
    M400: true,
    M412: true,
    Y000: true,
  },
  words: { D51: 64, D52: 58 },
});

let state = useScadaStore.getState();
assert.equal(state.systemStatuses.purewater, 'critical');
assert.equal(state.systemStatuses.wastewater, 'normal');
assert.deepEqual(
  state.alarms.map((alarm) => [alarm.system, alarm.source, alarm.tagAddress, alarm.message]),
  [
    ['purewater', 'plc', 'M400', 'M400 · 原水泵高压'],
    ['purewater', 'plc', 'M412', 'M412 · 原水箱液位阈值顺序错误'],
  ],
);

useScadaStore.getState().ingestPureWaterPlcTelemetry({ connected: false });
state = useScadaStore.getState();
assert.equal(state.systemStatuses.purewater, 'unknown', 'a disconnected PLC cannot report a healthy/critical live status');
assert.equal(state.alarms.filter((alarm) => !alarm.cleared).length, 2, 'disconnect must not clear held active alarms');

useScadaStore.getState().ingestPureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 1_000,
  sequence: 101,
  bits: { ...clearAlarmBits, X000: true, Y000: false },
  words: { D51: 63, D52: 59 },
});
state = useScadaStore.getState();
assert.equal(state.systemStatuses.purewater, 'normal');
assert.equal(state.alarms.filter((alarm) => !alarm.cleared).length, 0);
assert.equal(state.alarms.filter((alarm) => alarm.cleared && alarm.acknowledged).length, 2);

useScadaStore.getState().ingestPureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 2_000,
  sequence: 102,
  bits: { ...clearAlarmBits, X000: true, M400: true, Y000: true },
  words: { D51: 63, D52: 59 },
});
state = useScadaStore.getState();
assert.equal(state.alarms.filter((alarm) => alarm.tagAddress === 'M400' && !alarm.cleared).length, 1);

useScadaStore.getState().updateEquipment('p-drain-1', { alarmState: 'critical' });
state = useScadaStore.getState();
assert.equal(state.systemStatuses.wastewater, 'critical');
assert.equal(state.systemStatuses.purewater, 'critical');
assert.equal(state.alarms.filter((alarm) => alarm.system === 'wastewater' && !alarm.cleared).length, 1);
assert.equal(state.alarms.filter((alarm) => alarm.system === 'purewater' && !alarm.cleared).length, 1);

console.log('Pure-water alarm store: exact PLC records, disconnect hold, RTN, re-raise, and system isolation verified.');
