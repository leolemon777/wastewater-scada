namespace ScadaHub.Contracts;

/// <summary>
/// M100 网关遥测快照。Do/Di/Ai 为本机 IO 原始值（键形如 do01/di01/ai01，AI 单位 uA），
/// Points 为按设备角色换算后的工程值（如 ph、level）。RS485 下挂仪表数据不在本遥测内。
/// </summary>
public sealed record M100Telemetry
{
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string AdapterLabel { get; init; }
    public long? ReceivedAt { get; init; }
    public required long Sequence { get; init; }
    public required IReadOnlyDictionary<string, bool?> Do { get; init; }
    public required IReadOnlyDictionary<string, bool?> Di { get; init; }
    public required IReadOnlyDictionary<string, int?> Ai { get; init; }
    public required IReadOnlyDictionary<string, double?> Points { get; init; }
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
    public required string SourceId { get; init; }
    public required string Role { get; init; }
    public required bool Enabled { get; init; }
    public required bool Connected { get; init; }
    public required string Quality { get; init; }
    public required long Sequence { get; init; }
    public long? LastReceivedAt { get; init; }
    public string? LastError { get; init; }
    public required int ConsecutiveFailures { get; init; }
}
