import React from 'react';
import { Materials } from './Materials';
import { RubberPad3D } from './IndustrialParts';

/**
 * 共享型钢撬装底座（skid frame）。
 *
 * 从污水区 Pump3D 内联的"混凝土基础 + 找平层 + 型钢导轨 + 横杆 + 锚板螺栓 +
 * 橡胶减震垫"几何抽出，参数化后供纯水区撬组复用。外观与污水卧式泵撬座一致，
 * 让两区设备基座语言统一，但尺寸按立式泵/撬组包围盒传入。
 *
 * 尺寸约定：以 `center` 为底座中心（基础顶面附近），`size=[lengthX, depthZ]`
 * 给出型钢导轨外廓；基础块、找平层、横杆、锚板均由此派生。
 */
export interface SkidFrame3DProps {
  /** 撬座中心世界坐标（y 取基础顶面附近，约设备脚位高度）。 */
  center: [number, number, number];
  /** 撬座导轨外廓 [lengthX(沿 x), depthZ(沿 z)]，世界米。 */
  size: [number, number];
  /** 横杆数量（含两端），默认按 lengthX 自适应。 */
  crossbarCount?: number;
  /** 锚板每条导轨上的数量，默认 3。 */
  anchorPerRail?: number;
  /** 是否渲染橡胶减震垫（小撬座可关）。 */
  rubberPads?: boolean;
  /** 导轨/横杆金属色覆盖；默认走 Materials.brushedMetal。 */
  railColor?: string;
  /** 混凝土基础色覆盖；默认走 Materials.concrete。 */
  baseColor?: string;
  /** 旋转 Y（弧度），用于沿 z 方向的撬座。 */
  rotationY?: number;
}

const RISER_STEEL = '#606A72';
const ANCHOR_PLATE = '#727D85';
const ANCHOR_STUD = '#94A3B8';
const ANCHOR_NUT = '#64748B';
const GROUT_COLOR = '#2A2A2A';

/**
 * 默认尺寸派生（参考污水 Pump3D 比例）：
 *   导轨间距 = depthZ - 0.2*depthZ（导轨贴外侧，留 10% 内收）
 *   基础块比导轨外廓略大 0.1m 一圈
 *   基础厚 0.18，找平层 0.012，导轨高 0.12
 */
export const SkidFrame3D: React.FC<SkidFrame3DProps> = ({
  center,
  size,
  crossbarCount,
  anchorPerRail = 3,
  rubberPads = true,
  railColor,
  baseColor,
  rotationY = 0,
}) => {
  const [lenX, depthZ] = size;

  // 基础块（略大于导轨外廓）
  const baseX = lenX + 0.2;
  const baseZ = depthZ + 0.2;
  const baseThick = 0.18;
  const baseY = baseThick / 2; // 中心高度

  // 导轨（左右两条，沿 x 长方向）
  const railX = Math.max(lenX - 0.2, 0.6);
  const railHeight = 0.12;
  const railOffsetZ = Math.max(depthZ / 2 - 0.18, 0.2); // 内收
  const railY = baseThick + railHeight / 2 + 0.012; // 找平层之上

  // 横杆数量（默认按长度自适应，间距 ~1.0m）
  const crossN = crossbarCount ?? Math.max(3, Math.round(lenX / 1.0));
  const crossXs: number[] = [];
  if (crossN <= 1) {
    crossXs.push(0);
  } else {
    for (let i = 0; i < crossN; i++) crossXs.push(-lenX / 2 + (lenX * i) / (crossN - 1));
  }
  const crossLenZ = depthZ - 0.4; // 横杆跨在两导轨之间

  // 锚板 z 位置（沿导轨均布）
  const anchorZs: number[] = [];
  if (anchorPerRail <= 1) {
    anchorZs.push(0);
  } else {
    for (let i = 0; i < anchorPerRail; i++) {
      anchorZs.push(-railX / 2 + (railX * i) / (anchorPerRail - 1));
    }
  }
  const anchorX = railOffsetZ; // 锚板在导轨外侧的 x 偏移（沿 z 跨度方向）
  const anchorY = baseThick + 0.01;

  return (
    <group position={center} rotation={[0, rotationY, 0]} userData={{ bakeExclude: true }}>
      {/* 混凝土基础 */}
      <mesh receiveShadow castShadow position={[0, baseY, 0]}>
        <boxGeometry args={[baseX, baseThick, baseZ]} />
        {baseColor ? (
          <meshStandardMaterial color={baseColor} roughness={0.9} metalness={0.02} />
        ) : (
          <primitive object={Materials.concrete} attach="material" />
        )}
      </mesh>

      {/* 找平层（基础与型钢之间的深色薄层） */}
      <mesh receiveShadow position={[0, baseThick + 0.006, 0]}>
        <boxGeometry args={[baseX, 0.012, baseZ]} />
        <meshStandardMaterial color={GROUT_COLOR} roughness={0.88} metalness={0.02} />
      </mesh>

      {/* 左/右型钢导轨（沿 x 方向） */}
      {[-anchorX, anchorX].map((z) => (
        <mesh
          key={`skid-rail-${z}`}
          castShadow
          receiveShadow
          position={[0, railY, z]}
        >
          <boxGeometry args={[railX, railHeight, 0.16]} />
          {railColor ? (
            <meshStandardMaterial color={railColor} roughness={0.34} metalness={0.68} />
          ) : (
            <primitive object={Materials.brushedMetal} attach="material" />
          )}
        </mesh>
      ))}

      {/* 横杆（跨在两导轨之间，沿 z 方向） */}
      {crossXs.map((x, i) => (
        <mesh
          key={`skid-cross-${i}`}
          castShadow
          receiveShadow
          position={[x, railY, 0]}
        >
          <boxGeometry args={[0.16, railHeight, crossLenZ]} />
          {railColor ? (
            <meshStandardMaterial color={railColor} roughness={0.34} metalness={0.68} />
          ) : (
            <primitive object={Materials.brushedMetal} attach="material" />
          )}
        </mesh>
      ))}

      {/* 锚板 + 螺柱 + 螺母（每条导轨 anchorPerRail 处） */}
      {[-anchorX, anchorX].map((z) =>
        anchorZs.map((x, i) => (
          <group key={`skid-anchor-${z}-${i}`} position={[x, anchorY, z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.16, 0.02, 0.16]} />
              <meshStandardMaterial color={ANCHOR_PLATE} roughness={0.52} metalness={0.66} />
            </mesh>
            <mesh castShadow position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.12, 8]} />
              <meshStandardMaterial color={ANCHOR_STUD} roughness={0.2} metalness={0.8} />
            </mesh>
            <mesh castShadow position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.024, 0.024, 0.035, 6]} />
              <meshStandardMaterial color={ANCHOR_NUT} roughness={0.3} metalness={0.8} />
            </mesh>
          </group>
        )),
      )}

      {/* 橡胶减震垫（四角，在导轨之上） */}
      {rubberPads &&
        [
          [-railX / 2 + 0.1, anchorX],
          [railX / 2 - 0.1, anchorX],
          [-railX / 2 + 0.1, -anchorX],
          [railX / 2 - 0.1, -anchorX],
        ].map(([px, pz], i) => (
          <RubberPad3D key={`skid-pad-${i}`} position={[px, railY + 0.01, pz]} />
        ))}

      {/* 高度调整钢垫块（覆盖基础中段，承托设备脚） */}
      <mesh castShadow receiveShadow position={[0, railY + 0.08, 0]}>
        <boxGeometry args={[Math.max(railX - 0.4, 0.4), 0.16, Math.max(crossLenZ - 0.3, 0.4)]} />
        <meshStandardMaterial color={RISER_STEEL} roughness={0.48} metalness={0.58} />
      </mesh>
    </group>
  );
};
