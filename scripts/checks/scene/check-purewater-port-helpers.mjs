/**
 * 纯水区端口 helper 使用契约检查器。
 *
 * 确保 PureWaterSection 的非泵设备端口（水箱/保安/碳柱/膜组）都经过
 * pureWaterPorts.ts 的几何派生函数，杜绝再次出现"硬编码偏移拼凑"。
 *
 * 校验：
 *   1. PureWaterSection 必须 import 并使用 getCartridgePort/getCarbonPort/
 *      getMembranePort/getTankPort
 *   2. 禁止在 PureWaterSection 里出现裸的设备 X 坐标 ± 数字偏移来当端口
 *      （如 cart1X + 0.5、rackX + 1.18、PW_TANK_TOP_Y 写死）
 *   3. pureWaterPorts.ts 的几何常量必须与各 equipment 组件源码一致
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const issues = [];

const section = read('src/components/scene/sections/PureWaterSection.tsx');
const ports = read('src/components/scene/sections/pureWaterPorts.ts');

// 1. 必须 import 四个 helper
const requiredHelpers = ['getCartridgePort', 'getCarbonPort', 'getMembranePort', 'getTankPort'];
for (const h of requiredHelpers) {
  if (!section.includes(h)) {
    issues.push(`PureWaterSection must import and use ${h} from pureWaterPorts`);
  }
}

// 2. 禁止旧硬编码模式
const forbidden = [
  { re: /PW_TANK_TOP_Y/, msg: 'PW_TANK_TOP_Y is removed; use getTankPort(.., "top")' },
  { re: /cart1X\s*[+\-]\s*0\.\d+/, msg: 'Use getCartridgePort for cartridge nozzles' },
  { re: /cart2X\s*[+\-]\s*0\.\d+/, msg: 'Use getCartridgePort for cartridge nozzles' },
  { re: /carbonX\s*[+\-]\s*0\.\d+/, msg: 'Use getCarbonPort for carbon nozzles' },
  { re: /ro1RackX\s*[+\-]\s*1\.18/, msg: 'Use getMembranePort for membrane ports' },
  { re: /ro2RackX\s*[+\-]\s*1\.18/, msg: 'Use getMembranePort for membrane ports' },
];
for (const { re, msg } of forbidden) {
  if (re.test(section)) {
    issues.push(`Forbidden hardcoded port pattern: ${msg}`);
  }
}

// 3. 几何常量与 equipment 源码一致性快照
const cart = read('src/components/scene/equipment/CartridgeFilter3D.tsx');
const carbon = read('src/components/scene/equipment/CarbonColumn3D.tsx');
const rack = read('src/components/scene/equipment/RoMembraneRack3D.tsx');

const expectConst = (src, name, value) => {
  const m = src.match(new RegExp(`(?:const|export const)\\s+${name}\\s*=\\s*([0-9.]+)`));
  if (!m) return;
  if (Number(m[1]) !== value) {
    issues.push(`${name} drift: equipment=${m[1]} but pureWaterPorts expects ${value}`);
  }
};
expectConst(cart, 'BODY_R', 0.34);
expectConst(cart, 'LEG_H', 0.42);
expectConst(cart, 'BODY_H', 1.18);
expectConst(carbon, 'BODY_R', 0.52);
expectConst(carbon, 'LEG_H', 0.5);
expectConst(carbon, 'BODY_H', 1.85);
expectConst(rack, 'MEMBRANE_LEN', 2.15);

// pureWaterPorts 必须导出这些常量
for (const c of ['CART_BODY_R', 'CARBON_BODY_R', 'MEMBRANE_HALF_LEN']) {
  if (!ports.includes(c)) {
    issues.push(`pureWaterPorts must export ${c}`);
  }
}

if (issues.length > 0) {
  console.log('Pure water port-helper contract issues found:');
  for (const i of issues) console.log(`- ${i}`);
  process.exit(1);
}

console.log('Pure water port helpers: tank/cartridge/carbon/membrane ports are geometry-derived, no hardcoded offsets.');
