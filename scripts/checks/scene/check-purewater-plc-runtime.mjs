import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.join(process.cwd(), 'src/store/pureWaterPlc.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
  fileName: sourcePath,
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const plc = await import(moduleUrl);

const frameTime = 1_000_000;
const empty = plc.createEmptyPureWaterPlcSnapshot();
assert.equal(plc.getPureWaterPlcConnectionInfo(empty, frameTime).state, 'offline');

const valueSemantics = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime,
  sequence: 1,
  bits: { X000: false, X001: null },
  words: { D51: 0, D52: null },
  rawWords: { D51: 0, D52: 65535 },
});
assert.equal(valueSemantics.bits.X000, false, 'false is a valid PLC bit, not unknown');
assert.equal(valueSemantics.bits.X001, null, 'null must remain unknown');
assert.equal(valueSemantics.words.D51, 0, 'zero is a valid PLC word, not unknown');
assert.equal(valueSemantics.words.D52, null, 'invalid/unknown word must remain null');
assert.equal(valueSemantics.rawWords.D52, 65535, 'diagnostic raw value must survive qualification');

const live = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime,
  sequence: 17,
  adapterLabel: 'runtime-check',
  bits: { X000: true, Y002: true, M500: true },
  words: { D51: 64, D52: 58 },
  rawWords: { D51: 64, D52: 58 },
});

assert.equal(plc.getPureWaterPlcConnectionInfo(live, frameTime + 9_999).state, 'live');
assert.equal(plc.getPureWaterPlcConnectionInfo(live, frameTime + 10_001).state, 'stale');
assert.equal(plc.getPureWaterPlcConnectionInfo(live, frameTime + 30_001).state, 'disconnected');

const disconnected = plc.normalizePureWaterPlcTelemetry({ connected: false }, live);
assert.equal(disconnected.words.D51, 64, 'disconnect must keep the last successful D51 value');
assert.equal(disconnected.rawWords.D51, 64, 'disconnect must keep the last diagnostic raw D51 value');
assert.equal(disconnected.bits.Y002, true, 'disconnect must keep the last successful bit frame');
assert.equal(disconnected.receivedAt, frameTime, 'disconnect must not refresh the successful-frame timestamp');
assert.equal(disconnected.sequence, 17, 'disconnect must preserve the last successful sequence');
assert.equal(plc.getPureWaterPlcConnectionInfo(disconnected, frameTime + 1).state, 'disconnected');

const recovered = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 40_000,
  sequence: 18,
  bits: { X000: true, Y002: false, M500: true },
  words: { D51: 67, D52: 61 },
  rawWords: { D51: 67, D52: 61 },
}, disconnected);
assert.equal(plc.getPureWaterPlcConnectionInfo(recovered, frameTime + 40_100).state, 'live');
assert.equal(recovered.words.D51, 67);
assert.equal(recovered.sequence, 18);

const offline = plc.markPureWaterPlcOffline(recovered);
assert.equal(offline.source, 'offline');
assert.equal(offline.receivedAt, null);
assert.equal(offline.words.D51, null, 'offline/not-configured state must not expose a held demo value');
assert.equal(offline.rawWords.D51, null, 'offline/not-configured state must not expose a held raw value');
assert.equal(offline.bits.Y002, null, 'offline/not-configured state must render points as unknown');

const healthyDemo = plc.createPureWaterDemoPlcSnapshot({}, 1);
assert.equal(healthyDemo.bits.M404, false, 'healthy phase relay demo must keep M404 clear');
assert.equal(healthyDemo.bits.M412, false, 'demo must not invent a raw-tank threshold-order fault');
assert.equal(healthyDemo.bits.M415, false, 'demo must not invent an RO2 threshold-order fault');

const independentPumpFrame = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 45_000,
  sequence: 18,
  bits: {
    Y002: true,
    Y003: false,
    Y004: false,
    Y005: true,
    M400: false,
    M401: false,
    M402: false,
    M405: false,
    M406: true,
    M407: false,
  },
});
const independentPumpPatches = plc.pureWaterEquipmentPatchesFromPlc(independentPumpFrame, {});
assert.equal(independentPumpPatches['pw-p-raw-1'].runStatus, 'running', 'Y002 must drive raw pump A only');
assert.equal(independentPumpPatches['pw-p-raw-2'].runStatus, 'fault', 'M406 must fault raw pump B only');
assert.equal(independentPumpPatches['pw-p-ro1-1'].runStatus, 'stopped', 'Y004 must drive RO1 pump A only');
assert.equal(independentPumpPatches['pw-p-ro1-2'].runStatus, 'running', 'Y005 must drive RO1 pump B only');

const clearAlarmBits = Object.fromEntries(
  plc.PURE_WATER_PLC_ALARM_TAGS.map((tag) => [tag.address, false]),
);
const alarmsClear = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 50_000,
  sequence: 19,
  bits: clearAlarmBits,
});
const alarmsRaised = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 51_000,
  sequence: 20,
  bits: { ...clearAlarmBits, M400: true, M412: true },
}, alarmsClear);
assert.deepEqual(
  plc.getPureWaterPlcAlarmTransitions(alarmsClear, alarmsRaised)
    .map((transition) => `${transition.kind}:${transition.tag.address}`),
  ['raised:M400', 'raised:M412'],
  'each PLC M bit must retain its own rising edge and exact address',
);

const alarmsDisconnected = plc.normalizePureWaterPlcTelemetry({ connected: false }, alarmsRaised);
assert.deepEqual(
  plc.getPureWaterPlcAlarmTransitions(alarmsRaised, alarmsDisconnected),
  [],
  'disconnect/held values must not create or clear alarm edges',
);

const alarmsRecovered = plc.normalizePureWaterPlcTelemetry({
  connected: true,
  receivedAt: frameTime + 52_000,
  sequence: 21,
  bits: clearAlarmBits,
}, alarmsDisconnected);
assert.deepEqual(
  plc.getPureWaterPlcAlarmTransitions(alarmsDisconnected, alarmsRecovered)
    .map((transition) => `${transition.kind}:${transition.tag.address}`),
  ['cleared:M400', 'cleared:M412'],
  'recovery must return exact active PLC alarms to normal',
);

console.log('Pure-water PLC runtime: freshness, held values, A/B pump mapping, recovery, and exact M400-M415 alarm edges verified.');
