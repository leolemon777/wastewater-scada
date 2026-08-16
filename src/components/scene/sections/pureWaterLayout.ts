/**
 * 纯水(二级 RO)工艺布局 — 室外三组团布置,世界坐标。
 *
 * 按功能分成三个紧凑组团,首尾相接、水流短捷,不再散兵线:
 *   北排(一级线 z=-9,东→西):原水箱 → 原水泵A/B → 保安① → 碳柱
 *     → 一级进水阀 → 保安② → [阻垢剂] → R01泵A/B+一级膜(集成撬) → R01水箱
 *   南排(二级线 z=+9,西→东):R01水箱 → 二级进水阀 → R02泵A/B
 *     → [NaOH] → 二级膜 → R02水箱 → 供水泵A/B → 用水点(东)
 *
 * 集成撬:原水/R01/R02/供水泵均按 A/B 双泵并贴,各自共用底座。
 * 第一版不做浓水管;压力/流量/电导率测点预留。
 *
 * 区域占地约 50(x) × 36(z),设备间距与检修通道较首版加宽。
 */

type Point = [number, number, number];

/** 室外设备基础顶面(纯水区现有设备/管路坐标基准)。 */
export const PW_FLOOR_Y = 0.07;

/** 纯水立式泵 scale(比污水卧式泵 0.5 放大,更显眼)。泵端口计算也用此值。 */
export const PW_PUMP_SCALE = 0.65;

/* ── 两排工艺线 Z 高度 ────────────────────────────────────────────── */
export const PW_STAGE1_Z = -7.5; // 一级线(北排)
export const PW_STAGE2_Z = 7.5; // 二级线(南排)

/* ── 水箱(闭式 PE 储罐,放大加高版;坐在地面 y≈0 基准) ────────────── */
export const PW_TANKS = {
  raw: { id: 'pw-tk-raw', position: [-59.8, 1.8, PW_STAGE1_Z] as Point, size: [1.4, 3.6] as [number, number], color: '#8FC3D8' },
  ro1: { id: 'pw-tk-ro1', position: [-88.4, 1.8, PW_STAGE1_Z] as Point, size: [1.4, 3.6] as [number, number], color: '#7CD0EA' },
  ro2: { id: 'pw-tk-ro2', position: [-76.7, 1.8, PW_STAGE2_Z] as Point, size: [1.4, 3.6] as [number, number], color: '#6FDBF0' },
  antiscalant: { id: 'pw-tk-antiscalant', position: [-76.7, 0.95, PW_STAGE1_Z + 3.7] as Point, size: [0.6, 1.9] as [number, number], color: '#F0B23E' },
  naoh: { id: 'pw-tk-naoh', position: [-87.0, 0.95, PW_STAGE2_Z - 5.2] as Point, size: [0.6, 1.9] as [number, number], color: '#E8654F' },
} as const;

/* ── 泵(R01/供水朝东吸入,R02朝北吸入) ────────────────────────────── */
export const PW_PUMPS = {
  rawA: { id: 'pw-p-raw-1', position: [-64.2, PW_FLOOR_Y, PW_STAGE1_Z - 1.1] as Point, rotationY: -Math.PI / 2 },
  rawB: { id: 'pw-p-raw-2', position: [-64.2, PW_FLOOR_Y, PW_STAGE1_Z + 1.1] as Point, rotationY: -Math.PI / 2 },
  ro1A: { id: 'pw-p-ro1-1', position: [-78.9, PW_FLOOR_Y, PW_STAGE1_Z - 1.1] as Point, rotationY: -Math.PI / 2 },
  ro1B: { id: 'pw-p-ro1-2', position: [-78.9, PW_FLOOR_Y, PW_STAGE1_Z + 1.1] as Point, rotationY: -Math.PI / 2 },
  ro2A: { id: 'pw-p-ro2-1', position: [-89.2, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
  ro2B: { id: 'pw-p-ro2-2', position: [-87.0, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
  supplyA: { id: 'pw-p-supply-1', position: [-71.5, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
  supplyB: { id: 'pw-p-supply-2', position: [-69.3, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
} as const;

/* ─ RO 无源单元(保安过滤器/碳柱/膜组) ─────────────────────────────── */
export const PW_UNITS = {
  cart1: { id: 'pw-f-cart-1', position: [-67.9, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, -Math.PI / 2, 0] as Point },
  carbon: { id: 'pw-f-carbon', position: [-71.5, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, -Math.PI / 2, 0] as Point },
  cart2: { id: 'pw-f-cart-2', position: [-75.2, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, -Math.PI / 2, 0] as Point },
  ro1: { id: 'pw-ro-1', position: [-83.3, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, 0, 0] as Point },
  ro2: { id: 'pw-ro-2', position: [-81.8, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotation: [0, 0, 0] as Point },
} as const;

/* ── 阀门(在线安装) ──────────────────────────────────────────────── */
export const PW_VALVES = {
  inlet: { id: 'pw-v-inlet', position: [-57.1, 1.05, PW_STAGE1_Z] as Point, rotation: [0, 0, 0] as Point, scale: 0.4 },
  ro1In: { id: 'pw-v-ro1-in', position: [-73.4, 0.95, PW_STAGE1_Z] as Point, rotation: [0, 0, 0] as Point, scale: 0.32 },
  ro2In: { id: 'pw-v-ro2-in', position: [-88.4, 0.46, -1.5] as Point, rotation: [0, Math.PI / 2, 0] as Point, scale: 0.4 },
  ro1Flush: { id: 'pw-v-ro1-flush', position: [-79.3, 1.35, PW_STAGE1_Z - 3.0] as Point, rotation: [0, Math.PI / 2, 0] as Point, scale: 0.35 },
  ro2Flush: { id: 'pw-v-ro2-flush', position: [-85.5, 1.5, PW_STAGE2_Z - 3.7] as Point, rotation: [0, Math.PI / 2, 0] as Point, scale: 0.35 },
} as const;

/* ── 配电/控制柜(落地,贴西墙内侧,正面朝东) ──────────────────────── */
// 柜体深 0.42,背面到中心 DISTRIBUTION_CABINET_BACK_OFFSET=0.21;
// 西墙 x=-93.5 + 半墙厚 0.09 + 背面间隙 0.21 → 中心 x≈-93.0
// 正面朝东(+X): rotationY = +π/2(柜门朝室内)
// y=0:柜体自带底座从 y≈0 起算,与 PW_FLOOR_Y 视觉地面齐平
// 编号顺延主厂区(1#/2#/4#)与加药车间(3#):5# 服务一级线,6# 服务二级线
export const PW_CABINETS = {
  ro1: { position: [-93.0, 0, PW_STAGE1_Z + 4.0] as Point, rotationY: Math.PI / 2, name: '5# 一级 RO 控制柜' },
  ro2: { position: [-93.0, 0, PW_STAGE2_Z - 4.0] as Point, rotationY: Math.PI / 2, name: '6# 二级 RO 控制柜' },
} as const;

/* ── 加药计量泵 ──────────────────────────────────────────────────── */
export const PW_DOSE_PUMPS = {
  antiscalant: { id: 'pw-p-dose-as', position: [-76.7, PW_FLOOR_Y, PW_STAGE1_Z + 2.8] as Point },
  naoh: { id: 'pw-p-dose-naoh', position: [-87.0, PW_FLOOR_Y, PW_STAGE2_Z - 4.4] as Point },
} as const;

/* ── 管路标高(水箱加高到 3.6 后顶部 Y 同步) ─────────────────────── */
export const PW_SUCTION_HEADER_Y = 0.46;
export const PW_DISCHARGE_HEADER_Y = 1.5;
/** 一级线(原水/R01)双泵排放汇管标高，区别于二级线较高的 PW_DISCHARGE_HEADER_Y。 */
export const PW_STAGE1_DISCHARGE_Y = 1.35;
export const PW_PERMEATE_HIGH_Y = 3.85;
/** 汇管死端外延余量（对齐污水区 PUMP_HEADER_END_CLEARANCE 契约 0.10–0.20）。 */
export const PW_HEADER_END_CLEARANCE = 0.13;

/** 管路半径。 */
export const PW_MAIN_R = 0.07;
export const PW_BRANCH_R = 0.06;
export const PW_HEADER_R = 0.08;
export const PW_FLUSH_R = 0.05;
export const PW_DOSE_R = 0.02;

/* ── 区域护栏(必须收在厂区西护栏 x=-93.8 以内;占地约 42×30) ─────── */
export const PW_GUARD = {
  west: -93.5,
  east: -51.5,
  north: -15,
  south: 15,
  /** 东边通道口(对厂区,原水/供水管线进出)。 */
  eastOpening: { z0: -1.9, z1: 10.6 },
} as const;

/* ── 场地东侧接入/接出点(去厂区方向,须探出东墙/护栏线外 0.3m) ────── */
/** 原水自东侧厂区方向来水,穿东墙(z=S1 处有墙板)后接总进水阀。 */
export const PW_RAW_ENTRY_X = PW_GUARD.east + 0.3;
/** 纯水供水向东侧用水点方向接出,经东边通道口(z=S2-0.39 处无墙板)探出。 */
export const PW_PURE_EXIT_X = PW_GUARD.east + 0.3;
