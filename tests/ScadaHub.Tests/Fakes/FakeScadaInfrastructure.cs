using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;

namespace ScadaHub.Tests.Fakes;

internal sealed class FakeScadaClock : IScadaClock
{
    public FakeScadaClock(DateTimeOffset utcNow)
    {
        UtcNow = utcNow;
    }

    public DateTimeOffset UtcNow { get; private set; }

    public void Advance(TimeSpan duration) => UtcNow = UtcNow.Add(duration);
}

internal sealed class CapturingRealtimePublisher : IScadaRealtimePublisher
{
    public ConcurrentQueue<object> Messages { get; } = new();

    public Task BroadcastAsync(object message, CancellationToken cancellationToken)
    {
        Messages.Enqueue(message);
        return Task.CompletedTask;
    }

    public Task HandleClientAsync(HttpContext context, CancellationToken cancellationToken)
        => throw new NotSupportedException("本 fake 仅捕获广播消息。");
}

internal sealed record CapturedLog(
    LogLevel Level,
    string Message,
    Exception? Exception,
    IReadOnlyDictionary<string, object?> Properties);

internal sealed class CapturingLogger<T> : ILogger<T>
{
    public ConcurrentQueue<CapturedLog> Entries { get; } = new();

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        var properties = state is IEnumerable<KeyValuePair<string, object?>> values
            ? values
                .Where(pair => pair.Key != "{OriginalFormat}")
                .ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal)
            : new Dictionary<string, object?>();

        Entries.Enqueue(new CapturedLog(
            logLevel,
            formatter(state, exception),
            exception,
            properties));
    }
}
