namespace ScadaHub.Adapters.Mitsubishi;

public sealed record PlcReadContext(
    string SourceId,
    long ConnectionGeneration,
    long CycleSequence,
    int ConsecutiveFailures)
{
    public static PlcReadContext Unspecified { get; } = new(
        "unspecified",
        ConnectionGeneration: 0,
        CycleSequence: 0,
        ConsecutiveFailures: 0);
}
