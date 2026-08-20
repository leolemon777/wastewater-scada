# SCADA 只读可信化与现场试运行 SPEC / PLAN

| 项目 | 内容 |
| --- | --- |
| 状态 | **实施草案（待按工作包逐项完成）** |
| 基线提交 | `dc9f15fb17d5ca23824af68636ccc38543375f69` |
| 目标版本 | `readonly-trial-v0.1.0` |
| 编制日期 | 2026-08-20 |
| 适用仓库 | `E:\Desktop\SCADA` |

## 1. 文档目的

本文件定义当前 SCADA 项目从“可演示、部分只读采集”收敛到“数据来源可辨、质量状态可信、严格无控制能力、可回滚部署”的实施规格和执行计划。

本文件同时解决以下已确认问题：

- 演示值、保持值、无效值和现场实时值在 UI 中可能混淆。
- 缺少真实排放 Tag 时仍生成趋势、COD、氨氮、总磷和“达标”结论。
- 页面存在看似可执行启停、曝气、刮沫、紧急停机的控件，但实际只修改浏览器状态。
- PLC `Y` 和 M100 `DO` 被误解释为机械设备已经运行。
- M100 从启动即断线、浏览器断线期间刷新或 AI 无效时，页面可能继续显示 demo 或旧值。
- 污水报警缺少 `warning -> critical` 升级路径，M100 通信/数据质量未进入统一报警。
- 现场配置可能覆盖测试禁用开关并被复制进构建产物。
- 当前局域网部署指南、网络脚本和 3D 性能不满足正式投产要求。

本文件是**软件整改与只读试运行的实施权威**，但不替代设备 IP、SN/MAC、接线、GX Works2 参数或现场验收记录。

## 2. 权威来源与冲突处理

发生冲突时按以下顺序处理：

1. 本文件规定只读试运行的软件安全边界、数据质量规则和发布门槛。
2. M100 的现场 IP、位置和接线以最新且经现场复核的 `M100-IP配置-现行版本.md` 为准。
3. 网桥历史和现场变更以带日期的调试记录为准，不从旧计划反推当前状态。
4. 纯水 PLC 继续遵循 `纯水房三菱PLC只读采集模块-SPEC.md`，本试运行版本不得擅自启用。
5. 无线 SSID、密码、M100 密码和其他凭据不得出现在任何 Git 文档、示例或发布包中。

现有文档若声称“断线自动产生报警”“关闭演示后可以手动控制”或“局域网直接访问开发端口”，在对应代码和验收完成前均不视为已实现能力。

## 3. 目标结果

目标版本完成后必须满足：

- 首版只在单台工控机本机运行，浏览器通过本机服务访问。
- 只读接入 M100 `.31` 气浮和 `.8` 地下池。
- 页面能逐 Tag 区分“现场实时、演示、陈旧、无效、离线、未知”；其中 `live` 是“现场来源 + `quality=good`”的派生显示态，不是第二套存储枚举。
- 配置了真实数据源后，即使从未成功采集，也不得回退到 demo。
- 缺少可信数据时显示未知或保持值标识，不生成“达标”结论。
- UI 没有任何可用的设备启停、DO、PLC、曝气、刮沫或紧急控制入口。
- Hub、REST、WebSocket、测试和发布产物均保持只读。
- 现场配置不进入源码目录、构建输出、测试输出或发布包。
- 发布包带版本、提交号、SHA-256 清单和可演练的回滚路径。
- 在目标工控机达到本文规定的功能、稳定性和 3D 性能门槛。

## 4. 首版范围

### 4.1 纳入范围

| 对象 | SourceId | 首版读取内容 | 首版状态 |
| --- | --- | --- | --- |
| 气浮 M100 | `m100-daf-01` | AI1 pH、DO1/DO2 逻辑输出状态 | 纳入只读试运行 |
| 地下池 M100 | `m100-underground-01` | AI1 液位、液位百分比 | 纳入只读试运行 |
| SCADA Hub | 本机服务 | REST 快照、状态、WebSocket、静态前端 | 纳入 |
| 浏览器 UI | 本机 kiosk | 只读显示、质量状态、报警、3D/仪表盘 | 纳入 |

### 4.2 明确排除

- 混合池 `.7` 的 RS485 数据继续由有人云链路保持现状；本版本不启用本地 `edgeen`，不增加第二 Modbus 主站。
- `.30`、`.32` 在传感器信号和 Tag 含义未完成复核前不接入正式画面。
- `.33` 在位置、身份和 IP 未确认前不接入。
- `192.168.2.80`、药剂房 `.78/.79` 不纳入本 M100 首版。
- 纯水 PLC 保持 `Enabled=false`，不执行现场连接。
- 不提供 LAN 远程浏览、互联网访问、云端控制或移动端访问。
- 不实现 `iowrite.cgi`、Modbus 写、PLC 写、远程运行、远程停止或设备参数修改。
- 不把浏览器报警记录声明为正式生产审计系统。

### 4.3 只读试运行 allowlist

目标发布包内置只读试运行 manifest，并纳入 `manifest.sha256`：

```json
{
  "profile": "readonly-trial-v0.1",
  "mappingVersion": "sha256:<normalized-allowlist-and-tag-map>",
  "allowedM100Devices": [
    { "sourceId": "m100-daf-01", "role": "daf", "ipAddress": "192.168.0.31" },
    { "sourceId": "m100-underground-01", "role": "underground", "ipAddress": "192.168.0.8" }
  ],
  "pureWaterPlcAllowed": false,
  "deviceWritesAllowed": false,
  "demoAllowed": false
}
```

启动时必须 fail closed：

- M100 配置集合只能包含上述两个 SourceId，Role/IP 必须完全匹配。
- 允许通过设备级 `Enabled` 分别启用或禁用 `.31/.8`，但不允许新增第三台设备。
- PureWater PLC 只要配置为启用就拒绝启动。
- manifest 缺失、哈希不匹配、profile 不匹配或出现写能力配置时拒绝启动。
- `mappingVersion` 由构建脚本对规范化 allowlist、SourceId/Role/IP 和 Tag 映射计算 SHA-256；snapshot/status 必须携带该值。
- 软件只能验证“配置是否符合批准映射”，不能仅凭 IP 自动证明现场真实 SN/MAC 身份；真实身份由 WP8 现场签字清单确认。

## 5. 不可违反的安全约束

以下约束是发布阻断条件，不得通过配置绕过：

1. M100 传输层只允许 `GET /ioread.cgi?read`。
2. 后端不得出现 M100 写接口、PLC `Write*`、`RemoteRun` 或 `RemoteStop`。
3. WebSocket 收到客户端业务帧必须拒绝，不解释为设备命令。
4. REST 对设备域只允许 GET；不存在控制 POST/PUT/PATCH/DELETE。
5. UI 不得出现可点击的启停、强制、紧急、曝气、刮沫或 DO 控制控件。
6. PLC `Y=ON` 和 M100 `DO=ON` 只能显示为“逻辑输出 ON”或“命令输出 ON”。
7. 只有 DI、接触器、变频器运行反馈、电流或其他经确认反馈才能表示 `verifiedRunning=true`。
8. 协议解析不得把数字 `0` 或布尔 `false` 当成字段缺失；点级量程规则仍可将 4-20mA 输入的 `0uA` 判定为 `invalid`。合法工程零值、DI/DO `false` 和故障电流必须分别测试。
9. 断线不得自动清零，不得把未知伪装成正常停机。
10. 软件测试默认不得连接任何现场设备。
11. 凭据不得写入日志、Git、构建产物、测试产物或发布包。
12. 当前 `scripts/industrial-pc-setup.ps1` 在重写并完成 dry-run/回滚测试前禁止现场执行。
13. `readonly-trial` 构建不得暴露 `window.__scadaStore`，不得包含可改变现场 Equipment 状态的 mutation actions。
14. `TagState` 是现场遥测的唯一可变事实源；Equipment catalog 只保存静态元数据，UI/3D 使用由 TagState 派生的只读 ViewModel。

## 6. 目标架构

```text
M100 .31 / .8
  -- HTTP GET ioread.cgi --> ScadaHub M100 Adapter
  --> 原始点 + 工程换算 + 点质量
  --> M100StateCache
  --> scada.v1 WebSocket / REST
  --> scadaRealtimeClient（信封校验、来源白名单、序号防回退）
  --> Zustand TagState（来源、质量、当前值、末次好值、数据龄）
  --> Dashboard / Overlay / 3D / Alarm

本地 Demo
  --> 仅开发构建中的独立 /demo 路由和独立 Store
  --> 不进入现场 TagState、现场报警或现场全局 critical
```

浏览器不得直接访问 M100、网桥或 PLC。所有设备访问均收敛在 SCADA Hub。

`TagState` 是唯一可变遥测状态。现有 Equipment 对象中的 `pH/level/runStatus` 等现场字段必须逐步改成只读 selector/ViewModel；demo tick、live ingestion 和 UI action 不得再直接 patch 同一个现场字段。

## 7. 统一 Tag 状态模型

### 7.1 前端最小类型

新增统一类型，建议放入 `src/store/tagQuality.ts`：

```ts
export type TelemetrySource =
  | 'demo'
  | 'm100'
  | 'plc'
  | 'youren'
  | 'unknown';

export type TelemetryQuality =
  | 'good'
  | 'stale'
  | 'invalid'
  | 'offline'
  | 'suppressed'
  | 'unknown';

export interface TagState<T> {
  value: T | null;
  lastGoodValue: T | null;
  source: TelemetrySource;
  sourceId: string | null;
  quality: TelemetryQuality;
  sampledAt: number | null;
  receivedAt: number | null;
  sourceEpoch: string | null;
  eventSeq: number | null;
  dataSequence: number | null;
  mappingVersion: string | null;
  warning?: string;
}
```

`value` 表示当前可用于业务判断的值；`lastGoodValue` 只用于明确标记的保持值显示，不参与实时报警或合规计算。

生命周期规则：

- `quality=invalid/stale/offline/unknown` 时业务 `value` 必须为 `null`。
- `lastGoodValue` 只能由同一现场 `sourceId + mappingVersion` 的 `good` 帧写入。
- demo 不得写入现场 `lastGoodValue`。
- SourceId 或 mappingVersion 变化时必须清除不匹配的 `lastGoodValue`。
- UI 只能在单独的“保持值”区域读取 `lastGoodValue`；报警、合规和真实运行确认只读取 `value`。

### 7.2 质量和显示规则

| 条件 | source | quality | 主显示 | 辅助标识 | 可参与报警/合规 |
| --- | --- | --- | --- | --- | --- |
| 未配置、无数据 | `unknown` | `unknown` | `--` | 未接入 | 否 |
| 明确演示模式 | `demo` | `good` | 演示值 | DEMO | 否 |
| 当前结构有效、transport 成功且该 Tag 有效 | `m100/plc` | `good` | 当前值 | 现场实时 | 是 |
| 数据超过 stale 阈值 | 原来源 | `stale` | 末次好值或 `--` | 陈旧/数据龄 | 否 |
| 当前点无效/故障电流 | 原来源 | `invalid` | `--` | 信号异常；可附末次好值 | 否 |
| 源断线 | 原来源 | `offline` | 末次好值或 `--` | 离线/保持值 | 否 |
| 安全硬门禁开启 | 原来源 | `suppressed` | `--` | 安全锁定/I/O 已抑制 | 否 |

规则：

- UI 若显示 `lastGoodValue`，必须同时显示“保持值”和数据龄，视觉上不得与实时值相同。
- `quality !== good` 时，值不得用于设备真实运行确认、合规判断或新的过程阈值报警。
- source/transport 在必需数组结构有效且 HTTP/协议成功的第一帧恢复 `good`；工程量程异常只影响对应 Tag，不得把同帧有效 DO/DI 或其他 Tag 一并降质。
- 前端按 `sourceId + sourceEpoch + eventSeq` 维护最后事件序号；epoch 改变时重置该来源的事件游标和非持久末值。
- 服务端时间用于审计，本地单调时钟用于数据龄和重连 watchdog。

首版新鲜度规则集中定义为：

| 条件 | 派生状态 |
| --- | --- |
| `configuredEnabled=false` | `unknown/not-configured` |
| `ioSuppressed=true` | `suppressed/safety-lock` |
| `configuredEnabled=true` 且最近结构有效 transport 成功帧年龄 `<=10s` | `live`（各 Tag 仍按点质量显示） |
| 最近结构有效 transport 成功帧年龄 `>10s` 且 `<=30s` | `stale` |
| `connected=false` 或最近结构有效 transport 成功帧年龄 `>30s` | `offline` |
| 当前点解析/量程失败，但同帧其他点有效 | 仅该点 `invalid` |

阈值必须由单一共享配置/协议字段提供，前后端不得各自硬编码不同值。

### 7.3 首版 Tag ownership

首版使用固定映射，不允许任意配置把 SourceId 指向其他设备：

| SourceId | Tag | 语义 |
| --- | --- | --- |
| `m100-daf-01` | `tk-daf.pH` | AI1 工程换算 pH |
| `m100-daf-01` | `tk-daf.aerationCommanded` | DO1 逻辑输出，不代表曝气机构已运行 |
| `m100-daf-01` | `tk-daf.scraperCommanded` | DO2 逻辑输出，不代表刮沫机构已运行 |
| `m100-underground-01` | `tk-intermediate.levelValue` | AI1 工程换算液位 |
| `m100-underground-01` | `tk-intermediate.levelPercent` | 按已批准量程换算百分比 |

现有 `aerationRunning/scraperRunning` 若仍被 3D 使用，迁移时必须改名或增加明确的 `commanded` 与 `verified` 双状态；不得继续用 DO 直接驱动物理运行确认。

### 7.4 demo 隔离规则

- `readonly-trial` 构建中不包含 demo scheduler、demo 切换按钮或 demo Store，`demoMode=false`、`pureWaterDemoMode=false` 且不可通过运行时配置开启。
- 开发构建如需 demo，只能使用独立 `/demo` 路由和独立 Store；页面持续显示醒目 DEMO 横幅。
- demo 报警只能进入独立 DEMO 区，不能进入现场报警列表、全局 critical 或现场审计。
- 现场 SourceId 一旦配置启用，就立即取得对应 Tag ownership；即使从启动开始一直 401、超时或断网，也不得回退 demo。
- demo 和 live 不得进入同一个 TagState 或 Equipment 可变字段。

## 8. 后端实时信封要求

### 8.1 版本和顺序语义

首版继续使用 `schema=scada.v1`，M100 payload 增加 `contractVersion=2`。这是一次受控的加法迁移：

- `payload.tags` 是新前端唯一权威业务值。
- 旧 `do/di/ai/points/sequence` 可在一个过渡版本中保留，仅供旧客户端兼容，新 UI 不得消费。
- `sourceEpoch` 是 Hub 每次进程启动生成的 UUID，同一进程生命周期不变。
- 信封顶层 `seq` 定义为 `eventSeq`：该 SourceId 的每个 snapshot、status 和恢复事件都严格递增。
- `payload.dataSequence` 只在完整成功采集时递增，失败/status 事件保持最后成功值。
- 前端按 `(sourceId, sourceEpoch, eventSeq)` 防回退。收到新 epoch 时接受其初始事件并清除旧进程的非持久末值。
- Hub 重启后允许 `eventSeq/dataSequence` 从 1 重新开始，因为 `sourceEpoch` 已改变。

### 8.2 唯一 M100 snapshot 结构

时间格式固定为：

- 信封 `timestamp`：UTC ISO-8601 字符串。
- payload 内 `receivedAt/sampledAt/lastSuccessAt`：Unix epoch milliseconds 整数或 `null`。
- M100 没有设备采样时间时，`sampledAt` 等于一次完整 HTTP 响应被验证通过后的 `receivedAt`。

完整示例：

```json
{
  "schema": "scada.v1",
  "messageType": "m100.snapshot",
  "sourceId": "m100-daf-01",
  "sourceType": "m100-http",
  "sourceEpoch": "9a2d2b2e-2c12-42d6-979d-2fd9efbba840",
  "seq": 42,
  "timestamp": "2026-08-19T12:00:00.000Z",
  "quality": "good",
  "payload": {
    "contractVersion": 2,
    "mappingVersion": "sha256:7e5f...",
    "configuredEnabled": true,
    "ioSuppressed": false,
    "connected": true,
    "receivedAt": 1787140800000,
    "lastSuccessAt": 1787140800000,
    "dataSequence": 18,
    "raw": {
      "do": { "do01": true, "do02": true },
      "di": {},
      "ai": { "ai01": 9699 }
    },
    "tags": {
      "tk-daf.pH": {
        "value": 4.987,
        "lastGoodValue": 4.987,
        "quality": "good",
        "unit": "pH",
        "rawKey": "ai01",
        "rawValue": 9699,
        "rawUnit": "uA",
        "sampledAt": 1787140800000,
        "warning": null
      },
      "tk-daf.aerationCommanded": {
        "value": true,
        "lastGoodValue": true,
        "quality": "good",
        "unit": "boolean",
        "rawKey": "do01",
        "rawValue": true,
        "rawUnit": "boolean",
        "sampledAt": 1787140800000,
        "warning": null
      },
      "tk-daf.scraperCommanded": {
        "value": true,
        "lastGoodValue": true,
        "quality": "good",
        "unit": "boolean",
        "rawKey": "do02",
        "rawValue": true,
        "rawUnit": "boolean",
        "sampledAt": 1787140800000,
        "warning": null
      }
    },
    "warnings": []
  }
}
```

要求：

- `quality` 顶层表示 source/transport 质量；`tags[*].quality` 表示逐 Tag 质量，两者不得混为一个布尔状态。
- pH 无效时只把 `tk-daf.pH` 标为 `invalid`，同一帧有效的 DO Tag 仍可为 `good`。
- `configuredEnabled` 来自 `M100.Enabled && Device.Enabled`；`ioSuppressed` 单独表达硬门禁，二者不得互相覆盖。
- 断线初始快照可携带同一 Hub 进程内的末次好值，但 `value=null`、`connected=false`、点质量为 `offline`。
- Hub 未重启、仅浏览器刷新时，可从内存缓存恢复保持值。
- Hub 已重启且首版未实现持久缓存时，只恢复 ownership + offline/unknown，不承诺恢复保持值。
- 若未来要求跨 Hub 重启恢复末值，必须另行设计带 sourceEpoch、量程版本、完整性校验和过期策略的持久缓存。

### 8.3 Role 最小响应要求

| Role | 必需数组 | 可选数组 | source/transport 成功条件 |
| --- | --- | --- | --- |
| `daf` | `do` 长度 `>=2`、`ai` 长度 `>=1` | `di` | DO1/DO2 可解析，AI1 存在；AI1 点质量可独立 invalid |
| `underground` | `ai` 长度 `>=1` | `do`、`di` | AI1 存在；量程失败只产生 Tag invalid |

缺失必需数组、数组长度不足、JSON 空对象或值类型错误时，不发布 `source quality=good`。

### 8.4 status、heartbeat 和原子回放

- `source.status` 使用同一 `sourceEpoch`，并分配新的顶层 `eventSeq`；不得复用上一成功快照的 eventSeq。
- `source.status.payload.dataSequence` 保持最后完整成功帧序号。
- Hub 每 `5s` 发布 `hub.heartbeat`；前端 `15s` 未收到 heartbeat 进入 Hub stale，`30s` 未收到进入 Hub offline 并主动重连。
- `RegisterAndReplay` 必须相对广播入队原子化：在短时 publisher ordering lock 内注册客户端队列、入队当前快照/状态 barrier、切换为 live；锁内不得执行网络发送。
- 客户端在新 `sourceEpoch` 下收到初始回放后重新建立游标。

`source.status` 唯一结构：

```json
{
  "schema": "scada.v1",
  "messageType": "source.status",
  "sourceId": "m100-daf-01",
  "sourceType": "m100-http",
  "sourceEpoch": "9a2d2b2e-2c12-42d6-979d-2fd9efbba840",
  "seq": 43,
  "timestamp": "2026-08-19T12:00:03.000Z",
  "quality": "offline",
  "payload": {
    "contractVersion": 2,
    "mappingVersion": "sha256:7e5f...",
    "configuredEnabled": true,
    "ioSuppressed": false,
    "connected": false,
    "lastSuccessAt": 1787140800000,
    "dataSequence": 18,
    "reasonCode": "request-timeout",
    "reason": "request timed out"
  }
}
```

应用规则：

- `configuredEnabled=false`：所属 Tag 变为 unknown，`value=null`。
- `ioSuppressed=true`：所属 Tag 变为 suppressed，`value=null`，显示“安全锁定/I/O 已抑制”，不产生普通设备离线报警。
- `connected=false`：所属 Tag 变为 offline，`value=null`；同一 mappingVersion 的 lastGoodValue 可保留为明确保持值。
- status 不包含新的过程值，不修改 dataSequence，不根据旧值产生过程报警/RTN。
- 新 mappingVersion 时清除旧 mappingVersion 的 lastGoodValue。
- `reasonCode` 使用稳定枚举；`reason` 必须脱敏，不包含 URL 凭据、Authorization、用户名或密码。

`hub.heartbeat` 唯一结构：

```json
{
  "schema": "scada.v1",
  "messageType": "hub.heartbeat",
  "sourceId": "scada-hub",
  "sourceType": "scada-hub",
  "sourceEpoch": "9a2d2b2e-2c12-42d6-979d-2fd9efbba840",
  "seq": 204,
  "timestamp": "2026-08-19T12:00:05.000Z",
  "quality": "good",
  "payload": {
    "contractVersion": 2,
    "version": "readonly-trial-v0.1.0",
    "commit": "dc9f15fb17d5ca23824af68636ccc38543375f69",
    "uptimeMs": 65000
  }
}
```

Hub heartbeat 使用固定 `sourceId=scada-hub`，自己的 eventSeq 严格递增；它只证明 Hub/WS 通道存活，不证明任何设备数据健康。

## 9. UI 规格

### 9.1 只读标识

所有污水和纯水页面固定显示：

```text
只读监视｜未开放设备控制
```

以下文案不得出现在现场构建：

- 强制启动
- 紧急联锁停机
- 立即切断电源
- 手动启动设备
- 关闭演示后可手动控制

设备区域标题从“设备集控”改为“设备状态”。开关控件应替换为状态标签，而不是仅用 CSS 伪装禁用。

`aerationCommanded/scraperCommanded` 和 PLC `Y` 只能驱动“逻辑输出”指示，不能驱动代表物理运行的气泡、波纹、旋转、流动动画、运行灯或 `verifiedRunning`。缺少独立反馈时，物理运行状态固定显示“未验证”。

### 9.2 数据质量展示

每个正式接入点至少显示：

- 当前值或 `--`
- 单位
- 来源名称
- `现场实时 / DEMO / 陈旧 / 信号异常 / 离线 / 未接入`
- 最后成功时间或数据龄
- 保持值标识（如适用）

顶部必须展示 Hub 状态、每台 M100 状态和未确认通信报警数。

### 9.3 趋势和合规

- 禁止在现场模式调用正弦函数或场景常量生成“近 60 秒趋势”。
- 没有历史服务时显示“历史趋势未接入”。
- 演示曲线必须标明“演示曲线，不代表现场”。
- COD、氨氮、总磷无真实 Tag 时显示 `-- / 未接入`。
- 不允许 `pH ?? 7.0` 或其他正常值回退。
- 只有全部必要排放 Tag 的 `source` 属于该 Tag 批准的现场 SourceId allowlist、`quality=good`、`value!=null`，并且阈值来源已批准时，才允许计算“达标/超标”。
- 任一必要 Tag 未接入、无效、陈旧或离线时显示“无法判定”。
- 工艺控制范围和排放法规范围必须分开配置，不得全站共用一个 pH `6-9` 阈值。

## 10. 报警状态机

### 10.1 状态转换

| 原状态 | 新状态 | 动作 |
| --- | --- | --- |
| `none` | `warning` | 创建 warning 活动报警 |
| `none` | `critical` | 创建 critical 活动报警 |
| `warning` | `critical` | 升级同一活动报警，更新时间并重新置为未确认 |
| `critical` | `warning` | 当前严重度降级，历史最高严重度保持 critical |
| `warning/critical` | `none` | 产生 RTN 恢复记录并关闭活动报警 |
| 任意过程状态 | `unknown` | 不产生过程恢复；另外产生数据质量/通信报警 |

报警记录最小字段：

```ts
interface AlarmRecord {
  alarmKey: string; // sourceId:(tagId or _):ruleId
  scope: 'hub' | 'source' | 'tag';
  sourceId: string;
  tagId: string | null;
  ruleId: string;
  currentSeverity: 'warning' | 'critical';
  peakSeverity: 'warning' | 'critical';
  firstRaisedAt: number;
  lastChangedAt: number;
  acknowledged: boolean;
  acknowledgedAt: number | null;
  returnedToNormalAt: number | null;
}
```

- 同一 `alarmKey` 同时最多一个活动报警。
- `warning -> critical` 时 `currentSeverity/peakSeverity` 更新为 critical，`acknowledged=false`，需要重新确认。
- `critical -> warning` 时 currentSeverity 降级，peakSeverity 保持 critical；确认状态不自动改变。
- RTN 关闭活动报警但保留完整记录。

保留键：

- Hub：`scada-hub:_:hub-stale`、`scada-hub:_:hub-offline`。
- Source：`${sourceId}:_:source-stale`、`${sourceId}:_:source-offline`、`${sourceId}:_:io-suppressed`。
- Tag：`${sourceId}:${tagId}:tag-invalid`。

### 10.2 通信和质量报警

首版必须支持：

- M100 stale。
- M100 offline/disconnected。
- AI 故障电流或工程值无效。
- Hub WebSocket 失联或长时间无消息。
- 恢复通信后的 RTN。

精确触发和恢复规则：

| ruleId | 触发 | 严重度 | 恢复 |
| --- | --- | --- | --- |
| `source-stale` | 最近结构有效 transport 成功帧年龄 `>10s` | warning | 第一成功帧恢复 live，第二个连续成功帧关闭报警并 RTN |
| `source-offline` | 显式 `connected=false` 或最近结构有效 transport 成功帧年龄 `>30s` | critical | 第一成功帧恢复 live，第二个连续成功帧关闭报警并 RTN |
| `tag-invalid` | 连续 2 个采集帧同一 Tag invalid | warning | 第一 good 帧恢复当前值，第二个连续 good 帧关闭报警并 RTN |
| `hub-stale` | heartbeat 年龄 `>15s` | warning | 第一 heartbeat 恢复连接态，第二个连续 heartbeat 关闭报警并 RTN |
| `hub-offline` | heartbeat 年龄 `>30s` | critical | WebSocket 重连后第一 heartbeat 恢复连接态，第二个连续 heartbeat 关闭报警并 RTN |
| `io-suppressed` | configuredEnabled 且 `ioSuppressed=true` | warning（安全状态） | `ioSuppressed=false` 后第一结构有效 transport 成功帧 RTN |

去重规则：

- `source-offline` 激活后关闭或抑制同来源的 `source-stale` 通知，恢复时不产生重复 RTN。
- `hub-offline` 激活后关闭或抑制 `hub-stale` 通知，恢复时只产生一次 Hub RTN。
- `io-suppressed` 激活时不产生普通 source-stale/source-offline，Tag 统一为 `suppressed`；解除后再按实际连接状态评估。
- 点级 invalid 可保留为独立活动记录，但 source offline 期间不重复弹出点级通知；重连后按新帧重新评估。
- stale/offline 时不得根据旧过程值产生新的过程报警或过程 RTN。
- 质量报警不得被设备过程值的旧状态清除。
- 全局 critical 横幅和未确认计数不得按当前系统页面过滤。

### 10.3 审计边界

首个只读试运行版本可继续使用现有前端报警列表做辅助显示，但必须明确“非正式报警审计”。正式生产前，报警产生、升级、确认、RTN 和用户操作必须持久化到 Hub 侧存储。

## 11. 配置和凭据规格

### 11.1 外部配置

真实配置固定放在：

```text
C:\ProgramData\WastewaterScada\config\appsettings.local.json
```

仓库和发布包只允许包含无密码的 example。

### 11.2 配置优先级

配置优先级从低到高：

1. 仓库默认 `appsettings.json`（全部 adapter 禁用）。
2. 外部 ProgramData 配置。
3. 环境变量。
4. 命令行参数。
5. 独立的硬禁用进程环境门禁 `SCADA_DISABLE_ALL_DEVICE_IO=1`。

生产配置源必须按上述顺序显式重新注册，不能在 CreateBuilder 的环境变量/命令行之后再追加 ProgramData JSON。

硬门禁不进入普通 `IConfiguration`：启动代码直接读取进程环境变量，并按以下逻辑计算：

```text
ioSuppressed = builder.Environment.IsEnvironment("Testing")
               OR (SCADA_DISABLE_ALL_DEVICE_IO == 1)

configuredEnabled = M100.Enabled AND Device.Enabled
networkIoAllowed = configuredEnabled
                   AND NOT ioSuppressed
                   AND readonlyTrialAllowlistMatched
```

Testing 环境完全跳过 ProgramData 配置加载；`builder.Environment` 必须同时覆盖 `DOTNET_ENVIRONMENT`、`ASPNETCORE_ENVIRONMENT` 和测试 Host 的 `UseEnvironment` 结果。测试项目使用合成的高优先级内存配置模拟 hostile local（设备配置启用），绝不能读取真实 local。`configuredEnabled` 与 `ioSuppressed` 必须同时出现在健康/诊断状态中：合成配置可表达“已配置启用”，但 transport factory/create/read 调用仍必须为 0。

`M100DeviceOptions` 必须新增设备级 `Enabled`，现场 WP8 才能先单独启用 `.31`、再单独启用 `.8`。

首版外部配置必须始终列出 allowlist 中两台设备，初始均为设备级禁用；现场只切换 `Devices[*].Enabled`：

```json
{
  "M100": {
    "Enabled": true,
    "Devices": [
      { "Enabled": false, "SourceId": "m100-daf-01", "Role": "daf", "IpAddress": "192.168.0.31" },
      { "Enabled": false, "SourceId": "m100-underground-01", "Role": "underground", "IpAddress": "192.168.0.8" }
    ]
  },
  "PureWaterPlc": { "Enabled": false }
}
```

示例省略用户名/密码字段；真实值只能存在 ProgramData 外部配置中。

### 11.3 ACL

- 现场配置只允许专用 Windows 服务账户读取。
- Administrators 可维护。
- 普通 Users 和 Authenticated Users 不得读取或修改。
- 日志目录可授予服务账户写入，但配置目录不得授予服务账户写入。

### 11.4 构建排除

`ScadaHub.csproj` 必须明确保证：

- `appsettings.local.json` 不复制到 output。
- `appsettings.local.json` 不复制到 publish。
- 测试输出不包含现场配置。
- 敏感扫描匹配非空 password/secret/API key/token 值、已知真实凭据、异常高熵值和 local 配置文件；允许 example 中明确的空值/占位符，也不得把 `CancellationToken` 等类型名误报为凭据。
- 写路径扫描仅检查可执行源码、路由、适配器和编译产物；安全说明文档中出现“禁止 iowrite.cgi”不得误报。

### 11.5 已提交凭据处理

发布前必须：

1. 先轮换已进入 Git 历史的无线和管理凭据。
2. 将相关文档改为脱敏历史记录。
3. 使用经批准的历史清理方案移除敏感内容。
4. 协调远端历史更新和所有克隆副本重新同步。
5. 再次执行仓库和发布包敏感扫描。

历史清理的证据必须包含全 Git history 扫描，不得只扫描当前工作树。本仓库已确认受跟踪历史记录中存在真实无线/管理凭据，因此该项是发布前必做安全处置；执行历史重写仍需单独备份和协调远端。

仅删除当前文件不算完成。

## 12. 采集与 WebSocket 可靠性

### 12.1 采集和发布解耦

- Collector 成功读取并提交缓存后即完成本周期，不等待浏览器网络发送。
- 每个 WebSocket 客户端使用独立、有界发送队列。
- 首版默认每客户端最多 `64` 条消息或 `1MiB` 排队数据，以先达到者为准；发送超时 `5s`；最大客户端数 `8`。
- 只有 `m100.snapshot`、纯水 snapshot 和 `hub.heartbeat` 可以按 `sourceId + messageType` 合并为最新值。
- `source.status`、报警、确认和 RTN 不得静默丢弃；非可合并消息无法入队时，以 WebSocket `1013` 关闭慢客户端，使其重连并回放。
- 浏览器慢、半断或不读取数据不得被解释为 M100/PLC 采集失败。
- 排队、序列化和发送异常必须在 Publisher 内部收敛，不能进入 Collector 的设备失败捕获域。

### 12.2 初始回放和序号

- 单一客户端的初始快照和后续广播通过同一个发送队列排序。
- 每来源 eventSeq 严格递增，dataSequence 仅成功采集递增。
- 前端拒绝同一 sourceEpoch 下 `eventSeq <= lastAcceptedEventSeq[sourceId]` 的事件。
- WebSocket 客户端以 `hub.heartbeat` 而不是业务数据作为 deadman；15s stale、30s offline/主动重连。
- 坏 JSON、错 schema、未知 source 和字段清洗失败必须进入诊断计数，不得静默丢弃。

### 12.3 M100 HTTP 约束

- 禁用系统代理和自动重定向。
- 响应体上限固定为 `64KiB`。
- Content-Type allowlist 固定为 `application/json`、`text/json`、`text/plain`、`text/html`；后两者只允许固定 M100 IP、body 小于 64KiB 且严格 JSON 解析成功。Gate A 前使用已批准的只读记录或脱敏响应 fixture 冻结 `.31/.8` 实际响应头，Gate D 再现场复核。
- Role 按第 8.3 节校验所需数组；`di` 首版不强制存在。
- 请求超时、取消和服务停机不得留下无限增长的后台任务。
- 停止服务时先取消轮询，再释放 transport。
- 软件启动只验证配置和 manifest 一致性；真实 SN/MAC/物理身份由现场标签、签字清单及技术上可观察时的 ARP/MAC 证据确认。

## 13. 健康检查

健康状态分层：

| 端点 | HTTP 规则 | 含义 |
| --- | --- | --- |
| `GET /api/health/live` | 进程存活返回 200 | 进程和事件循环存活 |
| `GET /api/health/ready` | 内部缓存、Publisher、静态资源可服务返回 200，否则 503 | 服务是否可接受浏览器请求 |
| `GET /api/sources/status` | 服务可用时返回 200 数组 | 每台源的 configuredEnabled、ioSuppressed、connected、quality、lastSuccessAt、mappingVersion、sourceEpoch、eventSeq、dataSequence |

source 全断不使 readiness 返回 503；它必须通过 `/api/sources/status` 和 UI/报警明确表达。进程健康、服务就绪和现场数据健康是三个不同概念。

`/api/health/live` 和 `/api/health/ready` JSON 至少包含 `status`、`version`、`commit`、`timestamp`；sources/status 每项字段和枚举必须生成稳定契约测试。旧 `/api/health` 只作为兼容聚合端点，不得再单独用于现场数据健康判断。

## 14. 测试隔离规格

### 14.1 runtime smoke

测试拆成两个边界，不给生产程序增加“通过配置切换 Fake Transport”的后门。

发布程序集 smoke（`npm run hub:runtime`）必须：

- 使用临时 content root 或显式 Testing 配置。
- 不加载 ProgramData 或源码目录中的现场 local 配置。
- 强制 `SCADA_DISABLE_ALL_DEVICE_IO=1`。
- 使用真实发布 DLL，验证 `ioSuppressed=true`、REST/WS/heartbeat/只读拒绝和进程启停。
- 通过生产 transport factory 的计数/拒绝型守卫断言 factory create/read 为 `0`，但不执行任何网络请求。
- 适配“纯水初始快照 + 多个 M100 初始快照”的 WebSocket 行为。
- 客户端发送业务帧后仍验证只读拒绝，但先完整处理合法初始回放。

测试 Host 集成测试（`ScadaHub.Tests`）必须：

- 通过测试项目 DI 注入计数 Fake Transport。
- 在 adapter 配置启用但 `ioSuppressed=true` 时断言 Fake factory/create/read 均为 `0`。
- 成功、失败、退避业务流直接实例化注入 Fake 的 Collector；API/WS 集成测试通过测试程序集直接注入缓存/Publisher fixture，不解除 Testing 的 ioSuppressed 硬门禁。
- 不允许测试程序集的 Fake 注册入口出现在生产配置面。

### 14.2 前端自动测试

采用 Vitest，新增固定命令 `npm run test:store`；测试纯 Store/decoder 行为，不能只依赖源码正则。至少覆盖：

1. 生产初始状态 demo 关闭。
2. 显式 demo 带 DEMO 标识。
3. demo 关闭后演示 Tag 变为 unknown。
4. 已启用 M100 从启动即断线，不显示 demo。
5. 浏览器在断线期间刷新，仍保持 source ownership。
6. 有效帧只更新本帧包含的 Tag。
7. `ph=null + warning` 显示 invalid，不把末值显示为 live。
8. stale、offline、恢复和 RTN。
9. `warning -> critical` 升级。
10. 跨系统 critical 始终可见。
11. 同一 sourceEpoch 的旧 eventSeq 不覆盖新事件；新 sourceEpoch 可重新建立游标。
12. 控制控件和执行性文案在现场构建中不存在。
13. 浏览器不刷新而 Hub 重启时，识别新 sourceEpoch 并恢复收帧。
14. Hub 重启且无持久缓存时显示 ownership + offline/unknown，不伪造保持值。
15. DI/DO `false`、合法工程零值和 AI `0uA invalid` 三者不混淆。

### 14.3 后端自动测试

至少覆盖：

- local 配置存在且启用设备时，Testing 仍产生 `0` 次真实调用。
- 环境变量/命令行可以最高优先级禁用全部设备。
- 重复 IP、未知 SourceId、Role/IP 错配和大小写错误启动失败。
- 空 JSON、缺数组、超长响应、重定向和错误 Content-Type。
- 慢 WebSocket 客户端不阻塞 Collector。
- Publisher 异常不改变设备连接状态。
- 初始快照和广播顺序可由 sourceEpoch + eventSeq 判定，dataSequence 只表示成功采集。
- 停机期间不发生 transport 释放竞态。
- 只读守卫在找不到目标源码/程序集时必须失败，而不是跳过。

## 15. 现场 UI 静态守卫

新增检查，例如：

```text
scripts/checks/scene/check-readonly-trial-ui.mjs
scripts/checks/scene/check-m100-source-quality.mjs
```

守卫至少检查：

- 不存在 `iowrite.cgi`。
- 不存在设备控制 POST/WS 消息。
- 现场 UI 不调用 `toggleEquipmentRunStatus/toggleValve/toggleAgitator/toggleAeration/toggleScraper` 或其他设备 mutation action。
- 不存在“强制启动/紧急停机/立即切断电源”。
- 不存在生产路径的固定 pH `7.0/7.20` 回退。
- 不存在硬编码 COD、氨氮、总磷合规值。
- M100 source 配置启用后禁止 demo ownership。
- readonly-trial bundle 不暴露 `window.__scadaStore`。
- readonly-trial Store 不导出可修改现场设备状态的 action。
- `aerationCommanded/scraperCommanded` 和 PLC `Y` 不驱动物理运行动画、运行灯或 verifiedRunning。

静态守卫不能替代行为测试，两者都必须通过。

## 16. 3D 性能整改规格

### 16.1 当前基线

本次审查基线：Intel Iris Xe、1280x720 CSS 视口、Canvas 实际 2560x1440，生产构建约：

- `6.2 FPS`
- `5,581 draw calls/frame`
- `2.80M triangles/frame`
- 约 `9,000 geometries`
- `146 textures`

### 16.2 低风险顺序

1. WP6.0 建立固定相机位、采样脚本和机器可读基线。
2. Dashboard 和浏览器后台时暂停 Canvas。
3. readonly-trial 强制、持久锁定工控机运行模式，不加载巡检员 GLB。
4. 删除无 Effect 的 `EffectComposer`。
5. 工控机运行模式使用 DPR `1-1.25`，关闭非必要阴影和环境效果。
6. `Pipe3D` 先只降低径向/纵向细分，不同时改变路径算法。
7. 共享重复 CanvasTexture 并验证 dispose。
8. 按单个工段实施 Instances。
9. 最后替换全局运行时 StaticGeometryBaker。

### 16.3 性能门槛

WP6 开发期间使用候选生产构建做性能预验收；最终签核只能使用 WP7/Gate B 生成的同一不可变发布包。WP6.0 必须把以下内容冻结到 `scripts/performance/scene-profile.json`：

- 目标工控机型号、CPU/GPU/RAM、显卡驱动、Windows 和浏览器版本。
- 6 个固定 `qaPosition/qaTarget`：全局、进水、主处理、深度处理/气浮、污泥、纯水。
- 1920x1080、浏览器 100%、硬件加速开启。
- 每个相机位至少预热 15 秒（晚于当前 Baker 第二次合批），连续采样 60 秒，重复 3 轮。
- 每轮保存 FPS、P50/P95/P99 frame time、calls、triangles、geometries、textures 和 context loss。
- 三轮均必须达到硬门槛；不得只挑最好一轮。

硬门槛：

- 全局视图稳定 `>= 30 FPS`。
- P95 帧时间 `<= 33ms`。
- 全局 draw calls `<= 500`。
- 工段近景 draw calls `<= 300`。
- 全局 triangles `<= 1.8M`。
- geometries `< 3,000`，textures `< 80`。
- `gl.getPixelRatio() <= 1.25`。
- readonly-trial 网络资源记录中不请求巡检员 GLB，场景中无该实例。
- Dashboard 切换后允许 2 秒收敛，随后观察 10 秒 renderer frame 增量 `<=1`。
- `document.hidden=true` 使用同一停帧门槛；恢复 3D/前台后 1 秒内正确重绘最新数据。
- 视图往返 5 轮后 geometries/textures 回到稳定基线。
- 8 小时 soak：预热后首小时与末小时的 heap/geometries/textures 窗口均值差异 `<=10%`，且不存在连续三个 30 分钟窗口单调增长。
- 正常 8 小时测试 WebGL context loss 为 0；另做一次人工 context-loss/restored 恢复测试。
- 从浏览器 navigationStart 到根节点出现 `data-scada-ready="true"` 且页面可交互 `<=5s`。该标记只有在初始 Store 完成、当前路由渲染和 Suspense/必要资产全部完成后设置；不得用固定 loader 延时或 Canvas onCreated 代替。

新增 `scripts/performance/measure-scene-performance.mjs` 和开发机固定命令 `npm run perf:scene`。同时生成独立的 `WastewaterScada-QA-<version>` 便携 QA 工具包，内含锁定运行时、scene-profile、测量程序、version 和 SHA-256；目标机不安装 Node.js，该工具只允许访问 `127.0.0.1` 本机页面，不含设备凭据或设备网络访问能力，验收后移除。两种入口输出相同 JSON、截图和版本信息，作为 Gate C 证据归档。

远程桌面测量不能替代工控机本机 GPU 验收。

## 17. 发布架构

### 17.1 首版单机架构

- Hub 仅监听 `127.0.0.1`。
- Hub 提供构建后的 `wwwroot` 静态前端、REST 和 WebSocket。
- 浏览器 WS 地址从 `window.location` 推导，仍允许显式环境覆盖。
- 工控机使用本机 kiosk 浏览器访问。
- 不运行 Vite dev server，不对 LAN 开放 5173/18080。

### 17.2 后续 LAN 架构

只有另行完成身份认证和网络评审后，才允许：

- IIS/Caddy/Nginx 提供单一 HTTPS/WSS 入口。
- `/api`、`/ws` 反代到 loopback Hub。
- 精确 AllowedHosts/Origin。
- 防火墙只允许批准的 HMI IP 访问 443。
- 设置认证、客户端上限和访问日志。

CORS/Origin 不是身份认证，不能以“同网段”替代权限控制。

## 18. 发布包规格

建议目录：

```text
WastewaterScada-ReadonlyTrial-<version>/
|-- app/
|   |-- ScadaHub.exe
|   |-- ScadaHub.dll
|   `-- wwwroot/
|-- config/
|   `-- appsettings.local.example.json
|-- scripts/
|   |-- Install-ReadonlyTrial.ps1
|   |-- Uninstall-ReadonlyTrial.ps1
|   |-- Start-ReadonlyTrial.ps1
|   |-- Stop-ReadonlyTrial.ps1
|   |-- Test-ReadonlyTrialNetwork.ps1
|   `-- Switch-ReadonlyTrial.ps1
|-- docs/
|   `-- 只读现场试运行.md
|-- readonly-trial-manifest.json
|-- manifest.sha256
`-- version.json
```

`version.json` 至少包含：

- 版本号
- Git commit
- 构建时间
- 支持的 SourceId
- `readOnly=true`
- `pureWaterPlcEnabled=false`
- 构建工具版本

发布包必须能够在未安装 Node.js 和 .NET SDK 的干净 Windows x64 环境启动。首版可采用 `win-x64 --self-contained true`。

构建工具链固定为当前已验证候选版本：

- `.node-version`：Node.js `26.1.0`。
- npm：`11.13.0`，由构建环境显式核对。
- `global.json`：.NET SDK `10.0.302`，目标框架仍为 `net8.0`。
- npm 必须使用受跟踪的 `package-lock.json` 和 `npm ci`。
- NuGet 启用 `packages.lock.json` 和 locked restore。

若 CI/正式构建机不能提供上述版本，必须通过独立 SPEC 修订并重新跑全部 Gate，不能在发布时临时漂移版本。

## 19. 安装、版本切换和回滚

版本目录：

```text
C:\ProgramData\WastewaterScada\releases\readonly-trial-v0.1.0
C:\ProgramData\WastewaterScada\releases\readonly-trial-v0.0.9
C:\ProgramData\WastewaterScada\current
```

要求：

- 新版本解压到新目录，不覆盖旧目录。
- `current` 固定为同卷 NTFS directory junction，指向当前 release 目录。
- 配置和日志位于 releases 之外。
- 切换时先创建并验证 `current.next` junction；停止服务后将 junction 名称在同卷内切换，再启动服务。失败时恢复旧 junction。
- 切换脚本支持 `-Version`、`-Rollback` 和 `-WhatIf`，并验证目标 manifest/SHA-256。
- 回滚不修改现场配置。
- 完成一次真实升级和一次回滚演练。
- 目标：回滚后 60 秒内恢复本机页面和 Hub 服务。

Windows Service 固定规格：

- 服务名：`WastewaterScadaReadonly`。
- 应用调用 `UseWindowsService()`。
- ImagePath：`C:\ProgramData\WastewaterScada\current\app\ScadaHub.exe`。
- 账户：Windows 虚拟服务账户 `NT SERVICE\WastewaterScadaReadonly`，不保存账户密码。
- ACL：app/config 只读执行，logs 目录可写，releases 和 config 不可写。
- 启动：Automatic (Delayed Start)。
- 恢复：首次失败 5 秒重启、第二次失败 15 秒重启，重复失败停止并告警，24 小时重置计数。

`Install-ReadonlyTrial.ps1` 负责服务创建、账户/ACL、目录、ImagePath、恢复策略和首次全部 IO 禁用启动；`Uninstall-ReadonlyTrial.ps1` 只删除服务登记，默认保留配置、日志和 releases。两者均支持 `-WhatIf` 并在干净 Windows 演练。

## 20. 构建与发布流水线

建议新增 `scripts/release/Build-ReadonlyTrial.ps1`，顺序固定为：

1. 检查审定分支、commit 和工作树。
2. 验证 `.node-version`、`global.json`、npm/NuGet lock 和构建工具版本。
3. 明确排除 `.zcode/`、local 配置、日志和 staging。
4. 验证 HslCommunication 的商业使用/再分发授权证据已归档。
5. `npm ci`。
6. `npm run check:scene`。
7. `npm run test:store`。
8. `npm run build`。
9. `npm run lint`。
10. `dotnet test` Debug/Release（locked restore）。
11. 隔离后的发布程序集 Hub runtime smoke。
12. `dotnet publish -c Release -r win-x64 --self-contained true`。
13. 复制 `dist` 到发布 `wwwroot`。
14. 分别执行：非空/高熵 secret 扫描、全 Git history 已知凭据扫描、可执行写路径扫描、readonly UI 扫描；按第 11.4 节排除安全文档和空 example 占位符。
15. 生成 `version.json` 和 `manifest.sha256`。
16. 生成独立、锁定版本且带 SHA-256 的便携 QA 工具包。
17. 在干净目录解包并执行安装、启动、停止、版本切换和卸载冒烟。

任何一步失败都不得生成“可部署”标记。

WP5 只实现发布机制和脚本，不产生最终签核包。WP6 所有 3D 代码完成后，必须重新执行本节全流程生成唯一最终包；Gate B、Gate C、8 小时 soak 和 WP8 现场试运行必须使用这一份相同 SHA-256 的不可变包。

## 21. 实施工作包

每个工作包单独提交、单独测试，不得把网络配置、数据模型和 3D 大改混入同一提交。

### WP0：安全冻结与凭据治理

> **状态（2026-08-20）：软件侧完成。** 跟踪文档全部脱敏、`check:secrets` 扫描 0 违规（215 文件）、`SCADA_DISABLE_ALL_DEVICE_IO` 硬门禁 + Testing 自动抑制 + 设备级 `Enabled`（fail-closed）落地并有测试、csproj/gitignore 构建排除完成、runtime smoke 强制硬门禁并断言 0 出网。**凭据轮换与 Git 历史清理需现场/用户执行**，清单见 `凭据治理与历史清理待办.md`。

主要内容：

- 轮换已泄露的无线和管理凭据。
- 脱敏当前文档并规划 Git 历史清理。
- 外置配置并收紧 ACL。
- 排除 output/publish/test 配置副本。
- 新增 `SCADA_DISABLE_ALL_DEVICE_IO`。
- `.gitignore` 排除 `.zcode/`、release staging、现场配置和本地日志。

完成门槛：源码、Git 当前树和发布包敏感扫描为 0；测试可证明硬禁用不能被 local JSON 覆盖。

### WP1：MONITOR ONLY UI

> **状态（2026-08-20）：完成（commit 788b4b3）。** 全部控制开关/按钮替换为只读状态行；执行性文案清除；顶栏固定只读标识；DO/Y 全部改为「逻辑输出」语义并标注「物理运行未验证」；DAF 气泡/波纹/刮沫动画与 DO 解耦、纯水泵风扇/震动/运行灯与 Y 解耦；pH 7.20 固定回退移除；`window.__scadaStore` 暴露移除；新增守卫 `check-readonly-trial-ui.mjs`。`check:scene` 39/39、build、lint 通过。demo 源与 store action 未动（demo 隔离与 readonly-trial 构建变体属 WP2）。

主要文件：

- `src/components/ui/Overlay.tsx`
- `src/components/ui/DataDashboard.tsx`
- `src/components/ui/dashboard-parts.tsx`
- `src/components/scene/equipment/DAFTank3D.tsx`
- `src/components/ui/PureWaterDashboard.tsx`
- `src/store/pureWaterPlc.ts`
- `src/components/scene/**` 中消费 PLC Y/M100 DO 的动画和运行灯
- `src/main.tsx`

主要内容：

- 删除控制回调和执行性文案。
- 控制行替换为只读状态行。
- pH 缺值显示 `--`。
- `Y/DO` 改为逻辑输出语义。
- commanded-only 状态不驱动物理运行 3D 动画或 verifiedRunning。
- readonly-trial 不导出现场 mutation action，不暴露 `window.__scadaStore`。

完成门槛：现场 UI 中没有可操作的设备控制入口，点击任何状态行都不改变设备状态。

### WP2：Tag 来源、质量和 demo 隔离

> **状态（2026-08-20）：完成（核心数据面）。** 新增 `tagQuality.ts`（TagState 类型 + 生命周期 + ownership 固定映射 + epoch/eventSeq 防回退）；store 增加 `tagStates` 唯一可变遥测事实源，Equipment 现场字段改为 good 值派生 ViewModel；SourceId 出现即取得 ownership（启动即断线/断线刷新不回退 demo）；demo 默认关闭；排放合规合成值与正弦假趋势移除（现场 -- /无法判定/历史趋势未接入，demo 显式标注）；新增数据质量条（来源/质量/数据龄/保持值）。新建 Vitest 套件 `npm run test:store` 20 项覆盖 SPEC 14.2 可测条目；`check:scene` 40/40（新增 source-quality 守卫）。**readonly-trial 构建变体（彻底剔除 demo scheduler/独立 /demo 路由）与纯水侧 TagState 迁移列为 WP2 遗留，随 WP4/WP5 构建流水线一并落地。**

主要文件：

- `src/store/tagQuality.ts`（新增）
- `src/store/m100Realtime.ts`
- `src/store/useScadaStore.ts`
- `src/services/scadaRealtimeClient.ts`
- `src/components/ui/DataDashboard.tsx`
- `src/components/ui/Overlay.tsx`

主要内容：

- 实现 TagState。
- 将 TagState 设为唯一可变遥测事实源，Equipment 改为静态元数据 + 派生 ViewModel。
- 固定 SourceId -> Tag ownership。
- 实现序号防回退。
- 移除合成合规值和现场假趋势。
- UI 显示来源、质量、数据龄和保持值。

完成门槛：启动即断线、无效 AI、断线刷新和 demo 关闭场景全部通过自动测试。

### WP3：报警状态机

> **状态（2026-08-20）：完成。** 新增 `alarmMachine.ts`（SPEC 10.1 转换表纯函数：同 alarmKey 单活动报警、升级重置确认、peakSeverity 保持、RTN 保留记录）；equipment 报警补齐 warning→critical 升级/降级路径（全部 6 个 detectAlarms 调用点）；通信报警引擎落地 source-stale/source-offline/tag-invalid/hub-offline（两帧恢复 RTN、offline 抑制 stale、未配置源与纯 demo 不评估 hub）；全局 critical 横幅/铃铛计数改为不按系统过滤并纳入通信报警；报警面板新增通信/质量段（含升级历史「曾严重」标注与逐条确认）。Vitest 34/34（新增 14 项覆盖转换表全行与两帧恢复）；`check:scene` 40/40。hub.heartbeat（5s 周期）依赖 WP4 信封升级，首版以 WS onopen/onclose + 连续成功帧作为 hub 恢复证据。

主要文件：

- 修复 warning/critical 升降级和 RTN。
- 增加 M100 stale/offline/invalid 报警。
- 全局 critical 不按页面过滤。
- 明确浏览器报警的非审计边界。

完成门槛：状态转换表全部有自动测试，系统失联时不得显示“运行正常”。

### WP4：Hub 隔离、身份校验和发布解耦

> **状态（2026-08-20）：完成。** 信封升级 contractVersion=2：sourceEpoch（进程 UUID）、信封 seq=eventSeq（snapshot/status 全事件递增）、payload.dataSequence（仅成功采集）、逐 Tag `tags` 结构（value/lastGoodValue/quality/unit/rawKey/rawValue/rawUnit/sampledAt）、configuredEnabled/ioSuppressed、断线快照 hold；hub.heartbeat 每 5s 广播（版本/commit/uptime，独立 eventSeq）；allowlist fail-closed（仅两台权威设备、Role/IP 精确匹配、禁第三台、纯水启用即拒启动）；Publisher 采集/分发解耦（序列化一次+入队即返、每客户端有界队列 64 条/1MiB、可合并消息保最新、不可合并溢出 1013、发送超时 5s、客户端上限 8、registry 锁内原子回放）；HTTP 加固（无代理/无重定向/64KiB 响应上限/Content-Type allowlist）。前端接 heartbeat：hub-stale(>15s)/hub-offline(>30s) 龄分档 + 两连续 heartbeat RTN（WP3 遗留补齐）。校验：dotnet 69/69（新增 allowlist 错配/纯水拒绝/v2 断言）、hub:runtime、check:scene 40/40、test:store 35/35、build、lint 全绿。**遗留：独立 /api/sources/status 契约端点与 /api/health 分层（13 节）归 WP5 发布打包时一并落；慢客户端阻塞测试以代码结构（入队即返）+ 现有集成测试覆盖，专项慢客户端集成测试随 WP5 补。**

主要文件：

- `services/ScadaHub/Program.cs`
- `services/ScadaHub/ScadaHub.csproj`
- `services/ScadaHub/Configuration/M100Options.cs`
- `services/ScadaHub/State/M100StateCache.cs`
- `services/ScadaHub/Realtime/ScadaWebSocketPublisher.cs`
- `services/ScadaHub/Adapters/M100/*`
- `scripts/check-scada-hub-runtime.ps1`

主要内容：

- 配置优先级和 Testing 隔离。
- SourceId/Role/IP 身份校验。
- 初始 Enabled、断线快照和序号规则。
- 采集与 WS 分发解耦。
- HTTP 响应和停机边界加固。
- sourceEpoch/eventSeq/dataSequence、heartbeat 和原子初始回放。

完成门槛：60 项现有测试继续通过，新增慢客户端、配置隔离、身份错配和坏响应测试通过。

### WP5：单机发布机制、服务化和回滚

> **状态（2026-08-20）：机制完成并冒烟通过（未产最终签核包，符合本包定义）。** Hub 同源提供 `app/wwwroot` 静态前端（SPA fallback）并补齐 SPEC 13 分层端点（`/api/health/live|ready`、`/api/sources/status`，含 WP4 遗留）；`UseWindowsService()` 服务化（服务名 WastewaterScadaReadonly，虚拟服务账户 + 恢复策略 5s/15s/停止）；NuGet locked restore（packages.lock.json 入库）。脚本齐备：Install/Uninstall（-WhatIf、ACL、示例配置无凭据）、Start/Stop、Switch（junction current.next 先建后切、-Version/-Rollback/-WhatIf、切换前 manifest SHA-256 全量校验、失败恢复旧 junction）；`Build-ReadonlyTrial.ps1` 流水线全绿跑通（工具核对→npm ci→check:scene→test:store→build→lint→check:secrets→dotnet test→publish self-contained win-x64→dist→wwwroot→local 泄漏检查→version.json→manifest.sha256 349 文件，任一步失败即中止——过程中真实拦截了 lint 违规与扫描器自引用）。冒烟：发布包进程起停（health/live|ready、sources/status `ioSuppressed:true`、同源 index.html、POST 405）；junction 切换/回滚/篡改拒绝全过。**遗留（WP7/现场）**：发布包 commit 显示 `unknown`（SourceRevisionId 未嵌入，WP7 对齐 version.json）；服务真实安装/恢复策略演练需管理员现场执行；QA 便携包与全 history 凭据扫描归 WP7/Gate。

主要文件：

- Hub 同源提供 `wwwroot`。
- 增加 `Microsoft.Extensions.Hosting.WindowsServices` 并启用 `UseWindowsService()`。
- 构建 Release/self-contained 包。
- Windows Service、外部配置、滚动日志。
- 版本目录、SHA-256、切换和回滚脚本。
- 编写只读现场试运行手册。

完成门槛：发布脚本、服务安装、ACL、junction 切换和回滚机制在测试包上通过；本工作包不生成最终签核包。

### WP6：3D 工控机性能收口

> **状态（2026-08-20）：WP6.0 完成；WP6.1-6.4 完成（各自单独提交+quick A/B）。** `scripts/performance/scene-profile.json` 冻结（6 固定相机位/1920x1080@100%/预热 15s 采样 60s×3 轮/SPEC 16.3 硬门槛/目标机信息占位待现场回填）；`measure-scene-performance.mjs` + `npm run perf:scene`（Node 静态 dist + Playwright msedge 硬件加速 + rAF 帧时采样 + renderer.info 统计 + context-loss 监听，`--quick` 开发模式）；App 暴露只读 perf 钩子（`__scadaGl/__scadaCamera/__scadaControls`，无 mutation 能力）。**本机 QUICK 开发基线已采集**（results/ 目录，gitignore）：全局 2.9-6 FPS / 5483 calls / 8948 geos / 112 tex（与 16.1 记载吻合），深度/污泥位 15 FPS / 462-657 calls——WP6.1+ 优化优先级与对照基线就绪。已知瑕疵：全局位 triangles 统计溢出显示 Infinity（WP6.优化时排查）。
>
> **WP6.1-6.4（2026-08-20，commits 6e1b54b/565ad10/77cf972+389db1e/6f5baba）：**
> - 6.1 停帧：Dashboard/后台 frameloop=never，renderer 帧增量 ~600/10s→6/10s（SPEC 允许 <=1，残余帧来自每秒 store 刷新的偶发 invalidate，留待工控机验收轮处理；真后台验证受 CDP 限制）。
> - 6.2 空 EffectComposer 删除：calls 不变（MSAA 不加 call），收益为 763KB postprocessing vendor 移出 bundle + 少一层 pass 带宽。
> - 6.3 perf-mode：DPR<=1.25 + shadows off，经 `?perf-mode=1` 在 store 创建期启用（运行时切换阴影会触发全量重编译致 1fps——已测量并规避）。本机 quick：气浮 15→33.8 FPS、污泥 15→36.5（**本机已达 >=30 门槛**）、P95≈33.4ms，进水/主处理/纯水 5-6→16-19；全局 6.4 FPS/5483 calls 不变（DPR/阴影不减 calls）。测量脚本加 --performance-mode。
> - 6.4 管道细分减半（radial 32→16、密度 10→6，仅细分不改路径算法）：tris -30%（纯水 1.63M→1.09M 等），FPS 噪声内；12/4 激进参数实测触发渲染循环 1fps 崩塌（疑似低 tubularSegments 下 Frenet frames 病态）已排除；视觉回归截图检查通过。
>
> **硬门槛验收（60s×3×6 位 + soak）留待目标工控机（Gate C）。**
>
> **WP6.5 纹理共享（2026-08-20）：完成。** 新增 `shared/sharedCanvasTexture.ts` 模块级缓存；Tank3D 涡流/DAF 气泡/ChemicalTank 涡流/ScrewPress 螺旋/配电柜三处（铭牌按名键控）/**Pipe3D 流动箭头（大头：repeat 移至每管 UV 缩放实现全场景一份）** 共 7 类共享化。**textures 110 → 29**（门槛 <80 超额达成）；dispose 语义验证：5 轮视图往返 29→30（噪声级 1，共享纹理无泄漏）；视觉回归截图检查（箭头密度正常）。**新发现（归 WP6.7）：geometries 视图往返每轮 +43 泄漏（5 轮 +216，SPEC 16.3 往返稳定门槛未达）——组件重挂的手写 geometry 生命周期问题，与 Baker 替换同批处理。**
>
> **WP6.6 分站实例化（2026-08-20）：样板完成。** 场景图剖析（perf 钩子补 `__scadaScene`，按几何×材质×工段统计）定位 Top 重复源：全部为小五金（泵壳螺栓×192、锚板×138、垫板×138、栅条×128、螺柱×120 等，Pump3D 21 实例 + SkidFrame3D 为主要来源）。已实例化：Pump3D 壳体螺栓 12→1/泵、基座螺栓 4→1、风扇栅条 8→1、支架法兰螺栓 6→1；SkidFrame3D 锚板/螺柱/螺母三件套 6×3→3 个 InstancedMesh/skid。**实测：geometries 8948→6876（-23%）、默认视口 calls 15035→14205（-830）；六相机位全局 calls ~5489（噪声内持平——视锥内主体非小五金）**。结论：全局 ≤500 calls 门槛的正解是 WP6.7 静态合批；WP6.6 后续（更多工段组件）收益/风险比低于直接做 Baker，剩余循环暂缓。视觉回归截图通过。测量环境注意：残留 Edge 进程会致 harness 连续崩溃，重跑前清理。

主要内容：

- Dashboard/后台暂停渲染。
- 运行模式禁用巡检员和无效后处理。
- DPR/阴影/环境档位。
- 管道细分、纹理共享、分工段实例化。
- 替换全局 StaticGeometryBaker，避免保留数千隐藏原网格。
- 修正 loader/readiness：仅在 Store、路由和 Suspense 必要资产完成后设置 `data-scada-ready=true`。

拆成 WP6.0（基线）、WP6.1（暂停）、WP6.2（巡检员）、WP6.3（后处理/DPR/光影）、WP6.4（管道）、WP6.5（纹理）、WP6.6（分工段 Instances）、WP6.7（替换 Baker）。每步独立提交、截图、选择/点击和动画回归；无收益或画面回归时单步回滚。

完成门槛：候选生产构建达到第 16.3 节预验收指标，功能和画面对比验收通过；这不是最终 Gate C 证据。

### WP7：最终不可变发布包和目标机 Gate

主要内容：

- 在 WP6 完成后重新执行第 20 节全流程。
- 生成唯一最终 `readonly-trial-v0.1.0` 包、version.json 和 SHA-256。
- 使用同一包完成干净机安装/回滚、Gate B、Gate C 和 8 小时 soak。
- 固化性能 JSON、截图、健康检查、ACL、网络预检和回滚证据。

完成门槛：Gate A-C 全部通过，之后不再修改任何代码或资产。最终包性能失败时退回 WP6，失败包作废；修改后重新执行完整 WP7 并生成新 SHA-256。

### WP8：现场只读试运行

前置条件：WP0-WP7 和 Gate A-C 全部通过，现场安全范围获得单独确认。

网络前置记录必须先完成：

- 工控机目标网卡的 InterfaceIndex、名称、MAC 和物理端口照片。
- 经批准且已查重的本机 IP、掩码、网关（如有）和 DNS（如有）。
- `.31/.8` 的路由、出接口和 interface metric 结果。
- ARP/IP 占用检查及现有网络配置备份。
- 只读 `Test-ReadonlyTrialNetwork.ps1` 预检通过；该脚本不得修改 IP、路由、metric 或防火墙。
- 预检只允许对批准的 `.31/.8` 做连通性/只读 HTTP 检查，不请求 `.7`、纯水网段或其他未批准设备。

执行顺序：

1. 全部 adapter 禁用启动，确认无设备出站连接。
2. 复核 `.31` 的位置、SN/MAC、网桥、IP、凭据和接线。
3. 仅启用 `.31`。
4. 连续至少 30 分钟对照 Hub、手工只读 `ioread.cgi`、现场仪表/有人云显示。
5. 确认 pH、DO1、DO2 的语义和变化一致。
6. 禁用 `.31`，复核 `.8` 身份和接线。
7. 仅启用 `.8`。
8. 连续至少 30 分钟对照 AI1 原始电流、工程液位和现场值。
9. 两台分别通过后才允许同时启用。
10. 经现场许可执行一次通信中断/恢复测试。
11. 确认 UI 及时进入 stale/offline，显示保持值标识并产生报警。
12. 恢复后确认 sourceEpoch、eventSeq、dataSequence、时间戳、live 和 RTN 正常。
13. 全程核对没有 `iowrite.cgi`、Modbus 写、PLC 写或有人云配置变化。

完成结论只能写为：

```text
M100 .31/.8 只读现场试运行通过
```

不得扩展为“全厂 M100、有人云、纯水 PLC、设备控制或正式生产验收通过”。

## 22. 软件验收矩阵

| 场景 | 预期结果 |
| --- | --- |
| 生产首次启动，无现场帧 | demo 关闭；所有正式 Tag 为 `--/unknown`；无达标结论 |
| readonly-trial 尝试进入演示 | 无 demo 路由、按钮、scheduler 或 Store，无法进入 |
| 开发构建独立 `/demo` | 演示值仅存在独立 Store，持续显示 DEMO，不进入现场报警 |
| M100 已启用但一直 401/超时 | 对应 Tag 归属现场源，显示 offline/unknown，不显示 demo |
| Hub 未重启，仅浏览器在断线期间刷新 | 从 Hub 内存快照恢复 ownership 和明确的保持值质量，不回退 demo |
| Hub 重启且设备仍断线 | 识别新 sourceEpoch，恢复 ownership + offline/unknown；无持久缓存时不承诺保持值 |
| 浏览器不刷新、Hub 重启 | 接受新 sourceEpoch，eventSeq 重新建立，不锁死新帧 |
| `ph=null` + warning | 显示 `--/信号异常`，末值不得显示为 live |
| DI/DO `false` | 作为有效布尔值，不解释为未知 |
| 合法工程零值 | 作为有效现场值显示 |
| 4-20mA AI `0uA` | 字段存在但点质量 invalid，不换算成合法工程零值 |
| warning 升级 critical | 当前报警升级并出现全局 critical 横幅 |
| M100 断线 | 产生通信报警，系统不得显示运行正常 |
| M100 恢复 | 第一结构有效 transport 成功帧恢复 live；第二个连续成功帧关闭通信报警并产生一次 RTN |
| 慢 WS 客户端 | 采集序号继续增长，其他客户端不受阻塞 |
| 旧帧迟到 | 被 sourceEpoch + eventSeq 规则拒绝 |
| Testing + 现场 local 配置存在 | 真实设备调用次数仍为 0 |
| 发布包扫描 | 无 local 配置、非空/高熵凭据、可执行写入口或现场控制 UI；空 example 和安全文档不误报 |
| Dashboard/后台模式 | 允许 2 秒收敛，随后 10 秒 frame 增量 `<=1`，恢复后 1 秒内重绘 |
| 版本回滚 | 60 秒内恢复上一版本页面和 Hub |

## 23. 发布门禁

### Gate A：代码可信

- [ ] `npm run check:scene` 全部通过。
- [ ] `npm run build` 通过。
- [ ] `npm run lint` 通过。
- [ ] `npm run test:store` 数据质量/报警行为测试通过。
- [ ] `.NET` Debug/Release 测试通过。
- [ ] 发布程序集硬禁用 runtime smoke 和测试 Host Fake 集成测试分别通过。
- [ ] `.node-version`、`global.json`、npm/NuGet lock 生效。
- [ ] 生产依赖和 NuGet 漏洞检查无阻断项。
- [ ] dev toolchain high 漏洞已升级或完成风险批准。
- [ ] HslCommunication 商业使用/再分发授权证据已归档。
- [ ] 全 Git history 的已知凭据扫描和处置复核通过。
- [ ] `.31/.8` 脱敏响应 fixture、Content-Type 和 Role 最小数组契约已冻结。

### Gate B：包可信

- [ ] 包内无真实配置和凭据。
- [ ] 包内无设备写入路径。
- [ ] 包内无现场控制 UI。
- [ ] `version.json` 与 Git commit 一致。
- [ ] `manifest.sha256` 验证通过。
- [ ] readonly-trial manifest 仅允许 `.31/.8`，PureWater 和写能力为 false。
- [ ] 干净 Windows x64 启停通过。
- [ ] Install/Uninstall、虚拟服务账户和 ACL 测试通过。
- [ ] Windows Service 自动恢复测试通过。
- [ ] 升级和回滚演练通过。

### Gate C：目标机可信

- [ ] 目标工控机本机性能达到第 16.3 节。
- [ ] 8 小时 soak 无持续资源增长。
- [ ] Hub、UI、日志、配置 ACL 核对通过。
- [ ] 使用与 Gate B 完全相同 SHA-256 的包。
- [ ] 已批准网卡/IP/掩码/路由/metric、地址查重和只读网络预检归档。
- [ ] 防火墙未开放不需要的 5173/18080 LAN 端口。

### Gate D：现场只读可信

- [ ] `.31` 身份、接线和只读比对完成。
- [ ] `.8` 身份、接线和只读比对完成。
- [ ] `.31/.8` 实际 CGI Content-Type 和响应上限证据已归档。
- [ ] 断线/恢复验证完成。
- [ ] 全程无设备写、参数变更和有人云配置变化。
- [ ] 现场记录包含版本、commit、SourceId、开始/结束时间和签字。

未通过前一 Gate，不得进入后一 Gate。

## 24. 回滚触发条件

出现以下任一情况立即停止试运行并回滚：

- UI 显示值与手工只读值或现场仪表不一致且原因未确定。
- 断线后仍显示 live 或“运行正常”。
- demo 值出现在现场 SourceId 已启用的 Tag 上。
- 出现任何设备写请求、控制命令或设备状态因本软件改变的迹象。
- Hub 采集被慢客户端阻塞或序号停止增长。
- 凭据出现在日志、发布目录或浏览器网络响应中。
- 持续内存增长、WebGL context loss、页面冻结或服务反复崩溃。
- 无法在 60 秒内切回上一稳定版本。

回滚后保留日志和故障包，不修改现场设备配置，不使用未批准脚本“尝试修复网络”。

## 25. 待确认事项

以下事项不阻止先完成默认禁用的软件整改，但阻止扩大现场范围：

- `.31/.8` 最终 SN/MAC 与当前 IP 的现场复核记录。
- `.32` 是“现行在线待接信号”还是“取消纳入”的权威结论。
- `.7` 当前设备身份与历史迁移记录的冲突清理。
- `.33` 的设备身份、IP 和药剂房网络路径。
- `.30/.32` 传感器接线完成时间和工程量程。
- 排放 COD、氨氮、总磷的真实数据来源、量程、单位和批准阈值。
- 每个工艺 pH 点的工程范围和报警阈值来源。
- 纯水 PLC 最终 IP、GX Works2 参数和现场只读授权。
- 是否以及何时需要 LAN 多客户端、用户认证和正式报警持久化。

## 26. 完成定义

`readonly-trial-v0.1.0` 只有同时满足以下条件才算完成：

- WP0-WP8 全部完成并保留证据。
- Gate A-D 全部签核。
- 首版仅启用 `m100-daf-01` 和 `m100-underground-01`。
- 纯水 PLC 和其他 M100 保持禁用。
- 数据来源、质量、数据龄和保持值在 UI 中清晰可见。
- 无假趋势、假合规、固定正常值回退和假控制。
- 报警升级、通信报警、RTN 和跨系统 critical 行为符合本文。
- 测试不会接触现场设备。
- 发布包不包含凭据并可在 60 秒内回滚。
- 目标工控机通过性能和 8 小时稳定性验收。
- `.31/.8` 现场只读对照及断线恢复记录完成。

完成该版本不构成任何设备控制授权。任何写入能力必须另立 SPEC、威胁模型、权限、联锁、回读、审计、超时、失败安全和现场验收，不得在本计划中顺带实现。
