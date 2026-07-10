# 污水 SCADA 管路流程总表

本文档是当前 3D 场景管路连接的基准表。工艺水与污泥管网采用独立的、按流程图重建的实现：

```text
src/components/3d/sections/IndustrialPipeNetwork3D.tsx
src/components/3d/sections/ProcessAndSludgePipeNetwork3D.tsx
```

两者均不依赖旧的 `pipeRoutes.ts` / `anchors.ts` / 旧管路 token。旧文件保留仅作为历史参考，不再驱动画面里的管路。

## 1. 总流程

```mermaid
flowchart LR
  raw["市政/原水来水"] --> lift["进水提升系统"]
  lift --> ph1["PH1 调节池"]
  ph1 --> fenton["芬顿池"]
  fenton --> ph2["PH2 调节池"]
  ph2 --> coag["混凝池"]
  coag --> floc["絮凝池"]
  floc --> clarifier["沉淀池"]
  clarifier --> ph3["PH3 调节池"]
  ph3 --> intermediate["中间池"]
  intermediate --> daf["气浮 DAF"]
  daf --> mixing["深度混合池"]
  mixing --> drainage["排水池"]
  drainage --> outfall["外排 pH 检测池 / 市政管口"]

  pac["PAC 药剂罐"] -.-> mainPac["主处理 PAC 投加点"]
  cacl2["CaCl2 药剂罐"] -.-> mainCacl2["主处理 CaCl2 投加点"]
  pam["PAM 药剂罐"] -.-> mainPam["主处理 PAM 投加点"]
  dafPac["气浮 PAC 药剂罐"] -.-> dafPacPoint["DAF PAC 投加点"]
  dafPam["气浮 PAM 药剂罐"] -.-> dafPamPoint["DAF PAM 投加点"]
  screwPam["叠螺机 PAM 药剂罐"] -.-> screwPoint["叠螺机 PAM 投加点"]

  clarifier -. "沉淀污泥" .-> sludgeTank["污泥池"]
  daf -. "气浮污泥/浮渣" .-> sludgeTank
  sludgeTank -.-> screwPress["叠螺脱水机"]
```

## 2. 当前生效管路

### 2.1 主水线 / 工艺水线

| 管线 ID | 起点 | 终点 | 设计原则 |
|---|---|---|---|
| 进水提升总管 → PH1 | 进水提升泵总管 | PH1 调节池 | 原水主管，走外部清晰折线路径 |
| PH1 → 芬顿 → PH2 → 混凝 → 絮凝 | 池间溢流 / 跌水 | 无外部管路 | 由 `OverflowCascade3D` 表达，不画外部管 |
| 絮凝 → 沉淀 | 絮凝池 | 沉淀池 | 池北侧外部短跳管 |
| 沉淀 → PH3 | 沉淀池 | PH3 调节池 | 池北侧外部短跳管 |
| PH3 → 中间 | PH3 调节池 | 中间池 | 池北侧外部短跳管 |
| 中间池 → 中间提升泵 → DAF | 中间池 / 中间提升泵组 | DAF 气浮池 | 泵前双吸入支路、出水总管和厂区西侧独立走廊 |
| DAF → 深度混合 | DAF 气浮池 | 深度混合池 | 池北侧外部短跳管 |
| 深度混合 → 排水 | 深度混合池 | 排水池 | 池北侧外部短跳管 |
| 排水池 → 排水泵 → 外排 | 排水池 / 排水泵组 | 外排检测池 | 泵前双吸入支路、出水总管和下落管口 |

### 2.2 药剂投加线（独立保留，未纳入本轮重建）

| 管线 ID | 起点 | 终点 | 设计原则 |
|---|---|---|---|
| `fresh-pac-to-main-dosing` | PAC 药剂罐 | 主处理 PAC 投加点 | 高位药剂管廊，垂直下接投加点 |
| `fresh-cacl2-to-main-dosing` | CaCl2 药剂罐 | 主处理 CaCl2 投加点 | 高位药剂管廊 |
| `fresh-pam-to-main-dosing` | PAM 药剂罐 | 主处理 PAM 投加点 | 高位药剂管廊 |
| `fresh-daf-pac-to-daf-dosing` | 气浮 PAC 药剂罐 | DAF PAC 投加点 | 高位药剂管廊 |
| `fresh-daf-pam-to-daf-dosing` | 气浮 PAM 药剂罐 | DAF PAM 投加点 | 高位药剂管廊 |
| `fresh-screw-pam-to-press` | 叠螺机 PAM 药剂罐 | 叠螺机 PAM 投加点 | 最长 PAM 管线，走高位主管后下接叠螺机 |

### 2.3 污泥线

| 管线 ID | 起点 | 终点 | 设计原则 |
|---|---|---|---|
| 沉淀排泥 → 污泥池 | 沉淀池排泥泵组 | 污泥池 | 双泵吸入/出水总管后接入统一接收总管 |
| DAF 浮渣 → 污泥池 | DAF 浮渣泵组 | 污泥池 | 双泵吸入/出水总管，沿深处理外缘接入统一接收总管 |
| 污泥池 → 叠螺机 | 污泥池排泥泵组 | 叠螺脱水机进泥口 | 双泵吸入/出水总管，支管下接叠螺机法兰口 |

## 3. 本轮视觉精修

- 药剂罐底部 4 个黑色小支脚已移除，改为浅色一体式 PE 底座，避免看起来像黑点/脏点。
- 高位药剂管廊已增加门型支架与横梁，减少悬空线条感。
- 长距离外部工艺管继续使用管托支撑，保持工业现场的支撑逻辑。

## 4. 场景挂载位置

主场景挂载现有进水管网，以及本轮新建的工艺水/污泥管网：

```tsx
<IndustrialPipeNetwork3D />
<ProcessAndSludgePipeNetwork3D />
```

挂载文件：

```text
src/components/3d/SCADAScene.tsx
```

旧挂载已撤掉：

```tsx
<ProcessPipeRouting />
<ChemicalPipeRouting />
<SludgePipeRouting />
```

## 5. 建模规则

- PH1 → 芬顿 → PH2 → 混凝 → 絮凝这一段为连续池间溢流，不画外部连接管。
- 主水线采用正交折线、统一高度、统一后侧/外侧走廊，不再沿用旧坐标 token。
- 药剂线走高位管廊，向下接投加点，避免地面七扭八歪。
- 污泥线用棕色管路表达，与主水线和药剂线明确区分。
- 后续如果要恢复计量泵，应做成完整计量泵 skid：药剂罐 → 计量泵撬装 → 投加点。
- 后续主水或污泥管线必须在 `ProcessAndSludgePipeNetwork3D.tsx` 内按工艺走廊统一设计；进水提升段仍维护在 `IndustrialPipeNetwork3D.tsx`。不得使用旧 route/anchor token 直接驱动。

## 6. 下一轮精修重点

- 给药剂管廊增加更真实的管夹、标牌和分支阀。
- 按现场 P&ID 精修各泵组、池壁和叠螺机的真实接口位置。
