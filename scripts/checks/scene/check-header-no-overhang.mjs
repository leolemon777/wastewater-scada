/**
 * Dual-pump discharge headers:
 * - continuous shell [start, end] with vertical risers teeing from below
 * - short runout past outer riser (encloses tee; not clearance 0)
 * - pipe-colored end plugs — never grey blind overhang stubs
 * - no end-caps on the riser tee point itself
 *
 * Forbidden: elbow-to-takeoff pairs that junctionTrim into a gapped open-end tee.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

const issues = [];

function numericConst(text, name) {
  const match = text.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}

const processRoutes = read('src/components/scene/sections/processPumpRoutes.ts');
const intakeRoutes = read('src/components/scene/sections/intakePipeRoutes.ts');
const headerComponent = read('src/components/scene/piping/ConvergingHeader3D.tsx');
const processNetwork = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const intakeNetwork = read('src/components/scene/sections/IndustrialPipeNetwork3D.tsx');
const pipe3d = read('src/components/scene/piping/Pipe3D.tsx');

for (const [label, text, name] of [
  ['processPumpRoutes', processRoutes, 'PUMP_HEADER_END_CLEARANCE'],
  ['intakePipeRoutes', intakeRoutes, 'INTAKE_HEADER_END_CLEARANCE'],
]) {
  const value = numericConst(text, name);
  if (value === null) {
    issues.push(`Missing ${name} in ${label}`);
  } else if (value < 0.1 || value > 0.2) {
    issues.push(
      `${name}=${value}; keep in 0.10–0.20 so the outer tee is enclosed without a long overhang stub`,
    );
  }
}

if (processNetwork.includes('DischargeToTakeoff')) {
  issues.push('Process network must not use elbow-to-takeoff helpers (causes gapped open-end tees)');
}
if (!processNetwork.includes('WaterPumpDischargeRisers') || !processNetwork.includes('SludgePumpDischargeRisers')) {
  issues.push('Process network must use vertical DischargeRisers into ConvergingHeader3D');
}

const headerMounts = (processNetwork.match(/<ConvergingHeader3D/g) || []).length;
if (headerMounts < 5) {
  issues.push(`Expected ≥5 ConvergingHeader3D mounts on process/sludge dual-pump groups, found ${headerMounts}`);
}
if (!intakeNetwork.includes('ConvergingHeader3D')) {
  issues.push('Intake multi-pump bay must keep ConvergingHeader3D');
}
if (!/points=\{\[start,\s*end\]\}/.test(headerComponent)) {
  issues.push('ConvergingHeader3D must keep one continuous shell points={[start, end]}');
}
if (!headerComponent.includes('HeaderRunoutPlug')) {
  issues.push('ConvergingHeader3D must seal dual-pump runout ends with HeaderRunoutPlug (same-color, not open circles)');
}
if (!headerComponent.includes('capEnds')) {
  issues.push('ConvergingHeader3D must support capEnds=false for receiving headers whose ends are live tees');
}
if (!headerComponent.includes('capStart') || !headerComponent.includes('capEnd')) {
  issues.push('ConvergingHeader3D must support per-end capStart/capEnd');
}
if (!processNetwork.includes('capEnds={false}')) {
  issues.push('Sludge gallery receiving header must set capEnds={false} (ends are incoming tees)');
}
if (!/start=\{INTERMEDIATE_HEADER\.start\}[\s\S]*?end=\{INTERMEDIATE_HEADER\.end\}[\s\S]*?capStart=\{true\}[\s\S]*?capEnd=\{false\}/m.test(processNetwork)) {
  issues.push('Intermediate pump header must keep only its dead end capped and continue through the outlet end');
}
if (!processNetwork.includes('points={INTERMEDIATE_TRANSFER_POINTS}')
  || !processNetwork.includes('INTERMEDIATE_VISIBLE_ELBOW_INDICES.map')
  || !processNetwork.includes('startJunctionRole="continuous"')) {
  issues.push('Intermediate pump outlet must continue from the header through explicit visible elbows');
}
if (!intakeNetwork.includes('capStart={true}') || !intakeNetwork.includes('capEnd={true}')) {
  issues.push('Intake header must plug both runout ends; PH1 leaves from an interior tee');
}
if (!intakeRoutes.includes('const ph1Takeoff: V3 = [PH1_INLET[0], INTAKE_HEADER_Y, headerZ]')) {
  issues.push('PH1 transfer must take off at the inlet X coordinate for a straight north/south run');
}
if (!/\[\s*ph1Takeoff,\s*headerDropElbow,\s*headerBuriedEntry,\s*ph1BuriedRiser,\s*ph1WallEntryElbow,\s*PH1_INLET,\s*\]/m.test(intakeRoutes)) {
  issues.push('PH1 transfer must use visible header/wall elbows around its buried straight run');
}
if (!intakeNetwork.includes('network.ph1VisibleElbows.map') || !intakeNetwork.includes('<PipeElbowFitting3D')) {
  issues.push('PH1 exposed direction changes must render explicit elbow collars/weld rings');
}
if (!/blindStart\s*=\s*false/.test(headerComponent) || !/blindEnd\s*=\s*false/.test(headerComponent)) {
  issues.push('ConvergingHeader3D must default blindStart/blindEnd to false');
}
if (/blind(?:Start|End)\s*=\s*\{?\s*true/.test(intakeNetwork) || /blind(?:Start|End)\s*=\s*\{?\s*true/.test(processNetwork)) {
  issues.push('Section mounts must not enable header blind overhang flanges');
}

const trim = numericConst(pipe3d, 'JUNCTION_SURFACE_TRIM');
if (trim == null || trim < 0.85 || trim > 0.98) {
  issues.push(`JUNCTION_SURFACE_TRIM=${trim}; keep in 0.85–0.98 so risers seat into the header shell`);
}

const required = [
  'INTERMEDIATE_HEADER',
  'DRAIN_HEADER',
  'CLARIFIER_SLUDGE_HEADER',
  'DAF_SLUDGE_HEADER',
  'SLUDGE_OUT_HEADER',
];
for (const name of required) {
  if (!processNetwork.includes(name)) {
    issues.push(`Process network missing ${name}`);
  }
}

if (issues.length > 0) {
  console.error('\nDual-pump header / tee issues:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    `Dual-pump headers: continuous shell + vertical risers, clearance≈${numericConst(processRoutes, 'PUMP_HEADER_END_CLEARANCE')}, trim=${trim}, mounts=${headerMounts}.`,
  );
}
