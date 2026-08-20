// SPEC-PLAN WP2 / 15：Tag 来源、质量与 demo 隔离静态守卫。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const tagQuality = read('src/store/tagQuality.ts');
const store = read('src/store/useScadaStore.ts');
const dashboard = read('src/components/ui/DataDashboard.tsx');
const parts = read('src/components/ui/dashboard-parts.tsx');

// 1. 统一 Tag 状态模型存在且 ownership 固定为五条权威映射
assert.match(tagQuality, /export interface TagState/);
assert.match(tagQuality, /export type TelemetryQuality/);
for (const [tag, source] of [
  ['tk-daf.pH', 'm100-daf-01'],
  ['tk-daf.aerationCommanded', 'm100-daf-01'],
  ['tk-daf.scraperCommanded', 'm100-daf-01'],
  ['tk-intermediate.levelValue', 'm100-underground-01'],
  ['tk-intermediate.levelPercent', 'm100-underground-01'],
]) {
  assert.ok(tagQuality.includes(`'${tag}': '${source}'`), `TAG_OWNERSHIP 缺少 ${tag} -> ${source}`);
}

// 2. store 集成：TagState 域 + 防回退 + 断线 ownership
assert.match(store, /tagStates: Record<string, TagState>/);
assert.match(store, /m100SourceCursors/);
assert.match(store, /shouldAcceptEvent/);
assert.match(store, /ownedEquipmentIdsBySource/);
assert.match(store, /ageTransition/);

// 3. 生产默认 demo 关闭（SPEC 22 行 1）
assert.match(store, /demoMode: false,\r?\n  pureWaterDemoMode: false,/);

// 4. 现场路径无固定 pH 回退、无合规结论（PhTile 的过程阈值预警不属合规结论）
assert.equal(dashboard.includes('?? 7.0'), false, '不得存在 pH ?? 7.0 固定回退');
assert.equal(dashboard.includes("?? '7.0'"), false, '不得存在 pH ?? \'7.0\' 回退');
assert.equal(dashboard.includes('达标'), false, 'dashboard 不得出现「达标」合规结论');

// 5. 演示值/演示曲线必须醒目标注（SPEC 9.3）
assert.ok(dashboard.includes('演示数据，不代表现场'), '排放面板必须标注演示数据');
assert.ok(dashboard.includes('演示曲线，不代表现场'), '趋势区必须标注演示曲线');
assert.ok(dashboard.includes('历史趋势未接入'), '无历史服务时必须显示未接入');

// 6. 质量条：来源/质量/数据龄/保持值展示存在（SPEC 9.2）
assert.ok(parts.includes('TelemetryQualityStrip'), '必须提供数据质量条组件');
assert.ok(parts.includes('qualityDisplay'), '质量条必须读取统一 TagState 质量');
assert.ok(parts.includes('保持值'), '质量条必须显示保持值');

console.log('[check] m100 source quality + demo isolation: assertions passed');
