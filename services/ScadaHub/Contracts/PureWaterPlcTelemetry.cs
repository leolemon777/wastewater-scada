namespace ScadaHub.Contracts;

public sealed record PureWaterPlcTelemetry
{
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string AdapterLabel { get; init; }
    public long? ReceivedAt { get; init; }
    public required long Sequence { get; init; }
    public required IReadOnlyDictionary<string, bool?> Bits { get; init; }
    public required IReadOnlyDictionary<string, int?> Words { get; init; }
    public required IReadOnlyDictionary<string, int> RawWords { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
}

public sealed record PureWaterPlcFrame
{
    public required IReadOnlyDictionary<string, bool?> Bits { get; init; }
    public required IReadOnlyDictionary<string, int?> Words { get; init; }
    public required IReadOnlyDictionary<string, int> RawWords { get; init; }
    public IReadOnlyList<string> PointWarnings { get; init; } = Array.Empty<string>();
}

public sealed record PureWaterSourceStatus
{
    public required string SourceId { get; init; }
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string Quality { get; init; }
    public required long Sequence { get; init; }
    public long? LastReceivedAt { get; init; }
    public string? LastError { get; init; }
    public required int ConsecutiveFailures { get; init; }
}
