namespace ScadaHub.Infrastructure;

public interface IScadaClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class SystemScadaClock : IScadaClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
