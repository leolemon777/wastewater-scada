using Microsoft.Extensions.Options;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;

namespace ScadaHub.State;

public sealed class PureWaterPlcStateCache
{
    private const string LiveAdapterLabel = "FX3GA-60MR / FX3U-ENET-ADP 只读适配器";
    private readonly object _sync = new();
    private readonly PureWaterPlcOptions _options;
    private readonly IScadaClock _clock;
    private PureWaterPlcTelemetry _telemetry;
    private string _quality = "offline";
    private string? _lastError;
    private int _consecutiveFailures;

    public PureWaterPlcStateCache(IOptions<PureWaterPlcOptions> options, IScadaClock clock)
    {
        _options = options.Value;
        _clock = clock;
        _telemetry = new PureWaterPlcTelemetry
        {
            Enabled = _options.Enabled,
            Connected = false,
            AdapterLabel = _options.Enabled ? LiveAdapterLabel : "三菱 PLC 通信待配置",
            ReceivedAt = null,
            Sequence = 0,
            Bits = new Dictionary<string, bool?>(),
            Words = new Dictionary<string, int?>(),
            RawWords = new Dictionary<string, int>(),
        };
    }

    public ScadaEnvelope<PureWaterPlcTelemetry> PublishSuccess(
        PureWaterPlcFrame frame,
        long sequence,
        DateTimeOffset receivedAt)
    {
        lock (_sync)
        {
            _consecutiveFailures = 0;
            _lastError = null;
            _quality = "good";
            _telemetry = new PureWaterPlcTelemetry
            {
                Enabled = true,
                Connected = true,
                AdapterLabel = LiveAdapterLabel,
                ReceivedAt = receivedAt.ToUnixTimeMilliseconds(),
                Sequence = sequence,
                Bits = CloneBits(frame.Bits),
                Words = CloneWords(frame.Words),
                RawWords = CloneRawWords(frame.RawWords),
                Warnings = frame.PointWarnings.ToArray(),
            };

            return BuildSnapshotEnvelope(_telemetry, receivedAt, _quality);
        }
    }

    public (ScadaEnvelope<PureWaterSourceStatusEvent> Envelope, bool Changed) RecordFailure(
        string reason,
        int consecutiveFailures,
        bool markDisconnected)
    {
        lock (_sync)
        {
            var previousFailures = _consecutiveFailures;
            _lastError = reason;
            _consecutiveFailures = consecutiveFailures;
            var wasConnected = _telemetry.Connected;

            if (markDisconnected)
            {
                _quality = "offline";
                _telemetry = _telemetry with { Connected = false };
            }

            var now = _clock.UtcNow;
            return (
                new ScadaEnvelope<PureWaterSourceStatusEvent>
                {
                    MessageType = "source.status",
                    SourceId = _options.SourceId,
                    Seq = _telemetry.Sequence,
                    Timestamp = now,
                    Quality = _quality,
                    Payload = new PureWaterSourceStatusEvent
                    {
                        Enabled = _options.Enabled,
                        Connected = _telemetry.Connected,
                        AdapterLabel = _telemetry.AdapterLabel,
                        ReceivedAt = _telemetry.ReceivedAt,
                        Sequence = _telemetry.Sequence,
                        Reason = reason,
                    },
                },
                markDisconnected
                    && (wasConnected || previousFailures < _options.FailuresBeforeDisconnect));
        }
    }

    public ScadaEnvelope<PureWaterPlcTelemetry> GetSnapshotEnvelope()
    {
        lock (_sync)
        {
            var telemetry = CloneTelemetry(_telemetry);
            return BuildSnapshotEnvelope(telemetry, _clock.UtcNow, _quality);
        }
    }

    public PureWaterSourceStatus GetStatus()
    {
        lock (_sync)
        {
            return new PureWaterSourceStatus
            {
                SourceId = _options.SourceId,
                Enabled = _options.Enabled,
                Connected = _telemetry.Connected,
                Quality = _quality,
                Sequence = _telemetry.Sequence,
                LastReceivedAt = _telemetry.ReceivedAt,
                LastError = _lastError,
                ConsecutiveFailures = _consecutiveFailures,
            };
        }
    }

    private ScadaEnvelope<PureWaterPlcTelemetry> BuildSnapshotEnvelope(
        PureWaterPlcTelemetry telemetry,
        DateTimeOffset timestamp,
        string quality)
    {
        return new ScadaEnvelope<PureWaterPlcTelemetry>
        {
            MessageType = "purewater.plc.snapshot",
            SourceId = _options.SourceId,
            Seq = telemetry.Sequence,
            Timestamp = timestamp,
            Quality = quality,
            Payload = telemetry,
        };
    }

    private static PureWaterPlcTelemetry CloneTelemetry(PureWaterPlcTelemetry source)
    {
        return source with
        {
            Bits = CloneBits(source.Bits),
            Words = CloneWords(source.Words),
            RawWords = CloneRawWords(source.RawWords),
            Warnings = source.Warnings.ToArray(),
        };
    }

    private static IReadOnlyDictionary<string, bool?> CloneBits(IReadOnlyDictionary<string, bool?> source)
        => new Dictionary<string, bool?>(source, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, int?> CloneWords(IReadOnlyDictionary<string, int?> source)
        => new Dictionary<string, int?>(source, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, int> CloneRawWords(IReadOnlyDictionary<string, int> source)
        => new Dictionary<string, int>(source, StringComparer.OrdinalIgnoreCase);
}
