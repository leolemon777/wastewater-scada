namespace ScadaHub.Contracts;

public sealed record ScadaEnvelope<TPayload>
{
    public string Schema { get; init; } = "scada.v1";
    public required string MessageType { get; init; }
    public required string SourceId { get; init; }
    public string SourceType { get; init; } = "mitsubishi-plc";
    public required long Seq { get; init; }
    public required DateTimeOffset Timestamp { get; init; }
    public required string Quality { get; init; }
    public required TPayload Payload { get; init; }
}

public sealed record PureWaterSourceStatusEvent
{
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string AdapterLabel { get; init; }
    public long? ReceivedAt { get; init; }
    public required long Sequence { get; init; }
    public string? Reason { get; init; }
}
