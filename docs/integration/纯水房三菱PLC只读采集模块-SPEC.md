# 纯水房三菱 PLC 只读采集模块规格

> 文档状态：实现基线（Implementation Baseline）  
> 版本：`0.1.2`  
> 日期：`2026-08-12`  
> 适用仓库：`E:\Desktop\SCADA`  
> 目标模块：纯水房 `FX3GA-60MR` + `FX3U-ENET-ADP` 只读上位机采集

## 1. 文档目的

本文档是纯水房三菱 PLC 真实数据接入模块的编码依据。后续实现、测试、现场联调和验收均应以本文档为基线，不允许在代码中自行改变协议、地址进制、读写边界或数据新鲜度规则。

本规格解决以下问题：

- 明确 PLC、转换模块和以太网模块的硬件关系。
- 固定本项目使用的三菱通信协议及参数。
- 说明 PLC 网络 IP 和 MC 协议端口的配置方法。
- 规定旧 `MitsubishiMonitor` 项目中哪些代码可以复用、哪些不能复用。
- 规定纯水点位的读取范围、数据类型、缩放和前端映射。
- 定义本地 SCADA Hub、REST/WebSocket 和前端 Zustand store 的边界。
- 从代码结构上保证第一阶段只能监视，不能向 PLC 写入任何数据。
- 给出离线、陈旧、重连、报警和首次现场只读验收规则。

## 2. 范围与非目标

### 2.1 第一阶段范围

第一阶段只实现：

- 通过 TCP 连接 `FX3U-ENET-ADP`。
- 使用 MC 协议 A 兼容 1E 帧、二进制数据码读取 PLC。
- 读取纯水房运行状态、液位、报警、自动模式和泵选择状态。
- 由本地 SCADA Hub 统一缓存、归一化并推送给 Web 前端。
- 显示实时、陈旧、断线、恢复和末值保持状态。
- 提供模拟传输实现，在没有 PLC 时验证轮询、超时和重连。

### 2.2 第一阶段明确不做

以下内容禁止进入第一阶段代码：

- 写入 `X/Y/M/D/C` 任意设备。
- 报警复位、静音、手动启停、自动/手动切换。
- 远程 RUN、远程 STOP、PLC 时钟设置或程序下载。
- 修改 PLC IP、子网掩码、端口或 EEPROM 参数。
- 浏览器直接连接 PLC、网桥或 M100。
- 根据演示数据伪造 PLC 未提供的电流、频率、流量、功率或液位。
- 将 `Y` 输出状态描述成已经确认的机械动作。`Y` 只能说明 PLC 输出逻辑状态，不能单独证明泵已物理转动。

任何控制功能都必须另立规格、重新进行安全评审和现场授权，不能通过增加一个配置开关绕过本限制。

## 3. 已确认的技术基线

| 项目 | 固定结论 |
| --- | --- |
| PLC | 三菱 `FX3GA-60MR`；现场需再拍铭牌确认是否为完整型号 `FX3GA-60MR-CM` |
| 转换模块 | `FX3G-CNV-ADP` |
| 以太网模块 | `FX3U-ENET-ADP` |
| 物理顺序 | PLC -> `FX3G-CNV-ADP` -> `FX3U-ENET-ADP`；ENET-ADP 位于适配器链最左端/末级 |
| 通信协议 | Mitsubishi MC Protocol，A-compatible 1E frame |
| 传输层 | TCP/IP |
| 数据码 | Binary Code |
| 监听端口 | `5000`，必须与 GX Works2 的 Host Station Port 一致 |
| 地址规则 | `X/Y` 为八进制；`M/D/C` 为十进制 |
| 后端技术栈 | `.NET 8` ASP.NET Core 本地服务 |
| PLC 库 | `HslCommunication 12.3.0`，使用 `MelsecA1ENet` |
| 前端 | React/TypeScript，只连接本地 SCADA Hub |
| 首期权限 | 只读，无控制接口 |

### 3.1 协议排除项

本模块不得使用以下实现替代：

- Modbus TCP。
- MC Protocol 3E/QnA 兼容帧。
- `MelsecMcNet`。
- `MelsecA1EAsciiNet`。
- UDP。

正确的 HslCommunication 客户端类型只有：

```csharp
new MelsecA1ENet(ipAddress, port)
```

## 4. 权威来源与冲突处理

点位和语义按以下优先级处理：

1. 现场实际 PLC 程序及其 GX Works2 参数。
2. `E:\Desktop\污水站PLC.pdf` 中的梯形图。
3. 用户提供的 HMI 截图。
4. 当前仓库 [`../../src/store/pureWaterPlc.ts`](../../src/store/pureWaterPlc.ts)。
5. 旧 `MitsubishiMonitor` 项目仅作为通信实现参考，不作为纯水点表来源。

如果来源之间存在冲突：

- 不允许自行猜测。
- 对应点位保持 `null/unknown`。
- 在本文“待确认事项”登记后再修改规格。
- 规格修改完成后才能修改正式代码。

## 5. 总体架构

```text
FX3GA-60MR
  -> FX3G-CNV-ADP
  -> FX3U-ENET-ADP (TCP 5000, MC A-compatible 1E, Binary)
  -> 现场无线网桥（二层透传）
  -> 中控电脑本地 SCADA Hub (.NET 8)
       -> Mitsubishi 只读传输层
       -> 纯水点位读取与归一化
       -> 状态缓存 / 数据质量 / 报警边沿
       -> REST + WebSocket
  -> React 前端适配器
  -> useScadaStore.ingestPureWaterPlcTelemetry()
  -> 纯水集控中枢 / 3D 场景 / 报警
```

分层规则：

- 无线网桥只做二层透传，不承担 PLC 协议解析。
- SCADA Hub 是浏览器访问现场设备的唯一边界。
- 前端不能持有 PLC IP，也不能引用 HslCommunication。
- PLC 传输层不能依赖 React、Zustand、WPF、数据库或具体 UI。
- 点位映射层不能调用任何写入函数。

## 6. 网络规划

### 6.1 网段必须分开

| 网段 | 用途 | 本模块规则 |
| --- | --- | --- |
| `192.168.2.x` | ST508S 等网桥管理、本地服务访问 | 网桥管理 IP，不是 PLC 数据 IP |
| `192.168.0.x` | M100 数据网段 | 与本 PLC 模块无关，不能复用 M100 IP |
| `192.168.1.x` | 旧项目验证过的 PLC 数据网段 | 建议继续采用，但现场分配前必须查重 |

推荐拓扑示例，不是最终地址授权：

```text
中控电脑 PLC 数据副 IP：192.168.1.100/24
纯水 PLC：               192.168.1.<待分配>/24
纯水网桥管理 IP：         192.168.2.<现场已分配>/24
MC Protocol TCP 端口：   5000
```

禁止事项：

- 不得把 PLC 数据 IP 配成网桥管理 IP。
- 不得把 PLC 数据 IP 配成某台 M100 的 `192.168.0.x` 地址。
- 不得在未进行 IP 查重时直接使用本文示例地址。
- 不得把 PLC/ENET-ADP 直接暴露到互联网。

### 6.2 IP 分配前检查

配置实际 IP 前必须完成：

1. 查阅当前 IP 台账。
2. 断开待用地址的目标设备后执行 `ping` 和 ARP 检查。
3. 确认中控电脑能增加同网段副 IP。
4. 确认网桥为二层透传，且不会进行 NAT 或端口转换。
5. 将最终 PLC IP、网桥管理 IP、端口和日期回填本文档。

## 7. GX Works2 网络参数规格

### 7.1 参数页面

在 GX Works2 中进入：

```text
PLC Parameter / FX Parameter
  -> Ethernet Port
```

只有本套 `FX3G-CNV-ADP + FX3U-ENET-ADP` 时，ENET-ADP 通常占用 `CH1`。如果 PLC 上还有其他通信扩展板或通信特殊适配器，必须根据实际通道排列重新确认，不能固定假设为 CH1。

### 7.2 Ethernet Port 设置

| 字段 | 要求 |
| --- | --- |
| Channel | 当前硬件预期 `CH1`；写入前再次核对 |
| Input Format | `DEC` |
| IP Address | 唯一、已查重的 PLC 数据 IP |
| Subnet Mask Pattern | 同网段推荐 `255.255.255.0` |
| Default Router IP Address | 不跨网段时不配置；需要路由时按现场网络规划填写 |
| Communication Data Code | `Binary Code` |
| Direct connection to MELSOFT | 接入局域网时禁用简单直连，避免无关发现/连接 |

### 7.3 Open Setting

至少配置一个 MC Protocol 连接：

| 字段 | 值 |
| --- | --- |
| Protocol | `TCP` |
| Open System | `MC Protocol` |
| Host Station Port No. | `5000` |
| Destination IP Address | TCP 服务端模式不填 |
| Destination Port No. | TCP 服务端模式不填 |

模块最多允许 4 个并发连接槽。若需要 GX Works2 通过以太网维护，可保留一个 `MELSOFT Connection` 槽；MC Protocol、MELSOFT 和数据监视总数不得超过 4。

### 7.4 参数写入与生效

1. 先保存和备份原 PLC 工程及当前参数。
2. 通过 USB/串行编程线连接 PLC，避免依赖正在修改的以太网链路。
3. 将 PLC 参数和 ENET-ADP 特殊参数写入 PLC。
4. 按现场停机和电气安全流程完整断电、再上电。
5. 检查 ENET-ADP 的 POWER、ERR、OPEN、SD/RD 指示状态。
6. 从中控电脑 `ping` PLC IP。
7. 只读测试 TCP 5000 和一个无害点位。

### 7.5 “IP 改了却不生效”排查

`FX3U-ENET-ADP` 支持通过 PLC 内部 EEPROM 覆盖 GX Works2 参数：

- `D8492-D8497`：IP、掩码、默认路由存储区。
- `M8492`：执行写入 EEPROM。
- `M8498`：IP 地址变更功能启用标志。

如果 `M8498=ON`，EEPROM 中的地址可能覆盖 GX Works2 Ethernet Port 设置。

处理原则：

- 第一阶段只允许读取并诊断这些特殊设备。
- 禁止本模块写入 `D8492-D8497` 或切换 `M8492/M8498`。
- 如确需清除覆盖，必须在 GX Works2 中另行制定参数变更和回退步骤。

## 8. 后端实现规格

### 8.1 工程结构

后续代码建议建立以下目录：

```text
services/
  ScadaHub/
    ScadaHub.csproj
    Program.cs
    appsettings.json
    Configuration/
      PureWaterPlcOptions.cs
    Contracts/
      ScadaEnvelope.cs
      PureWaterPlcTelemetry.cs
    Adapters/Mitsubishi/
      IMitsubishiPlcTransport.cs
      IMitsubishiPlcTransportFactory.cs
      HslMitsubishiPlcTransport.cs
      PureWaterPlcPointMap.cs
      PureWaterPlcReader.cs
      PureWaterPlcPollingService.cs
    State/
      PureWaterPlcStateCache.cs
    Api/
      PureWaterPlcEndpoints.cs
    Realtime/
      ScadaWebSocketPublisher.cs

tests/
  ScadaHub.Tests/
    Mitsubishi/
      FakeMitsubishiPlcTransport.cs
      PureWaterPlcPointMapTests.cs
      PureWaterPlcReaderTests.cs
      PureWaterPlcPollingServiceTests.cs
    Api/
      PureWaterPlcEndpointTests.cs
```

前端接入文件：

```text
src/services/scadaRealtimeClient.ts
```

现有 [`../../src/store/pureWaterPlc.ts`](../../src/store/pureWaterPlc.ts) 和 `ingestPureWaterPlcTelemetry()` 作为前端归一化入口，不在场景组件中增加协议代码。

### 8.2 依赖和目标框架

```text
TargetFramework: net8.0
Host: ASP.NET Core
HslCommunication: 12.3.0（固定版本，不自动漂移）
Nullable: enable
ImplicitUsings: enable
```

开发期以控制台方式运行；完成本机验收后再另行决定是否注册为 Windows Service。

### 8.3 配置模型

建议配置如下：

```json
{
  "PureWaterPlc": {
    "Enabled": false,
    "SourceId": "purewater-plc-01",
    "IpAddress": "",
    "Port": 5000,
    "PollIntervalMs": 1000,
    "ConnectTimeoutMs": 3000,
    "ReceiveTimeoutMs": 3000,
    "OperationTimeoutMs": 5000,
    "FailuresBeforeDisconnect": 2,
    "StaleAfterMs": 10000,
    "DisconnectedAfterMs": 30000
  }
}
```

配置规则：

- 仓库默认 `Enabled=false`、`IpAddress=""`，防止开发机误连现场 PLC。
- 端口默认 `5000`。
- IP 必须是合法单播 IPv4，不能是 `0.0.0.0`、广播地址或网桥管理地址。
- `PollIntervalMs` 不得低于 `500 ms`；默认 `1000 ms`。
- 不提供 `WriteEnabled` 配置项。只读是代码能力边界，不是可切换选项。
- 现场 IP 放入本地配置或环境变量，不在示例配置里假装成已确认地址。

### 8.4 只读传输接口

传输接口只能包含：

```csharp
ConnectServer()
ConnectClose()
Abort()
ReadBool(address, length)
ReadUInt16(address, length)
```

根据后续明确的数据类型，可以增加 `ReadInt16` 或 `ReadInt32`，但不得出现：

```text
Write / WriteBool / WriteInt16 / WriteInt32
RemoteRun / RemoteStop
SetPlcType / SetDateTime
```

代码审查和静态检查必须把上述写入名称列为禁用模式。

## 9. 点位规格

### 9.1 地址进制

三菱 FX3G/FX3GA 的 `X`、`Y` 使用八进制：

```text
数组索引 0..7   -> X000..X007
数组索引 8..15  -> X010..X017
数组索引 16..23 -> X020..X027
```

`Y` 同理。禁止生成 `X008/X009/Y008/Y009` 等不存在的标签。

读取实现优先使用连续块：

```csharp
ReadBool("X0", 24)
ReadBool("Y0", 24)
```

然后使用八进制标签函数把索引映射成 `X000-X027`、`Y000-Y027`。

### 9.2 第一阶段必读输入 X

| 地址 | 含义 | 数据类型 | 备注 |
| --- | --- | --- | --- |
| `X000` | 相序保护器 | bool | 梯形图中失电触发 `M404`，因此 ON 代表保护输入正常 |
| `X001` | 备用 | bool | 不参与设备状态 |
| `X002` | RO1 水箱高液位 | bool | RO1 水箱只有开关量，不得伪造连续百分比 |
| `X003` | RO1 水箱低液位 | bool | 同上 |
| `X004` | 原水箱高液位 | bool | 开关量保护点 |
| `X005` | 原水箱低液位 | bool | 开关量保护点 |
| `X006` | 碳柱反洗中 | bool | 工艺状态 |
| `X007` | 原水泵高压 | bool | 压力保护输入 |
| `X010` | RO1 泵低压 | bool | 压力保护输入 |
| `X011` | RO1 泵高压 | bool | 压力保护输入 |
| `X012` | RO2 泵高压 | bool | 压力保护输入 |
| `X013` | 原水泵 A 过载 | bool | 故障输入 |
| `X014` | 原水泵 B 过载 | bool | 故障输入 |
| `X015` | RO1 泵变频器故障 | bool | 故障输入 |
| `X016` | 备用 | bool | 不参与设备状态 |
| `X017` | RO2 泵变频器故障 | bool | 故障输入 |
| `X020` | 备用 | bool | 不参与设备状态 |
| `X021` | 供水泵变频器故障 | bool | 故障输入 |
| `X022` | RO2 水箱高液位 | bool | 开关量保护点 |
| `X023` | RO2 水箱低液位 | bool | 开关量保护点 |
| `X024-X027` | 备用 | bool | 不参与设备状态 |

### 9.3 第一阶段必读输出 Y

| 地址 | 含义 | 前端解释 |
| --- | --- | --- |
| `Y000` | 报警输出 | PLC 报警输出逻辑 |
| `Y001` | 总进水阀 | PLC 阀输出命令 |
| `Y002` | 原水泵 A | PLC 泵输出命令 |
| `Y003` | 原水泵 B | PLC 泵输出命令 |
| `Y004` | RO1 高压泵 A | PLC 泵输出命令 |
| `Y005` | RO1 高压泵 B | PLC 泵输出命令 |
| `Y006` | RO1 泵变频器 | PLC 变频器输出命令 |
| `Y007` | RO2 高压泵 A | PLC 泵输出命令 |
| `Y010` | RO2 高压泵 B | PLC 泵输出命令 |
| `Y011` | RO2 泵变频器 | PLC 变频器输出命令 |
| `Y012` | 供水泵 A | PLC 泵输出命令 |
| `Y013` | 供水泵 B | PLC 泵输出命令 |
| `Y014` | 供水泵变频器 | PLC 变频器输出命令 |
| `Y015` | 阻垢剂加药 | PLC 加药输出命令 |
| `Y016` | 氢氧化钠加药 | PLC 加药输出命令 |
| `Y017` | 一级 RO 进水阀 | PLC 阀输出命令 |
| `Y020` | 一级 RO 冲洗阀 | PLC 阀输出命令 |
| `Y021` | 二级 RO 进水阀 | PLC 阀输出命令 |
| `Y022` | 二级 RO 冲洗阀 | PLC 阀输出命令 |
| `Y023-Y027` | 备用 | 不参与设备状态 |

### 9.4 第一阶段必读报警 M

| 地址 | 报警含义 | 级别 |
| --- | --- | --- |
| `M400` | 原水泵高压 | critical |
| `M401` | RO1 泵低压 | critical |
| `M402` | RO1 泵高压 | critical |
| `M403` | RO2 泵高压 | critical |
| `M404` | 相序故障 | critical |
| `M405` | 原水泵 A 过载 | critical |
| `M406` | 原水泵 B 过载 | critical |
| `M407` | RO1 泵变频器故障 | critical |
| `M408` | RO2 泵变频器故障 | critical |
| `M409` | 供水泵变频器故障 | critical |
| `M410` | 原水箱液位超高 | critical |
| `M411` | 原水箱液位超低 | critical |
| `M412` | 原水箱液位阈值顺序错误 | critical |
| `M413` | RO2 水箱液位超高 | critical |
| `M414` | RO2 水箱液位超低 | critical |
| `M415` | RO2 水箱液位阈值顺序错误 | critical |

`M412/M415` 是阈值参数顺序错误，不是“高低液位同时触发”。

### 9.5 第一阶段必读模式和泵选择 M

| 地址 | 含义 |
| --- | --- |
| `M500` | 一级 RO 自动模式 |
| `M501` | 二级 RO 自动模式 |
| `M502` | 供水自动模式 |
| `M510` | 原水泵 A 选择 |
| `M511` | 原水泵 B 选择 |
| `M512` | RO1 泵 A 选择 |
| `M513` | RO1 泵 B 选择 |
| `M514` | RO2 泵 A 选择 |
| `M515` | RO2 泵 B 选择 |
| `M516` | 供水泵 A 选择 |
| `M517` | 供水泵 B 选择 |

建议使用 `ReadBool("M500", 18)` 连续读取，再只发布已登记地址；`M503-M509` 不得自动赋予业务含义。

### 9.6 第一阶段必读字设备

| 地址 | 含义 | 初始读取类型 | 单位/规则 |
| --- | --- | --- | --- |
| `D51` | 原水箱液位 | UInt16 | `%`，预期 `0-100` |
| `D52` | RO2 水箱液位 | UInt16 | `%`，预期 `0-100` |
| `D90` | 报警汇总字 | UInt16 | 仅诊断，报警权威来源仍为 `M400-M415` |

数据规则：

- Hub 保留实际原始值，不把越界值静默修正成正常值。
- `D51/D52` 超出 `0-100` 时，该点质量为 bad/unknown，前端不能显示成健康液位。
- RO1 水箱没有已确认的连续液位 D 点，只显示 `X002/X003` 高低液位状态。

### 9.7 第二阶段诊断字设备

以下点位已登记，但在核对梯形图数据类型和缩放前，不作为第一阶段上线阻塞项：

| 地址 | 含义 | 暂定类型 | 单位 |
| --- | --- | --- | --- |
| `D1` | 模拟量通道 1 原始值 | UInt16 | raw |
| `D2` | 模拟量通道 2 原始值 | UInt16 | raw |
| `D21` | 原水箱液位缩放值 | UInt16 | 待确认 |
| `D22` | RO2 水箱液位缩放值 | UInt16 | 待确认 |
| `D400-D404` | 原水箱 HH/H/MH/L/LL 阈值 | UInt16 | `%` |
| `D405-D409` | RO2 水箱 HH/H/MH/L/LL 阈值 | UInt16 | `%` |
| `D529` | RO1 开机冲洗设定 | UInt16 | s |
| `D533` | RO2 开机冲洗设定 | UInt16 | s |
| `D537` | RO1 间隔冲洗设定 | UInt16 | s |
| `D538` | RO1 冲洗间隔设定 | UInt16 | min |
| `C10` | RO1 冲洗间隔实际 | 计数器当前值 | min，需验证 1E 读法 |
| `D563` | RO1 间隔冲洗实际 | UInt16 | s |
| `D569` | RO1 开机冲洗实际 | UInt16 | s |
| `D573` | RO2 开机冲洗实际 | UInt16 | s |

### 9.8 已知控制点，仅文档登记

以下地址可读取用于诊断，但第一阶段禁止写入，也不提供控制按钮：

```text
M390-M393  报警复位
M399       报警静音
M520-M527  手动泵操作
M528-M534  手动阀门/加药操作
M540-M542  手动变频器操作
```

这些地址不能出现在任何 POST API、WebSocket 命令或前端可点击控件中。

## 10. 轮询与会话规则

### 10.1 第一阶段主帧

每个主轮询周期依次执行：

```text
ReadBool X0, 24
ReadBool Y0, 24
ReadBool M400, 16
ReadBool M500, 18
ReadUInt16 D51, 2
ReadUInt16 D90, 1
```

默认周期 `1000 ms`，同一个 TCP 连接内所有请求严格串行。

主帧原子性：

- 所有必读请求成功，才产生一帧新的实时快照。
- 只有完整成功帧才能递增 `sequence` 和更新 `receivedAt`。
- 任意必读请求失败，本周期丢弃，不允许把半帧标记为实时。
- 不允许用上一周期的某一半和本周期的另一半拼成新实时帧。

### 10.2 诊断点轮询

第二阶段诊断点可按 `5000 ms` 低频读取，但必须满足：

- 与主帧共用同一代连接和同一个 I/O 锁。
- 诊断失败不能阻塞下一次主帧。
- 诊断点失败时返回 `null` 或独立质量状态，不能假装与主帧同样新鲜。

### 10.3 超时和连接代

复用旧项目已经验证的连接代设计：

- 每次新连接拥有独立 transport、`SemaphoreSlim` 和 generation id。
- HslCommunication 同步 I/O 外层必须有应用级硬超时。
- 硬超时后立即废弃整代连接，关闭通信管道并新建 transport。
- 超时后的迟到结果不得写入缓存、递增序号或恢复在线状态。
- Stop/Start、重连和取消必须使用独立 acquisition token，旧任务不得清理新任务状态。

### 10.4 失败与重连

- 单次失败：记录降级，不发布半帧。
- 连续 `2` 个主帧失败：发布 `connected=false`，保留最后成功时间和末值。
- 重连退避建议：`1s -> 2s -> 5s -> 10s`，上限 `15s`。
- 首个完整恢复帧成功后才恢复 `connected=true`。
- 无论失败还是恢复，都不得触发 PLC 写入或远程状态改变。

## 11. 数据质量和报警语义

### 11.1 纯水专用新鲜度

本模块采用当前前端已经实现的阈值：

| 条件 | 状态 | UI 规则 |
| --- | --- | --- |
| 未配置或禁用 | `offline` | 全部真实点显示未知 |
| 本地演示 | `demo` | 明确标记“本地演示，不代表现场” |
| 完整成功帧年龄 <= 10s | `live` | 可显示实时状态 |
| 完整成功帧年龄 > 10s | `stale` | 保持末值，但明确标记陈旧 |
| `connected=false` 或帧年龄 > 30s | `disconnected` | 保持末值但不能作为运行确认 |

纯水模块的 `10s/30s` 是本模块专用规则，优先于旧统一协议文档中的通用 `5s/15s` 示例。

### 11.2 未知值

- `null` 表示没有可信数据。
- `false` 和 `0` 是有效现场数据，不等于未知。
- 未连接时禁止把所有点自动置 `false/0`，否则会把断线伪装成正常停机。

### 11.3 报警边沿

- `false -> true`：产生报警。
- `true -> false`：产生恢复正常记录。
- `true/false -> null`：只表示通讯未知，不清除报警。
- 断线保持末值时不产生新的报警和恢复边沿。
- 恢复后的完整帧可以根据明确的 `false` 清除原活动报警。
- 每个 `M400-M415` 保留独立地址和记录，不能只用 `D90` 合并成一个模糊报警。

## 12. SCADA Hub 对外协议

### 12.1 REST

第一阶段提供只读端点：

```text
GET /api/pure-water/plc/snapshot
GET /api/pure-water/plc/status
GET /api/health
```

不得提供：

```text
POST/PUT/PATCH/DELETE /api/pure-water/plc/*
```

### 12.2 WebSocket

复用统一实时通道：

```text
WS /ws/scada
```

纯水完整帧消息类型：

```text
purewater.plc.snapshot
```

断线/连接状态消息类型：

```text
source.status
```

### 12.3 统一信封

```json
{
  "schema": "scada.v1",
  "messageType": "purewater.plc.snapshot",
  "sourceId": "purewater-plc-01",
  "sourceType": "mitsubishi-plc",
  "seq": 42,
  "timestamp": "2026-08-12T12:00:00.000Z",
  "quality": "good",
  "payload": {
    "enabled": true,
    "connected": true,
    "adapterLabel": "FX3GA-60MR / FX3U-ENET-ADP 只读适配器",
    "receivedAt": 1786536000000,
    "sequence": 42,
    "bits": {
      "X000": true,
      "Y002": true,
      "M400": false,
      "M500": true
    },
    "words": {
      "D51": 64,
      "D52": 58,
      "D90": 0
    },
    "rawWords": {
      "D51": 64,
      "D52": 58,
      "D90": 0
    }
  }
}
```

字段规则：

- `enabled=false` 表示 Hub 未配置真实 PLC；前端不得因此关闭本地演示。`enabled=true, connected=false` 才表示已配置数据源当前断线。
- `timestamp` 使用 UTC ISO 8601。
- `receivedAt` 使用 Unix 毫秒，表示 Hub 完成完整主帧的时间。
- `seq/sequence` 仅在完整成功帧后递增。
- 断线通知不能刷新 `receivedAt`。
- `words` 是给业务/UI 使用的质量化值；越界液位为 `null`。`rawWords` 保留 PLC 实际 UInt16 原始值，供诊断追溯，不能直接当作健康业务值。
- 前端收到 `payload` 后调用 `ingestPureWaterPlcTelemetry(payload)`。

### 12.4 服务监听边界

开发和单机部署默认：

```text
http://127.0.0.1:18080
ws://127.0.0.1:18080/ws/scada
```

如需其他局域网客户端访问，必须另行配置防火墙白名单；不得直接监听公网接口并暴露 PLC 数据。

## 13. 旧 MitsubishiMonitor 复用规则

参考项目：

```text
E:\Desktop\开发项目汇总\MitsubishiMonitor
```

### 13.1 可以复用

- `MelsecA1ENet` 的 TCP 连接方式。
- `IMitsubishiPlcTransport` 和 transport factory 的抽象思路。
- 连接超时、接收超时和应用级硬超时。
- 每代连接独立 transport/锁、迟到结果丢弃和重连恢复逻辑。
- `ReadBool`、16 位/32 位读取的封装方式。
- 无线网桥偶发失败下的连续失败判定。

### 13.2 不得复用

- 旧项目的 4 台设备 IP 和 `config.json`。
- 旧项目的 X/Y/M/D 地址、温度和热电偶寄存器。
- WPF ViewModel、Dispatcher、窗口和控件代码。
- SQLite、Excel、温度日志等无关业务。
- 旧项目对某些 D 点的 `ReadInt32` 默认假设。
- 任何设备控制或写入代码。

### 13.3 数据类型迁移原则

CPU 型号改变不会改变 ENET-ADP 对外提供的协议，但会改变业务点表和寄存器含义。因此：

- 复用传输和恢复机制。
- 重新建立纯水点表。
- 每个 D/C 点重新确认 16/32 位、有符号/无符号和缩放。
- 在确认前不得用旧项目的温度寄存器逻辑套用纯水数据。

## 14. 日志与可诊断性

结构化日志至少包含：

```text
sourceId
connectionGeneration
cycleSequence
operation
address
length
durationMs
result
errorCode
consecutiveFailures
```

日志规则：

- 连接、断线、超时、重连和恢复必须有明确记录。
- 高频相同错误应限频汇总，不能每秒刷满磁盘。
- 默认不输出原始二进制报文；仅在短时诊断日志级别开启。
- 日志不得包含无线 SSID、密码或其他本地凭据。
- 启动日志必须打印 `READ-ONLY`，并打印已启用的点位组和目标端口。

## 15. 安全要求

- 安装或拆卸模块前必须切断所有相位电源。
- PLC/ENET-ADP 仅放在受控 LAN；通过防火墙或 VPN 隔离不可信网络。
- 第一阶段只读联调前确认现场设备允许监视，且不会影响生产。
- 不使用 PLC IP 变更寄存器作为应用配置手段。
- 不在 Git 文档中记录无线凭据。
- 前端 UI 必须持续显示数据来源和数据龄，不能把演示数据、末值和实时数据混淆。
- `Y=ON` 仅表示 PLC 输出逻辑，不证明接触器、变频器、泵或阀门实际动作。

## 16. 测试规格

### 16.1 静态检查

- 后端 PLC adapter 中不存在 `Write*`、`RemoteRun`、`RemoteStop`。
- 前端不存在 PLC IP、TCP 5000 或 HslCommunication 引用。
- X/Y 标签映射中不存在 `X008/X009/Y008/Y009`。
- 点位地址全部在本文登记范围内。
- 仓库默认配置 `Enabled=false` 且 IP 为空。

### 16.2 单元测试

- 0-23 索引正确映射为八进制 `000-027`。
- X/Y/M/D 正常帧能生成规定 payload。
- `false`、`0` 和 `null` 不混淆。
- `D51/D52` 越界不会被当成健康液位。
- 任一主读取失败不会推进 `sequence/receivedAt`。
- 两次连续失败进入断线通知。
- 硬超时后旧连接迟到结果被丢弃。
- 重连后的第一完整帧恢复实时状态。
- 断线不会错误清除 `M400-M415` 报警。

### 16.3 无 PLC 集成测试

使用 fake transport 验证：

- 正常连续采集。
- 连接拒绝。
- 读取返回错误。
- 同步调用永久卡住。
- 一次丢包后恢复。
- 连续失败后断线。
- 旧 generation 迟到返回。
- WebSocket 快照和 `source.status` 顺序。
- REST 端点只读；控制路由不存在。

### 16.4 现场只读验收

现场验收必须单独记录，软件构建通过不能代替现场验收：

1. 核对 PLC 和模块完整铭牌、固件及连接顺序。
2. 备份 GX Works2 工程和当前 Ethernet Port 参数。
3. 核对最终 PLC IP、掩码、CH、Binary、TCP、MC Protocol、端口 5000。
4. 中控电脑能 ping 通 PLC IP。
5. 只读连接建立，ENET-ADP OPEN/SD/RD 状态合理，ERR 不亮。
6. 连续读取 30 分钟，无 UI 卡死和采集任务堆积。
7. 对照原 HMI，至少抽查 X、Y、M、D51、D52 各 10 次。
8. 断开网桥，验证末值、数据龄、stale/disconnected 提示。
9. 恢复网桥，验证自动重连且旧迟到帧不覆盖新帧。
10. 全程确认 PLC 输出、机械设备和参数没有因本软件发生改变。

## 17. 实施顺序

后续编码按以下顺序推进，每一步单独验证：

1. 建立 `.NET 8` SCADA Hub 空骨架和默认禁用配置。
2. 移植最小只读 transport、factory 和 fake transport。
3. 实现 X/Y 八进制映射及静态点表测试。
4. 实现第一阶段主帧读取，不接真实 PLC。
5. 实现连接代、硬超时、失败阈值和重连测试。
6. 实现状态缓存、`scada.v1` 信封、REST 和 WebSocket。
7. 实现前端 `scadaRealtimeClient.ts`，接入现有 ingestion API。
8. 用 fake transport 完成端到端演示和断线测试。
9. 经过现场授权后填写本地 IP，执行首次只读验收。
10. 完成主帧验收后，再核对并加入第二阶段诊断字设备。

不得在第 4 步之前加入所有高级 D/C 点，也不得跳过 fake transport 直接连接现场 PLC。

## 18. 完成定义

本模块达到第一阶段完成状态必须同时满足：

- 协议固定为 `MelsecA1ENet` / MC A-compatible 1E / TCP / Binary。
- 默认配置不会连接任何现场设备。
- 后端和前端均不存在 PLC 写入能力。
- 第一阶段点位和八进制映射测试通过。
- 超时、断线、重连和迟到帧测试通过。
- REST/WS payload 能被当前 Zustand ingestion 正确消费。
- UI 能明确区分 offline/demo/live/stale/disconnected。
- 构建、测试、前端 `verify:scene` 和 lint 通过。
- 现场只读验收记录完成，且与原 HMI 对照一致。

## 19. 待现场确认事项

以下事项不阻止先写默认禁用的代码骨架，但在真实连接前必须完成：

- [ ] PLC 完整铭牌是否为 `FX3GA-60MR-CM`。
- [ ] `FX3U-ENET-ADP` 当前固件/版本。
- [ ] ENET-ADP 实际占用 CH1 还是 CH2。
- [ ] 当前 GX Works2 Ethernet Port 和 Open Setting 截图/导出。
- [ ] 当前是否启用了 `M8498` EEPROM IP 覆盖。
- [ ] 纯水 PLC 最终数据 IP、子网掩码和中控电脑副 IP。
- [ ] 纯水房对应网桥的最终管理 IP。
- [ ] `D1/D2/D21/D22` 的精确数据类型和缩放。
- [ ] `C10` 通过 1E 帧读取时的实际值和单位。
- [ ] `D529/D533/D537/D538/D563/D569/D573` 的现场单位与 HMI 一致性。
- [ ] `D51/D52` 越界时 PLC/HMI 的实际行为。

## 20. 参考资料

- [三菱 FX3U-ENET-ADP User's Manual](https://dl.mitsubishielectric.com/dl/fa/document/manual/plc_fx/jy997d45801/jy997d45801h.pdf)
- [三菱 FX3G Series User's Manual - Hardware Edition](https://dl.mitsubishielectric.com/dl/fa/document/manual/plc_fx/jy997d31301/jy997d31301u.pdf)
- [三菱 MELSEC-F / FX3GA 与 FX3U-ENET-ADP 安全公告](https://www.mitsubishielectric.com/psirt/vulnerability/pdf/2023-005_en.pdf)
- [`./接入路线图.md`](./接入路线图.md)
- [`./总控统一数据协议.md`](./总控统一数据协议.md)
- [`../../src/store/pureWaterPlc.ts`](../../src/store/pureWaterPlc.ts)
- `E:\Desktop\开发项目汇总\MitsubishiMonitor\Services\MitsubishiPlcTransport.cs`
- `E:\Desktop\开发项目汇总\MitsubishiMonitor\Services\MitsubishiPlcService.cs`
- `E:\Desktop\开发项目汇总\MitsubishiMonitor\Models\PlcConfig.cs`

---

后续如需改变协议、增加点位、改变新鲜度阈值或开放控制，必须先更新本文档版本和变更说明，再修改代码。
