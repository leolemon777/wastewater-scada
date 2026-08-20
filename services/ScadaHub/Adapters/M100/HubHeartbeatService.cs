using System.Diagnostics;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;

namespace ScadaHub.Adapters.M100;

/// <summary>
/// hub.heartbeat（SPEC 8.4）：每 5s 广播一次，固定 sourceId=scada-hub、独立 eventSeq。
/// 只证明 Hub/WS 通道存活，不证明任何设备数据健康。
/// </summary>
public sealed class HubHeartbeatService : BackgroundService
{
    public const string MessageType = "hub.heartbeat";
    public const string HubSourceId = "scada-hub";
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    private readonly IScadaRealtimePublisher _publisher;
    private readonly HubEpoch _epoch;
    private readonly ILogger<HubHeartbeatService> _logger;
    private readonly HubEpoch.SequenceCounter _counter;
    private readonly string _version;
    private readonly string _commit;
    private readonly Stopwatch _uptime = Stopwatch.StartNew();

    public HubHeartbeatService(
        IScadaRealtimePublisher publisher,
        HubEpoch epoch,
        ILogger<HubHeartbeatService> logger)
    {
        _publisher = publisher;
        _epoch = epoch;
        _logger = logger;
        _counter = epoch.CounterFor(HubSourceId);

        var assembly = typeof(Program).Assembly;
        var informational = assembly.GetName().Version?.ToString() ?? "0.0.0";
        _version = $"readonly-trial-{informational}";
        // SourceRevisionId 由 .NET SDK 自动嵌入（SourceRevisionUrl 无效时为 commit 或空）。
        var revision = typeof(Program).Assembly.GetCustomAttributesData()
            .FirstOrDefault(data => string.Equals(data.AttributeType.Name, "AssemblyMetadataAttribute", StringComparison.Ordinal)
                && data.ConstructorArguments.Count == 2
                && string.Equals(data.ConstructorArguments[0].Value as string, "SourceRevisionId", StringComparison.Ordinal))
            ?.ConstructorArguments[1].Value as string;
        _commit = string.IsNullOrWhiteSpace(revision) ? "unknown" : revision!;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("hub.heartbeat 启动：每 {Seconds}s 广播（仅通道存活证明）。", Interval.TotalSeconds);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _publisher.BroadcastAsync(new ScadaEnvelope<HubHeartbeatPayload>
                {
                    MessageType = MessageType,
                    SourceId = HubSourceId,
                    SourceType = "scada-hub",
                    SourceEpoch = _epoch.Value,
                    Seq = _counter.Next(),
                    Timestamp = DateTimeOffset.UtcNow,
                    Quality = "good",
                    Payload = new HubHeartbeatPayload
                    {
                        Version = _version,
                        Commit = _commit,
                        UptimeMs = _uptime.ElapsedMilliseconds,
                    },
                }, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            await Task.Delay(Interval, stoppingToken).ConfigureAwait(false);
        }
    }
}

public sealed record HubHeartbeatPayload
{
    public int ContractVersion { get; init; } = 2;
    public required string Version { get; init; }
    public required string Commit { get; init; }
    public long UptimeMs { get; init; }
}
