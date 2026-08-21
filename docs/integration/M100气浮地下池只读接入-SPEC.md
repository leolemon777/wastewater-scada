# M100 气浮/地下池只读接入 SPEC

状态：**已实现并通过真机验收**（2026-08-19）。对应接入路线图第 4 步「加 M100 最小接口」的只读部分。

## 目标与边界

把气浮前端 M100（`192.168.0.31`）与地下池 M100（`192.168.0.8`）的本机 IO 经 ScadaHub 只读采集后推送前端。

- **严格只读**：仅 `GET http://<ip>/ioread.cgi?read`（Basic 认证）；不实现 `iowrite.cgi`，控制写入须另行评审授权。
- RS485 下挂仪表（混合池等）数据不在本链路内（有人云独占主站，见调试记录 06-30 结论）。
- 读与写分阶段评审，不复用纯水 PLC 只读授权。

## 数据流

```
M100 (.31 气浮 / .8 地下池) --HTTP ioread.cgi(Basic)--> M100Collector(轮询+退避)
  → M100StateCache(按 SourceId 缓存/hold) → scada.v1 信封(messageType=m100.snapshot, sourceType=m100-http)
  → ScadaWebSocketPublisher(/ws/scada) → 前端 scadaRealtimeClient → useScadaStore.ingestM100Telemetry
  → tk-daf(aerationRunning/scraperRunning/pH)、tk-intermediate(levelValue/levelPercent)
```

REST：`GET /api/m100/snapshots`（数组）、`GET /api/m100/statuses`；`/api/health` 含 `m100` 段。WS 建连回放纯水 + 全部 M100 设备初始帧。

## 配置（`M100` 节，appsettings.json 默认禁用）

```json
"M100": {
  "Enabled": false,
  "Devices": [
    { "SourceId": "m100-daf-01", "Role": "daf", "IpAddress": "", "Username": "", "Password": "", "PollIntervalMs": 1000, "RequestTimeoutMs": 3000, "FailuresBeforeDisconnect": 2 },
    { "SourceId": "m100-underground-01", "Role": "underground", ... }
  ]
}
```

- `Role` 决定工程换算：`daf` → `ph = (mA-4)/16*14`（AI1，4-20mA/0-14pH）；`underground` → `level = (mA-4)/16*5`（AI1，0-5m）。电流出 [4,20] → `null` + warning（故障电流不产错误工程值）。
- 凭据只写 `appsettings.local.json`（gitignore）；example 提供占位。
- 每设备独立序列号、失败计数、退避（1/2/5/10/15s）；失败仅在状态翻转时广播 `source.status`。
- 新增设备（如 `.30` 收集池液位、`.32` 流量计接线完成后）：配置加一条 Device + 新 Role 换算 + `M100_SOURCE_IDS` 登记。

## 前端行为

- `src/store/m100Realtime.ts`：类型/清洗/连接状态机（live→stale 10s→disconnected 30s）/设备 patch 映射（单向，无反向写）。
- **demo 互斥**：真实 M100 帧接管 `tk-daf`/`tk-intermediate` 后，wastewater demo tick 不再覆盖这些设备（`m100LiveEquipmentIds`）；断连保持最后一帧，不回退 demo。
- 3D 场景零改动（`DAFTank3D` 已消费对应字段）。

## 只读守卫

- 传输接口仅 `ReadIOAsync`；REST GET-only；WS 拒收客户端帧（沿纯水约定）。
- 测试：`M100ReadOnlySurfaceTests`（反射无写成员）+ `check-m100-backend-readonly.mjs`（静态断言）+ `check-m100-realtime-client.mjs`（运行时解码/映射/看门狗）。

## 2026-08-19 真机验收记录

- 测试：`dotnet test` 60/60 通过（新增 22 项 M100 测试）；`npm run check:scene` 38/38；`npm run build` 通过。
- 真机：本机 `appsettings.local.json` 启用 `.31/.8` 后，`/api/m100/statuses` 两台 `connected=true, quality=good`；快照实测 `m100-daf-01: do01/do02=true, ph=4.987`、`m100-underground-01: level=3.367m`，与手动 `ioread.cgi` 读数一致（pH≈5.0、液位下午 3.78→3.37m 持续变化）。

## 已知限制与后续

- 地下池液位通道为 AI1（07-02 时是 AI2，接线已调整）；若现场再换端子需同步改 Role 换算映射。
- 前端尚无 M100 专属状态徽标/面板（数据经 3D 场景与 Overlay 详情面板展示）；如需操作员面板可复用 PureWaterDashboard 积木后补。
- 混合池（默认 `.7`，RS485）与 `.30/.32`（传感器待接线）接入时扩展 Devices 配置。
