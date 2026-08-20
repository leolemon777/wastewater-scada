namespace ScadaHub.Contracts;

public sealed record ScadaEnvelope<TPayload>
{
    public string Schema { get; init; } = "scada.v1";
    public required string MessageType { get; init; }
    public required string SourceId { get; init; }
    public string SourceType { get; init; } = "mitsubishi-plc";
    /// <summary>Hub 进程标识（SPEC 8.1）：进程生命周期内不变，前端按 (sourceId, sourceEpoch, eventSeq) 防回退。</summary>
    public string? SourceEpoch { get; init; }
    /// <summary>eventSeq（SPEC 8.1）：该 SourceId 的每个 snapshot/status 事件严格递增。</summary>
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
