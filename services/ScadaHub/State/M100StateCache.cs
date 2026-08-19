using Microsoft.Extensions.Options;
using ScadaHub.Adapters.M100;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;

namespace ScadaHub.State;

/// <summary>按 SourceId 维护多台 M100 网关的快照与质量状态。断连时保持最后一帧（hold）。</summary>
public sealed class M100StateCache
{
    public const string SnapshotMessageType = "m100.snapshot";
    public const string SourceType = "m100-http";
    private const string DisabledAdapterLabel = "M100 网关通信待配置";

    private readonly object _sync = new();
    private readonly IScadaClock _clock;
    private readonly Dictionary<string, DeviceState> _devices = new(StringComparer.Ordinal);

    public M100StateCache(IOptions<M100Options> options, IScadaClock clock)
    {
        _clock = clock;
        foreach (var device in options.Value.Devices)
        {
            _devices[device.SourceId] = new DeviceState(device);
        }
    }

    public ScadaEnvelope<M100Telemetry> PublishSuccess(
        string sourceId,
        M100Frame frame,
        IReadOnlyDictionary<string, double?> points,
        long sequence,
        DateTimeOffset receivedAt)
    {
        lock (_sync)
        {
            var state = GetDevice(sourceId);
            state.ConsecutiveFailures = 0;
            state.LastError = null;
            state.Quality = "good";
            state.Telemetry = new M100Telemetry
            {
                Enabled = true,
                Connected = true,
                AdapterLabel = M100PointMap.AdapterLabel(state.Options.Role),
                ReceivedAt = receivedAt.ToUnixTimeMilliseconds(),
                Sequence = sequence,
                Do = ToDictionary(frame.Do, "do"),
                Di = ToDictionary(frame.Di, "di"),
                Ai = ToRawDictionary(frame.Ai, "ai"),
                Points = new Dictionary<string, double?>(points, StringComparer.OrdinalIgnoreCase),
                Warnings = frame.PointWarnings.ToArray(),
            };

            return BuildSnapshotEnvelope(sourceId, state.Telemetry, receivedAt, state.Quality);
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
            state.LastError = reason;
            state.ConsecutiveFailures = consecutiveFailures;
            var wasConnected = state.Telemetry.Connected;

            if (markDisconnected)
            {
                state.Quality = "offline";
                state.Telemetry = state.Telemetry with { Connected = false };
            }

            var now = _clock.UtcNow;
            return (
                new ScadaEnvelope<PureWaterSourceStatusEvent>
                {
                    MessageType = "source.status",
                    SourceId = sourceId,
                    SourceType = SourceType,
                    Seq = state.Telemetry.Sequence,
                    Timestamp = now,
                    Quality = state.Quality,
                    Payload = new PureWaterSourceStatusEvent
                    {
                        Enabled = true,
                        Connected = state.Telemetry.Connected,
                        AdapterLabel = state.Telemetry.AdapterLabel,
                        ReceivedAt = state.Telemetry.ReceivedAt,
                        Sequence = state.Telemetry.Sequence,
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
            return BuildSnapshotEnvelope(sourceId, state.Telemetry, _clock.UtcNow, state.Quality);
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
        Enabled = state.Telemetry.Enabled,
        Connected = state.Telemetry.Connected,
        Quality = state.Quality,
        Sequence = state.Telemetry.Sequence,
        LastReceivedAt = state.Telemetry.ReceivedAt,
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

    private static ScadaEnvelope<M100Telemetry> BuildSnapshotEnvelope(
        string sourceId,
        M100Telemetry telemetry,
        DateTimeOffset timestamp,
        string quality)
    {
        return new ScadaEnvelope<M100Telemetry>
        {
            MessageType = SnapshotMessageType,
            SourceId = sourceId,
            SourceType = SourceType,
            Seq = telemetry.Sequence,
            Timestamp = timestamp,
            Quality = quality,
            Payload = telemetry,
        };
    }

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
        public DeviceState(M100DeviceOptions options)
        {
            Options = options;
            Telemetry = new M100Telemetry
            {
                Enabled = false,
                Connected = false,
                AdapterLabel = DisabledAdapterLabel,
                ReceivedAt = null,
                Sequence = 0,
                Do = new Dictionary<string, bool?>(),
                Di = new Dictionary<string, bool?>(),
                Ai = new Dictionary<string, int?>(),
                Points = new Dictionary<string, double?>(),
            };
        }

        public M100DeviceOptions Options { get; }
        public M100Telemetry Telemetry { get; set; }
        public string Quality { get; set; } = "offline";
        public string? LastError { get; set; }
        public int ConsecutiveFailures { get; set; }
    }
}
