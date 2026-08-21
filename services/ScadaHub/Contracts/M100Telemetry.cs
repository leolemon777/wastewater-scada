namespace ScadaHub.Contracts;

/// <summary>逐 Tag 快照（SPEC 8.2 tags 结构）：新前端唯一权威业务值来源。</summary>
public sealed record M100TagSnapshot
{
    /// <summary>业务值；quality != good 时必须为 null（object 装载 double 或 bool）。</summary>
    public required object? Value { get; init; }
    /// <summary>末次好值（保持值显示用；断线保留、value 置空）。</summary>
    public required object? LastGoodValue { get; init; }
    /// <summary>good / invalid / offline（首版 Tag 级质量）。</summary>
    public required string Quality { get; init; }
    public required string Unit { get; init; }
    public required string RawKey { get; init; }
    public required object? RawValue { get; init; }
    public required string RawUnit { get; init; }
    public long? SampledAt { get; init; }
    public string? Warning { get; init; }
}

/// <summary>
/// M100 网关遥测快照（contractVersion=2）。tags 是新前端唯一权威业务值；
/// 旧 do/di/ai/points 仅供过渡兼容，新 UI 不得消费（SPEC 8.1）。
/// </summary>
public sealed record M100Telemetry
{
    public int ContractVersion { get; init; } = 2;
    public required bool ConfiguredEnabled { get; init; }
    public required bool IoSuppressed { get; init; }
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string AdapterLabel { get; init; }
    public long? ReceivedAt { get; init; }
    public long? LastSuccessAt { get; init; }
    /// <summary>仅完整成功采集递增（SPEC 8.1 dataSequence）。</summary>
    public required long DataSequence { get; init; }
    public required IReadOnlyDictionary<string, bool?> Do { get; init; }
    public required IReadOnlyDictionary<string, bool?> Di { get; init; }
    public required IReadOnlyDictionary<string, int?> Ai { get; init; }
    public required IReadOnlyDictionary<string, double?> Points { get; init; }
    public required IReadOnlyDictionary<string, M100TagSnapshot> Tags { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
}

/// <summary>单次 ioread 读取结果（原始数组，未做工程换算）。</summary>
public sealed record M100Frame
{
    public required IReadOnlyList<bool?> Do { get; init; }
    public required IReadOnlyList<bool?> Di { get; init; }
    public required IReadOnlyList<int?> Ai { get; init; }
    public IReadOnlyList<string> PointWarnings { get; init; } = Array.Empty<string>();
}

public sealed record M100SourceStatus
{
    public int ContractVersion { get; init; } = 2;
    public required string SourceId { get; init; }
    public required string Role { get; init; }
    public required bool ConfiguredEnabled { get; init; }
    public required bool IoSuppressed { get; init; }
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string Quality { get; init; }
    public required long Sequence { get; init; }
    public long? LastSuccessAt { get; init; }
    public string? LastError { get; init; }
    public required int ConsecutiveFailures { get; init; }
}
