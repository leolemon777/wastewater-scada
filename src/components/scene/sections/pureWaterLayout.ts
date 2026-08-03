/**
 * 纯水(二级 RO)工艺布局 — 室外三组团布置,世界坐标。
 *
 * 按功能分成三个紧凑组团,首尾相接、水流短捷,不再散兵线:
 *   北排(一级线 z=-6,东→西):原水箱 → 原水泵 → 保安① → 碳柱
 *     → 一级进水阀 → 保安② → [阻垢剂] → R01泵+一级膜(集成撬) → R01水箱
 *   南排(二级线 z=+6,西→东):R01水箱 → 二级进水阀 → R02泵A/B
 *     → [NaOH] → 二级膜 → R02水箱 → 供水泵A/B → 用水点(东)
 *
 * 集成撬:R01泵紧贴一级膜、R02泵A/B 并贴、供水泵A/B 并贴,各自共用底座。
 * 第一版不做浓水管;压力/流量/电导率测点预留。
 */

type Point = [number, number, number];

/** 室外设备基础顶面。 */
export const PW_FLOOR_Y = 0.07;

/* ── 两排工艺线 Z 高度 ────────────────────────────────────────────── */
export const PW_STAGE1_Z = -6; // 一级线(北排)
export const PW_STAGE2_Z = 6; // 二级线(南排)

/* ── 水箱(闭式 PE 储罐) ──────────────────────────────────────────── */
export const PW_TANKS = {
  raw: { id: 'pw-tk-raw', position: [-66, 1.35, PW_STAGE1_Z] as Point, size: [1.0, 2.4] as [number, number], color: '#8FC3D8' },
  ro1: { id: 'pw-tk-ro1', position: [-85.5, 1.35, PW_STAGE1_Z] as Point, size: [1.0, 2.4] as [number, number], color: '#7CD0EA' },
  ro2: { id: 'pw-tk-ro2', position: [-77.5, 1.35, PW_STAGE2_Z] as Point, size: [1.0, 2.4] as [number, number], color: '#6FDBF0' },
  antiscalant: { id: 'pw-tk-antiscalant', position: [-77.5, 0.75, PW_STAGE1_Z + 2.5] as Point, size: [0.45, 1.2] as [number, number], color: '#F0B23E' },
  naoh: { id: 'pw-tk-naoh', position: [-84.5, 0.75, PW_STAGE2_Z - 3.5] as Point, size: [0.45, 1.2] as [number, number], color: '#E8654F' },
} as const;

/* ── 泵(R01/供水朝东吸入,R02朝北吸入) ────────────────────────────── */
export const PW_PUMPS = {
  raw: { id: 'pw-p-raw', position: [-69, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotationY: -Math.PI / 2 },
  ro1: { id: 'pw-p-ro1', position: [-79, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotationY: -Math.PI / 2 },
  ro2A: { id: 'pw-p-ro2-1', position: [-86, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
  ro2B: { id: 'pw-p-ro2-2', position: [-84.5, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
  supplyA: { id: 'pw-p-supply-1', position: [-74, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
  supplyB: { id: 'pw-p-supply-2', position: [-72.5, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotationY: 0 },
} as const;

/* ─ RO 无源单元(保安过滤器/碳柱/膜组) ─────────────────────────────── */
export const PW_UNITS = {
  cart1: { id: 'pw-f-cart-1', position: [-71.5, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, -Math.PI / 2, 0] as Point },
  carbon: { id: 'pw-f-carbon', position: [-74, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, -Math.PI / 2, 0] as Point },
  cart2: { id: 'pw-f-cart-2', position: [-76.5, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, -Math.PI / 2, 0] as Point },
  ro1: { id: 'pw-ro-1', position: [-82, PW_FLOOR_Y, PW_STAGE1_Z] as Point, rotation: [0, 0, 0] as Point },
  ro2: { id: 'pw-ro-2', position: [-81, PW_FLOOR_Y, PW_STAGE2_Z] as Point, rotation: [0, 0, 0] as Point },
} as const;

/* ── 阀门(在线安装) ──────────────────────────────────────────────── */
export const PW_VALVES = {
  inlet: { id: 'pw-v-inlet', position: [-64.2, 1.05, PW_STAGE1_Z] as Point, rotation: [0, 0, 0] as Point, scale: 0.4 },
  ro1In: { id: 'pw-v-ro1-in', position: [-75.3, 0.95, PW_STAGE1_Z] as Point, rotation: [0, 0, 0] as Point, scale: 0.32 },
  ro2In: { id: 'pw-v-ro2-in', position: [-85.5, 0.46, -1.0] as Point, rotation: [0, Math.PI / 2, 0] as Point, scale: 0.4 },
  ro1Flush: { id: 'pw-v-ro1-flush', position: [-79.3, 1.35, PW_STAGE1_Z - 2.0] as Point, rotation: [0, Math.PI / 2, 0] as Point, scale: 0.35 },
  ro2Flush: { id: 'pw-v-ro2-flush', position: [-83.5, 1.5, PW_STAGE2_Z - 2.5] as Point, rotation: [0, Math.PI / 2, 0] as Point, scale: 0.35 },
} as const;

/* ── 加药计量泵 ──────────────────────────────────────────────────── */
export const PW_DOSE_PUMPS = {
  antiscalant: { id: 'pw-p-dose-as', position: [-77.5, PW_FLOOR_Y, PW_STAGE1_Z + 1.9] as Point },
  naoh: { id: 'pw-p-dose-naoh', position: [-84.5, PW_FLOOR_Y, PW_STAGE2_Z - 2.9] as Point },
} as const;

/* ── 管路标高 ─────────────────────────────────────────────────────── */
export const PW_SUCTION_HEADER_Y = 0.46;
export const PW_PERMEATE_HIGH_Y = 2.75;
export const PW_TANK_TOP_Y = 2.56;

/** 管路半径。 */
export const PW_MAIN_R = 0.07;
export const PW_BRANCH_R = 0.06;
export const PW_HEADER_R = 0.08;
export const PW_FLUSH_R = 0.05;
export const PW_DOSE_R = 0.02;

/* ── 场地东侧接入/接出点(去厂区方向) ────────────────────────────── */
/** 原水自东侧厂区方向来水。 */
export const PW_RAW_ENTRY_X = -62;
/** 纯水供水向东侧用水点方向接出。 */
export const PW_PURE_EXIT_X = -62;

/* ── 区域护栏(呼应污水区安全护栏;东边留通道口对厂区) ───────────── */
export const PW_GUARD = {
  west: -92,
  east: -58,
  north: -12,
  south: 12,
  /** 东边通道口(对厂区,原水/供水管线进出)。 */
  eastOpening: { z0: -1.5, z1: 8.5 },
} as const;
