import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.join(process.cwd(), 'src/services/scadaRealtimeClient.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
  fileName: sourcePath,
});

const m100StorePath = path.join(process.cwd(), 'src/store/m100Realtime.ts');
const m100StoreSource = fs.readFileSync(m100StorePath, 'utf8');
const m100Transpiled = ts.transpileModule(m100StoreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
  fileName: m100StorePath,
}).outputText;

const m100Url = `data:text/javascript;base64,${Buffer.from(m100Transpiled).toString('base64')}`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText.replace("from '../store/m100Realtime'", `from '${m100Url}'`)).toString('base64')}`;
const realtime = await import(moduleUrl);

const live = realtime.decodeScadaRealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'purewater.plc.snapshot',
  sourceId: 'purewater-plc-01',
  payload: {
    enabled: true,
    connected: true,
    adapterLabel: 'runtime-check',
    receivedAt: 1234,
    sequence: 9,
    bits: { X000: true, Y002: 1, ignored: 'bad' },
    words: { D51: 64, D52: null, ignored: 'bad' },
    rawWords: { D51: 64, D52: 65535, ignored: 'bad' },
  },
}));

assert.equal(live.enabled, true);
assert.equal(live.connected, true);
assert.deepEqual(live.bits, { X000: true, Y002: 1 });
assert.deepEqual(live.words, { D51: 64, D52: null });
assert.deepEqual(live.rawWords, { D51: 64, D52: 65535 });

const disconnected = realtime.decodeScadaRealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'source.status',
  sourceId: 'purewater-plc-01',
  payload: { enabled: true, connected: false, receivedAt: 1234, sequence: 9 },
}));
assert.deepEqual(disconnected, { enabled: true, connected: false, receivedAt: 1234, sequence: 9 });

const disabled = realtime.decodeScadaRealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'purewater.plc.snapshot',
  sourceId: 'purewater-plc-01',
  payload: { enabled: false, connected: false, sequence: 0, bits: {}, words: {} },
}));
assert.equal(disabled.enabled, false);

assert.equal(realtime.decodeScadaRealtimeMessage('{bad json'), null);
assert.equal(realtime.decodeScadaRealtimeMessage(JSON.stringify({
  schema: 'scada.v2',
  messageType: 'purewater.plc.snapshot',
  sourceId: 'purewater-plc-01',
  payload: {},
})), null);
assert.equal(realtime.decodeScadaRealtimeMessage(JSON.stringify({
  schema: 'scada.v1',
  messageType: 'purewater.plc.snapshot',
  sourceId: 'another-source',
  payload: {},
})), null);

console.log('[check] pure-water realtime client: 7 assertions passed');
