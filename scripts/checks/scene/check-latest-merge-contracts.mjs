import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
const issues = [];

const scene = read('src/components/scene/SCADAScene.tsx');
const pump = read('src/components/scene/equipment/Pump3D.tsx');
const pumpPorts = read('src/components/scene/piping/pumpPorts.ts');
const valve = read('src/components/scene/equipment/Valve3D.tsx');
const processNetwork = read('src/components/scene/sections/ProcessAndSludgePipeNetwork3D.tsx');
const warehouse = read('src/components/scene/site/HazardousWasteWarehouse3D.tsx');
const sludgeLayout = read('src/components/scene/site/sludgePlatformLayout.ts');

for (const cabinet of [
  'position={[-29.5, 0.5, 19.0]} rotation={[0, 0, 0]} cabinetName="1# 进水提升控制柜"',
  'position={[5.5, 0.5, 5.0]} rotation={[0, 0, 0]} cabinetName="2# 沉淀回流控制柜"',
  'position={[13.5, 0.5, 19.2]} rotation={[0, 0, 0]} cabinetName="4# 污泥脱水控制柜"',
]) {
  if (!scene.includes(cabinet)) issues.push(`Missing merged cabinet placement: ${cabinet}`);
}

if (!pump.includes('position={[0, 0.78, -0.98]}') || !pump.includes('position={[0, 1.54, -0.78]}')) {
  issues.push('Pump nozzles must remain seated on the volute body');
}
if (!pumpPorts.includes('new THREE.Vector3(0, 0.78, -0.98)') ||
    !pumpPorts.includes('new THREE.Vector3(0, 1.54, -0.78)')) {
  issues.push('Pump routing anchors must match the seated Pump3D nozzle positions');
}
if (!pumpPorts.includes('return [poolInner, wall, mouth]')) {
  issues.push('Process pump suction routes must cross the tank wall before reaching the sealing face');
}

if (!valve.includes('scale?: number | [number, number, number]') ||
    !processNetwork.includes('scale={0.42}')) {
  issues.push('Outfall valve scale fix is missing');
}

for (const warehouseFeature of [
  'Secondary-containment bund',
  'Fire station and spill kit',
  'Hazardous-material diamond sign',
  'Roof parapet and ventilation units',
]) {
  if (!warehouse.includes(warehouseFeature)) issues.push(`Warehouse feature missing: ${warehouseFeature}`);
}
if (!sludgeLayout.includes('HAZWASTE_INTERIOR_UNLOAD_Z = 24.35') ||
    !scene.includes('HAZWASTE_INTERIOR_UNLOAD_Z')) {
  issues.push('Forklift must unload deep inside the hazardous-waste warehouse');
}
if (!sludgeLayout.includes('warehouseWidth / 2') || !sludgeLayout.includes('return 0.08')) {
  issues.push('Forklift surface resolver must include the warehouse floor slab');
}

console.log('Latest merge contracts: cabinets=3, seatedPumpPorts=2, warehouseLogistics=true');
if (issues.length) {
  console.error('\nLatest merge issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('All retained latest-version cabinet, pump, valve, warehouse, and forklift changes are present.');
}
