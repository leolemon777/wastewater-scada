import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

const mapping = read('src/store/pureWaterPlc.ts');
const dashboard = read('src/components/ui/PureWaterDashboard.tsx');
const store = read('src/store/useScadaStore.ts');
const app = read('src/app/App.tsx');
const systemMenu = read('src/components/ui/SystemMenu.tsx');
const equipmentUtils = read('src/store/equipmentUtils.ts');
const demoScenarios = read('src/store/demoScenarios.ts');
const chemicalTank = read('src/components/scene/equipment/ChemicalTank3D.tsx');
const pureWaterSection = read('src/components/scene/sections/PureWaterSection.tsx');
const pureWaterLayout = read('src/components/scene/sections/pureWaterLayout.ts');
const pipe3d = read('src/components/scene/piping/Pipe3D.tsx');
const valve3d = read('src/components/scene/equipment/Valve3D.tsx');
const overlay = read('src/components/ui/Overlay.tsx');
const pureWaterCss = read('src/styles/pure-water-cabinet.css');
const issues = [];

const octal24 = (prefix) => [
  ...Array.from({ length: 8 }, (_, index) => `${prefix}00${index}`),
  ...Array.from({ length: 8 }, (_, index) => `${prefix}01${index}`),
  ...Array.from({ length: 8 }, (_, index) => `${prefix}02${index}`),
];

const expectedInputs = octal24('X');
const expectedOutputs = octal24('Y');
const expectedAlarms = Array.from({ length: 16 }, (_, index) => `M${400 + index}`);
const expectedModes = ['M500', 'M501', 'M502', ...Array.from({ length: 8 }, (_, index) => `M${510 + index}`)];
const expectedLevels = ['D51', 'D52'];
const expectedCounters = ['C10'];

for (const address of [...expectedInputs, ...expectedOutputs, ...expectedAlarms, ...expectedModes, ...expectedLevels, ...expectedCounters]) {
  if (!mapping.includes(`address: '${address}'`)) {
    issues.push(`PLC mapping is missing ${address}`);
  }
}

for (const alarmAddress of expectedAlarms) {
  const alarmTagPattern = new RegExp(`address: '${alarmAddress}'[^\\n]+equipmentId:[^\\n]+severity:`);
  if (!alarmTagPattern.test(mapping)) {
    issues.push(`Pure-water alarm ${alarmAddress} must retain equipment and severity metadata`);
  }
}

if (!/getPureWaterPlcAlarmTransitions/.test(mapping)) {
  issues.push('Pure-water PLC mapping is missing exact per-address alarm edge detection');
}

for (const [equipmentId, outputAddress] of [
  ['pw-p-raw-1', 'Y002'],
  ['pw-p-raw-2', 'Y003'],
  ['pw-p-ro1-1', 'Y004'],
  ['pw-p-ro1-2', 'Y005'],
]) {
  const patchPattern = new RegExp(`setPump\\('${equipmentId}',\\s*snapshot\\.bits\\.${outputAddress}`);
  if (!patchPattern.test(mapping)) {
    issues.push(`${equipmentId} must map independently to PLC output ${outputAddress}`);
  }
  if (!store.includes(`'${equipmentId}':`) || !pureWaterLayout.includes(`id: '${equipmentId}'`)) {
    issues.push(`${equipmentId} must exist in both the equipment catalog and 3D layout`);
  }
}

for (const headerName of ['rawSuctionHeader', 'rawDischargeHeader', 'ro1SuctionHeader', 'ro1DischargeHeader']) {
  if (!pureWaterSection.includes(headerName)) {
    issues.push(`Pure-water 3D A/B pump routing is missing ${headerName}`);
  }
}

if (/bits\.M412\s*=\s*Boolean\(bits\.X004\s*&&\s*bits\.X005\)/.test(mapping)
  || /bits\.M415\s*=\s*Boolean\(bits\.X022\s*&&\s*bits\.X023\)/.test(mapping)) {
  issues.push('M412/M415 must represent ladder threshold-order faults, not simultaneous level contacts');
}

for (const address of ['D51', 'D52', 'X002', 'X003']) {
  if (!dashboard.includes(address)) {
    issues.push(`PureWaterDashboard must display ${address}`);
  }
}

for (const token of [
  '运行总览',
  'PLC 诊断 / 参数',
  '工艺运行链',
  'A/B 泵组',
  '字寄存器 / 参数',
  '通信 / 数据质量',
]) {
  if (!dashboard.includes(token)) issues.push(`PureWaterDashboard operator/diagnostic split is missing ${token}`);
}

if (!/ingestPureWaterPlcTelemetry/.test(store) || !/normalizePureWaterPlcTelemetry/.test(store)) {
  issues.push('Zustand store is missing the normalized pure-water PLC telemetry ingestion boundary');
}

for (const token of ['systemStatuses', 'reconcilePureWaterPlcAlarms', "source: 'plc'", "system: 'purewater'"]) {
  if (!store.includes(token)) issues.push(`System-scoped pure-water alarm store is missing ${token}`);
}

if (!/alarm\.system === currentSystem/.test(overlay) || !/systemStatuses\[currentSystem\]/.test(overlay)) {
  issues.push('Topbar status, alarm badge, banner, and history must be scoped to the selected system');
}

for (const token of [
  'PURE_WATER_PLC_STALE_AFTER_MS',
  'PURE_WATER_PLC_DISCONNECTED_AFTER_MS',
  'getPureWaterPlcConnectionInfo',
]) {
  if (!mapping.includes(token)) issues.push(`Pure-water PLC freshness contract is missing ${token}`);
}

if (!/pureWaterDemoMode/.test(store) || !/setPureWaterDemoMode/.test(store) || !/pureWaterDemoMode/.test(systemMenu)) {
  issues.push('Wastewater and pure-water demo sources must be independently switchable');
}

const ingestionBody = store.match(/ingestPureWaterPlcTelemetry:[\s\S]*?refreshPureWaterPlcConnection:/)?.[0] ?? '';
if (/demoMode:\s*false/.test(ingestionBody)) {
  issues.push('Pure-water PLC ingestion must not disable the wastewater demo source');
}

if (!/refreshPureWaterPlcConnection/.test(app) || !/setInterval\(refreshPureWaterPlcConnection,\s*1000\)/.test(app)) {
  issues.push('App is missing the wall-clock PLC freshness watchdog');
}

for (const fakeLevelId of ['pw-tk-ro1', 'pw-tk-antiscalant', 'pw-tk-naoh']) {
  const demoLevelPattern = new RegExp(`['\"]${fakeLevelId}['\"]\\s*:\\s*tank\\(`);
  if (demoLevelPattern.test(demoScenarios)) {
    issues.push(`Demo scenarios must not fabricate a continuous level for ${fakeLevelId}`);
  }
}

const pureWaterContinuousList = equipmentUtils.match(/PW_LEVEL_MONITORED_TANKS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
if (/pw-tk-ro1|pw-tk-antiscalant|pw-tk-naoh/.test(pureWaterContinuousList)) {
  issues.push('Only D51/D52 vessels may be classified as pure-water continuous level tanks');
}

if (!/isLevelMonitoredTank/.test(chemicalTank) || !/showMeasuredLevel/.test(chemicalTank)) {
  issues.push('Pure-water 3D tanks must hide liquid when no reviewed continuous level point exists');
}

if (!/PipeAnimationContext\.Provider/.test(pureWaterSection) || !/shouldAnimate\s*=\s*animated\s*&&\s*animationGateOpen/.test(pipe3d)) {
  issues.push('Pure-water pipe flow animation must stop when PLC telemetry is not current');
}

if (!/telemetryIsCurrent/.test(valve3d) || !/UNKNOWN/.test(valve3d)) {
  issues.push('Pure-water 3D valves must show unknown/held state when telemetry is not current');
}

if (!/isPureWaterEquipment\(pd\.id\)/.test(overlay) || !/也未开放启停控制/.test(overlay)) {
  issues.push('Pure-water equipment drawer must remain monitor-only');
}

if (/toggleEquipmentRunStatus|toggleValve|ingestPureWaterPlcTelemetry|setPureWaterDemoMode|<input\b|onChange=/.test(dashboard)) {
  issues.push('PureWaterDashboard must stay read-only and expose no equipment/valve command controls');
}

const dashboardClickHandlers = [...dashboard.matchAll(/onClick=\{([^}]+)\}/g)].map((match) => match[1]);
if (dashboardClickHandlers.some((handler) => !/setPage\(/.test(handler))) {
  issues.push('PureWaterDashboard click handlers may navigate local pages only; no process command handlers are allowed');
}

if ((dashboard.match(/aria-pressed=/g) ?? []).length < 2
  || !/pw-dashboard-tabs button:focus-visible/.test(pureWaterCss)
  || !/aria-live="polite"/.test(dashboard)) {
  issues.push('Pure-water local navigation must expose pressed state, visible keyboard focus, and polite live status');
}

if (!/@media \(max-width: 720px\)/.test(pureWaterCss)
  || !/\.pw-dashboard-tabs \{[^}]*flex-direction: column/.test(pureWaterCss)) {
  issues.push('Pure-water dashboard must retain its narrow-screen stacked navigation contract');
}

if (/192\.168\.0\.13|M100/.test(dashboard) || /192\.168\.0\.13/.test(mapping)) {
  issues.push('Pure-water PLC dashboard/mapping must not revive the cancelled M100 .13 assumption');
}

console.log(
  `Pure-water PLC map: X=${expectedInputs.length}, Y=${expectedOutputs.length}, alarms=${expectedAlarms.length}, modes=${expectedModes.length}, analogLevels=${expectedLevels.length}, counters=${expectedCounters.length}`,
);

if (issues.length > 0) {
  console.error('\nPure-water PLC point contract issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pure-water central dashboard maps the reviewed PLC points and remains monitor-only.');
}
