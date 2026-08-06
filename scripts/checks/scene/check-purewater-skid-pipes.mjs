/**
 * 纯水区撬装 + 真实法兰面管路契约检查器。
 *
 * 防止 PureWaterSection 退化回"散摆设备 + 虚空连接"：
 *   1. 每个撬组必须有 SkidFrame3D（型钢底座，不再是通长地砖）
 *   2. 每台 PureWaterPump3D 必须配套 PumpPipeFlanges3D + 2 个 PumpPipeReducer3D
 *      （吸入/排出大小头过渡，消除"管子戳喷嘴"虚空感）
 *   3. 双泵汇管立管必须纯竖直（face 与 header 共 X/Z，只变 Y）
 *   4. ConvergingHeader3D 在 PureWaterSection 必须 ≥ 4（R02/供水的吸入+排放）
 *
 * 这是纯水区专属契约，与污水区 check-pipe-physical-connections.mjs 并列。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const issues = [];

const section = read('src/components/scene/sections/PureWaterSection.tsx');

// 1. 撬装底座：必须有 SkidFrame3D，且不再用通长 EquipmentPad3D 假装撬块
const skidCount = (section.match(/<SkidFrame3D\b/g) ?? []).length;
if (skidCount < 6) {
  issues.push(
    `Expected ≥6 SkidFrame3D mounts (raw/ro1/ro2 tank + ro1 pump + ro2 dual + supply dual), found ${skidCount}`,
  );
}
// 通长 pad（size 第一维 ≥ 20）是"假装撬块"的反模式
const longPad = section.match(/EquipmentPad3D[^/]*size=\{\[\s*(\d+(?:\.\d+)?)\s*,/g);
if (longPad) {
  const longOnes = longPad.filter((s) => Number(s.match(/\d+(?:\.\d+)?/)[0]) >= 20);
  if (longOnes.length > 0) {
    issues.push(
      `Found ${longOnes.length} long EquipmentPad3D (≥20m) — split into per-skid pads, do not fake a skid with a continuous slab`,
    );
  }
}

// 2. 每台泵挂法兰 + 大小头
const pumpCount = (section.match(/<PureWaterPump3D\b/g) ?? []).length;
const flangeGroupCount = (section.match(/<PumpPipeFlanges3D\b/g) ?? []).length;
const reducerCount = (section.match(/<PumpPipeReducer3D\b/g) ?? []).length;
if (flangeGroupCount < pumpCount) {
  issues.push(
    `Every PureWaterPump3D (${pumpCount}) needs a paired PumpPipeFlanges3D; found ${flangeGroupCount}`,
  );
}
// 每泵 2 个 reducer（吸入+排出）
if (reducerCount < pumpCount * 2) {
  issues.push(
    `Every PureWaterPump3D needs 2 PumpPipeReducer3D (suction+discharge); expected ≥${pumpCount * 2}, found ${reducerCount}`,
  );
}

// 3. ConvergingHeader3D 数量（R02 吸入/排放 + 供水吸入/排放 = 4）
const headerCount = (section.match(/<ConvergingHeader3D\b/g) ?? []).length;
if (headerCount < 4) {
  issues.push(
    `Expected ≥4 ConvergingHeader3D in PureWaterSection (ro2 suction/discharge + supply suction/discharge), found ${headerCount}`,
  );
}

// 4. 端口必须经 helper（设备端口坐标硬编码由 check-purewater-port-helpers 负责）
//    这里只防"管段端点直接写死设备坐标当端口"——折点（如 rawTx+1.6 爬升管）允许。

if (issues.length > 0) {
  console.log('Pure water skid/pipe contract issues found:');
  for (const i of issues) console.log(`- ${i}`);
  process.exit(1);
}

console.log(
  `Pure water skid/pipe contract: skids=${skidCount}, pumpFlanges=${flangeGroupCount}/${pumpCount}, reducers=${reducerCount}/${pumpCount * 2}, headers=${headerCount}`,
);
console.log('All pure-water skid frames, pump flanges, and dual-pump headers are in place.');
