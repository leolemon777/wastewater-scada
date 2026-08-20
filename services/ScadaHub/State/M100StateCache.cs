using Microsoft.Extensions.Options;
using ScadaHub.Adapters.M100;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;

namespace ScadaHub.State;

/// <summary>
/// 按 SourceId 维护多台 M100 网关的快照与质量状态（contractVersion=2）。
/// 断连时保持最后一帧：tags.value 置空、lastGoodValue 保留为明确保持值（SPEC 8.2）。
/// </summary>
public sealed class M100StateCache
{
    public const string SnapshotMessageType = "m100.snapshot";
    public const string SourceType = "m100-http";
    private const string DisabledAdapterLabel = "M100 网关通信待配置";

    private readonly object _sync = new();
    private readonly M100Options _options;
    private readonly DeviceIoGate _ioGate;
    private readonly HubEpoch _epoch;
    private readonly IScadaClock _clock;
    private readonly Dictionary<string, DeviceState> _devices = new(StringComparer.Ordinal);

    public M100StateCache(
        IOptions<M100Options> options,
        DeviceIoGate ioGate,
        HubEpoch epoch,
        IScadaClock clock)
    {
        _options = options.Value;
        _ioGate = ioGate;
        _epoch = epoch;
        _clock = clock;
        foreach (var device in options.Value.Devices)
        {
            _devices[device.SourceId] = new DeviceState(device, _epoch.CounterFor(device.SourceId));
        }
    }

    private bool ConfiguredEnabled => _options.Enabled;

    private bool IoSuppressed => _ioGate.IoSuppressed;

    public ScadaEnvelope<M100Telemetry> PublishSuccess(
        string sourceId,
        M100Frame frame,
        IReadOnlyDictionary<string, double?> points,
        IReadOnlyDictionary<string, M100TagSnapshot> tags,
        long dataSequence,
        DateTimeOffset receivedAt)
    {
        lock (_sync)
        {
            var state = GetDevice(sourceId);
            var eventSeq = state.EventCounter.Next();
            state.ConsecutiveFailures = 0;
            state.LastError = null;
            state.Quality = "good";
            state.Telemetry = new M100Telemetry
            {
                ConfiguredEnabled = ConfiguredEnabled,
                IoSuppressed = IoSuppressed,
                Enabled = true,
                Connected = true,
                AdapterLabel = M100PointMap.AdapterLabel(state.Options.Role),
                ReceivedAt = receivedAt.ToUnixTimeMilliseconds(),
                LastSuccessAt = receivedAt.ToUnixTimeMilliseconds(),
                DataSequence = dataSequence,
                Do = ToDictionary(frame.Do, "do"),
                Di = ToDictionary(frame.Di, "di"),
                Ai = ToRawDictionary(frame.Ai, "ai"),
                Points = new Dictionary<string, double?>(points, StringComparer.OrdinalIgnoreCase),
                Tags = CloneTags(tags),
                Warnings = frame.PointWarnings.ToArray(),
            };

            return BuildSnapshotEnvelope(sourceId, state.Telemetry, eventSeq, receivedAt, state.Quality);
        }
    }

    public (ScadaEnvelope<PureWaterSourceStatusEvent> Envelope, bool Changed) RecordFailure(
        string sourceId,
        string reason,
        int consecutiveFailures,
        bool markDisconnected)
    {
        lock (_sync)
        {
            var state = GetDevice(sourceId);
            var previousFailures = state.ConsecutiveFailures;
            var eventSeq = state.EventCounter.Next();
            state.LastError = reason;
            state.ConsecutiveFailures = consecutiveFailures;
            var wasConnected = state.Telemetry.Connected;

            if (markDisconnected)
            {
                state.Quality = "offline";
                // 断线快照（SPEC 8.2）：携带同 Hub 进程内末次好值，value 置空、点质量 offline。
                state.Telemetry = state.Telemetry with
                {
                    Connected = false,
                    Tags = OfflineTags(state.Telemetry.Tags),
                };
            }

            var now = _clock.UtcNow;
            return (
                new ScadaEnvelope<PureWaterSourceStatusEvent>
                {
                    MessageType = "source.status",
                    SourceId = sourceId,
                    SourceType = SourceType,
                    SourceEpoch = _epoch.Value,
                    Seq = eventSeq,
                    Timestamp = now,
                    Quality = state.Quality,
                    Payload = new PureWaterSourceStatusEvent
                    {
                        Enabled = true,
                        Connected = state.Telemetry.Connected,
                        AdapterLabel = state.Telemetry.AdapterLabel,
                        ReceivedAt = state.Telemetry.LastSuccessAt,
                        Sequence = state.Telemetry.DataSequence,
                        Reason = reason,
                    },
                },
                markDisconnected
                    && (wasConnected || previousFailures < state.Options.FailuresBeforeDisconnect));
        }
    }

    public IReadOnlyList<ScadaEnvelope<M100Telemetry>> GetAllSnapshotEnvelopes()
    {
        lock (_sync)
        {
            return _devices.Values
                .Select(state => BuildSnapshotEnvelope(
                    state.Options.SourceId,
                    state.Telemetry,
                    state.EventCounter.Current,
                    _clock.UtcNow,
                    state.Quality))
                .ToArray();
        }
    }

    public ScadaEnvelope<M100Telemetry> GetSnapshotEnvelope(string sourceId)
    {
        lock (_sync)
        {
            var state = GetDevice(sourceId);
            return BuildSnapshotEnvelope(sourceId, state.Telemetry, state.EventCounter.Current, _clock.UtcNow, state.Quality);
        }
    }

    public IReadOnlyList<M100SourceStatus> GetStatuses()
    {
        lock (_sync)
        {
            return _devices.Values.Select(ToStatus).ToArray();
        }
    }

    public M100SourceStatus GetStatus(string sourceId)
    {
        lock (_sync)
        {
            return ToStatus(GetDevice(sourceId));
        }
    }

    private M100SourceStatus ToStatus(DeviceState state) => new()
    {
        SourceId = state.Options.SourceId,
        Role = state.Options.Role,
        ConfiguredEnabled = ConfiguredEnabled,
        IoSuppressed = IoSuppressed,
        Enabled = state.Telemetry.Enabled,
        Connected = state.Telemetry.Connected,
        Quality = state.Quality,
        Sequence = state.Telemetry.DataSequence,
        LastSuccessAt = state.Telemetry.LastSuccessAt,
        LastError = state.LastError,
        ConsecutiveFailures = state.ConsecutiveFailures,
    };

    private DeviceState GetDevice(string sourceId)
    {
        if (!_devices.TryGetValue(sourceId, out var state))
        {
            throw new InvalidOperationException($"未知的 M100 设备 SourceId：{sourceId}");
        }

        return state;
    }

    private ScadaEnvelope<M100Telemetry> BuildSnapshotEnvelope(
        string sourceId,
        M100Telemetry telemetry,
        long eventSeq,
        DateTimeOffset timestamp,
        string quality)
    {
        return new ScadaEnvelope<M100Telemetry>
        {
            MessageType = SnapshotMessageType,
            SourceId = sourceId,
            SourceType = SourceType,
            SourceEpoch = _epoch.Value,
            Seq = eventSeq,
            Timestamp = timestamp,
            Quality = quality,
            Payload = telemetry,
        };
    }

    private static IReadOnlyDictionary<string, M100TagSnapshot> OfflineTags(IReadOnlyDictionary<string, M100TagSnapshot> tags)
    {
        var result = new Dictionary<string, M100TagSnapshot>(StringComparer.OrdinalIgnoreCase);
        foreach (var (tagId, tag) in tags)
        {
            result[tagId] = tag with { Value = null, Quality = "offline" };
        }

        return result;
    }

    private static IReadOnlyDictionary<string, M100TagSnapshot> CloneTags(IReadOnlyDictionary<string, M100TagSnapshot> source)
        => new Dictionary<string, M100TagSnapshot>(source, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, bool?> ToDictionary(IReadOnlyList<bool?> values, string prefix)
    {
        var result = new Dictionary<string, bool?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < values.Count; i++)
        {
            result[$"{prefix}{(i + 1):00}"] = values[i];
        }

        return result;
    }

    private static IReadOnlyDictionary<string, int?> ToRawDictionary(IReadOnlyList<int?> values, string prefix)
    {
        var result = new Dictionary<string, int?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < values.Count; i++)
        {
            result[$"{prefix}{(i + 1):00}"] = values[i];
        }

        return result;
    }

    private sealed class DeviceState
    {
        public DeviceState(M100DeviceOptions options, HubEpoch.SequenceCounter eventCounter)
        {
            Options = options;
            EventCounter = eventCounter;
            Telemetry = new M100Telemetry
            {
                ConfiguredEnabled = false,
                IoSuppressed = false,
                Enabled = false,
                Connected = false,
                AdapterLabel = DisabledAdapterLabel,
                ReceivedAt = null,
                LastSuccessAt = null,
                DataSequence = 0,
                Do = new Dictionary<string, bool?>(),
                Di = new Dictionary<string, bool?>(),
                Ai = new Dictionary<string, int?>(),
                Points = new Dictionary<string, double?>(),
                Tags = new Dictionary<string, M100TagSnapshot>(),
            };
        }

        public M100DeviceOptions Options { get; }
        public HubEpoch.SequenceCounter EventCounter { get; }
        public M100Telemetry Telemetry { get; set; }
        public string Quality { get; set; } = "offline";
        public string? LastError { get; set; }
        public int ConsecutiveFailures { get; set; }
    }
}
