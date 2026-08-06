/**
 * 纯水区非泵设备的几何派生端口 helper（返回世界坐标）。
 *
 * 消除 PureWaterSection 里散落的硬编码偏移（cart1X+0.5 / carbonX+0.7 /
 * rackX+1.18 / PW_TANK_TOP_Y=3.56 等），让水箱/保安/碳柱/膜组端口都从
 * 设备自身的几何常量派生，且自带 ry 旋转——设备坐标或尺寸改了，端口自动跟随。
 */
import type { Point3 } from './tankLayout';

/* ── 设备几何常量（与各 equipment 组件源码保持一致，单一来源） ─────── */

/** CartridgeFilter3D：BODY_R=0.34, BODY_H=1.18, LEG_H=0.42。 */
export const CART_BODY_R = 0.34;
export const CART_LEG_H = 0.42;
export const CART_BODY_H = 1.18;
const CART_NOZZLE_OUTSET = 0.145 + 0.011;
export const CART_UPPER_Y = CART_LEG_H + CART_BODY_H - 0.32;
export const CART_LOWER_Y = CART_LEG_H + 0.3;

/** CarbonColumn3D：BODY_R=0.52, BODY_H=1.85, LEG_H=0.5。 */
export const CARBON_BODY_R = 0.52;
export const CARBON_LEG_H = 0.5;
export const CARBON_BODY_H = 1.85;
const CARBON_NOZZLE_OUTSET = 0.165 + 0.012;
export const CARBON_UPPER_Y = CARBON_LEG_H + CARBON_BODY_H - 0.42;
export const CARBON_LOWER_Y = CARBON_LEG_H + 0.38;

/** RoMembraneRack3D：MEMBRANE_LEN=2.15, MEMBRANE_Y=[0.58, 1.24]。 */
export const MEMBRANE_HALF_LEN = 2.15 / 2;
const MEMBRANE_PORT_OUTSET = 0.07 + 0.035;
export const MEMBRANE_UPPER_Y = 1.24;
export const MEMBRANE_LOWER_Y = 0.58;

/**
 * ry=-π/2 时 local (x,y,z) → world: x'=cx - z, y'=cy+y, z'=cz + x。
 * （绕 Y 顺时针 90°：local +Z → world +X，local +X → world -Z）
 */
function rotNeg90(cx: number, cy: number, cz: number, lx: number, ly: number, lz: number): Point3 {
  return [cx - lz, cy + ly, cz + lx];
}

/**
 * 立式 PE 水箱端口。
 * @param center 水箱世界中心
 * @param radius 水箱半径
 * @param height 水箱高度
 * @param port  'top' 顶盖中心下插（过顶入户）/ 'bottom' 侧壁穿墙（底出户）
 * @param side  bottom 时出户方向（local Z 侧），top 时爬升管所在侧
 */
export function getTankPort(
  center: Point3,
  radius: number,
  height: number,
  port: 'top' | 'bottom',
  side: 1 | -1 = 1,
): Point3 {
  const [cx, cy, cz] = center;
  if (port === 'top') {
    return [cx, cy + height / 2 - 0.04, cz];
  }
  // bottom: 侧壁，离罐底 0.46
  return [cx, cy - height / 2 + 0.46, cz + side * (radius + 0.02)];
}

/** 保安过滤器 nozzle 法兰面（世界坐标）。设备 rotation=[0,-π/2,0]。 */
export function getCartridgePort(
  center: Point3,
  side: 1 | -1,
  port: 'upper' | 'lower',
): Point3 {
  const [cx, cy, cz] = center;
  const ly = port === 'upper' ? CART_UPPER_Y : CART_LOWER_Y;
  const lz = side * (CART_BODY_R + CART_NOZZLE_OUTSET);
  // local x=0 → world z=cz+0
  return rotNeg90(cx, cy, cz, 0, ly, lz);
}

/** 碳柱 nozzle 法兰面（世界坐标）。设备 rotation=[0,-π/2,0]。 */
export function getCarbonPort(
  center: Point3,
  side: 1 | -1,
  port: 'upper' | 'lower',
): Point3 {
  const [cx, cy, cz] = center;
  const ly = port === 'upper' ? CARBON_UPPER_Y : CARBON_LOWER_Y;
  const lz = side * (CARBON_BODY_R + CARBON_NOZZLE_OUTSET);
  return rotNeg90(cx, cy, cz, 0, ly, lz);
}

/** 膜组端盖 port 面（世界坐标）。设备 rotation=[0,0,0]，local ±X = world ±X。 */
export function getMembranePort(
  rackCenter: Point3,
  side: 1 | -1,
  row: 'upper' | 'lower',
): Point3 {
  const [cx, cy, cz] = rackCenter;
  const ly = row === 'upper' ? MEMBRANE_UPPER_Y : MEMBRANE_LOWER_Y;
  const lx = side * (MEMBRANE_HALF_LEN + MEMBRANE_PORT_OUTSET);
  return [cx + lx, cy + ly, cz];
}
