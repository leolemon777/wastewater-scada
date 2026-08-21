using System.Diagnostics;
using Microsoft.Extensions.Options;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;

namespace ScadaHub.Adapters.Mitsubishi;

public sealed class PureWaterPlcCollector : IAsyncDisposable
{
    private static readonly TimeSpan RepeatedFailureLogInterval = TimeSpan.FromMinutes(1);
    private readonly PureWaterPlcOptions _options;
    private readonly IMitsubishiPlcTransportFactory _transportFactory;
    private readonly PureWaterPlcReader _reader;
    private readonly PureWaterPlcStateCache _stateCache;
    private readonly IScadaRealtimePublisher _publisher;
    private readonly IScadaClock _clock;
    private readonly ILogger<PureWaterPlcCollector> _logger;
    private readonly SemaphoreSlim _cycleGate = new(1, 1);
    private readonly object _sessionSync = new();
    private readonly object _failureLogSync = new();
    private readonly object _pointWarningLogSync = new();
    private readonly Dictionary<string, RepeatedLogState> _pointWarningLogStates = new(StringComparer.Ordinal);
    private MitsubishiPlcSession? _session;
    private long _nextGeneration;
    private long _cycleSequence;
    private long _sequence;
    private int _consecutiveFailures;
    private string? _lastFailureSignature;
    private DateTimeOffset? _lastFailureLogAt;
    private int _suppressedFailureLogs;
    private int _disposed;

    public PureWaterPlcCollector(
        IOptions<PureWaterPlcOptions> options,
        IMitsubishiPlcTransportFactory transportFactory,
        PureWaterPlcReader reader,
        PureWaterPlcStateCache stateCache,
        IScadaRealtimePublisher publisher,
        IScadaClock clock,
        ILogger<PureWaterPlcCollector> logger)
    {
        _options = options.Value;
        _transportFactory = transportFactory;
        _reader = reader;
        _stateCache = stateCache;
        _publisher = publisher;
        _clock = clock;
        _logger = logger;
    }

    public int ConsecutiveFailures => Volatile.Read(ref _consecutiveFailures);

    public async Task CollectOnceAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(Volatile.Read(ref _disposed) != 0, this);
        if (!_options.Enabled)
        {
            return;
        }

        await _cycleGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        MitsubishiPlcSession? session = null;
        var ioGateHeld = false;
        var cycleSequence = Interlocked.Increment(ref _cycleSequence);
        try
        {
            session = GetOrCreateSession();
            if (!session.Connected)
            {
                await ConnectAsync(session, cycleSequence, cancellationToken).ConfigureAwait(false);
            }

            await session.IoGate.WaitAsync(cancellationToken).ConfigureAwait(false);
            ioGateHeld = true;
            var frame = await _reader.ReadMainFrameAsync(
                session.Transport,
                _options.OperationTimeoutMs,
                new PlcReadContext(
                    _options.SourceId,
                    session.Generation,
                    cycleSequence,
                    ConsecutiveFailures),
                cancellationToken).ConfigureAwait(false);

            if (!IsCurrent(session))
            {
                _logger.LogDebug(
                    "Discarding PLC frame from retired generation: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}",
                    _options.SourceId,
                    session.Generation,
                    cycleSequence,
                    "CommitFrame",
                    "main-frame",
                    6,
                    0,
                    "discarded",
                    "RETIRED_GENERATION",
                    ConsecutiveFailures);
                return;
            }

            var previousFailures = Interlocked.Exchange(ref _consecutiveFailures, 0);
            var sequence = Interlocked.Increment(ref _sequence);
            var receivedAt = _clock.UtcNow;
            var envelope = _stateCache.PublishSuccess(frame, sequence, receivedAt);

            if (previousFailures > 0)
            {
                var suppressedFailureLogs = ResetFailureLogThrottle();
                _logger.LogInformation(
                    "READ-ONLY PLC acquisition recovered: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}, PreviousFailures={PreviousFailures}, SuppressedFailureLogs={SuppressedFailureLogs}",
                    _options.SourceId,
                    session.Generation,
                    cycleSequence,
                    "CommitFrame",
                    "main-frame",
                    6,
                    0,
                    "recovered",
                    "none",
                    0,
                    previousFailures,
                    suppressedFailureLogs);
            }

            PruneResolvedPointWarnings(frame.PointWarnings);
            foreach (var warning in frame.PointWarnings)
            {
                if (!ShouldLogPointWarning(warning, out var suppressedPointWarningLogs))
                {
                    continue;
                }

                _logger.LogWarning(
                    "PLC point validation: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}, SuppressedPointWarningLogs={SuppressedPointWarningLogs}, Warning={Warning}",
                    _options.SourceId,
                    session.Generation,
                    cycleSequence,
                    "ValidatePoint",
                    "D51/D52",
                    2,
                    0,
                    "unknown",
                    "OUT_OF_RANGE",
                    0,
                    suppressedPointWarningLogs,
                    warning);
            }

            await _publisher.BroadcastAsync(envelope, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            if (ioGateHeld)
            {
                session!.IoGate.Release();
                ioGateHeld = false;
            }

            if (session is not null)
            {
                RetireSession(session, "collector cancelled");
            }

            throw;
        }
        catch (Exception exception)
        {
            if (ioGateHeld)
            {
                session!.IoGate.Release();
                ioGateHeld = false;
            }

            if (session is not null)
            {
                RetireSession(session, exception.Message);
            }
            else
            {
                RetireCurrentSession(exception.Message);
            }

            await RecordFailureAsync(
                exception,
                session?.Generation ?? 0,
                cycleSequence,
                cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            if (ioGateHeld)
            {
                session!.IoGate.Release();
            }

            _cycleGate.Release();
        }
    }

    public TimeSpan GetNextDelay()
    {
        return ConsecutiveFailures switch
        {
            <= 0 => TimeSpan.FromMilliseconds(_options.PollIntervalMs),
            1 => TimeSpan.FromSeconds(1),
            2 => TimeSpan.FromSeconds(2),
            3 => TimeSpan.FromSeconds(5),
            4 => TimeSpan.FromSeconds(10),
            _ => TimeSpan.FromSeconds(15),
        };
    }

    public ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return ValueTask.CompletedTask;
        }

        RetireCurrentSession("collector disposed");
        _cycleGate.Dispose();
        return ValueTask.CompletedTask;
    }

    private MitsubishiPlcSession GetOrCreateSession()
    {
        lock (_sessionSync)
        {
            if (_session is not null)
            {
                return _session;
            }

            var generation = Interlocked.Increment(ref _nextGeneration);
            var transport = _transportFactory.Create(_options);
            _session = new MitsubishiPlcSession(generation, transport);
            return _session;
        }
    }

    private async Task ConnectAsync(
        MitsubishiPlcSession session,
        long cycleSequence,
        CancellationToken cancellationToken)
    {
        const string operation = "ConnectServer";
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var result = await PlcHardTimeout.RunAsync(
                operation,
                _options.IpAddress,
                0,
                _options.ConnectTimeoutMs,
                session.Transport.ConnectServer,
                cancellationToken).ConfigureAwait(false);

            if (!result.IsSuccess)
            {
                throw new PlcCommunicationException(
                    $"PLC 连接失败：{result.Message}",
                    operation,
                    _options.IpAddress,
                    0,
                    FormatHslErrorCode(result.ErrorCode));
            }

            if (!IsCurrent(session))
            {
                throw new PlcCommunicationException(
                    $"PLC 连接代 {session.Generation} 已废弃。",
                    operation,
                    _options.IpAddress,
                    0,
                    "RETIRED_GENERATION");
            }

            session.Connected = true;
            _logger.LogInformation(
                "READ-ONLY PLC connection established: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}, Port={Port}, Protocol={Protocol}",
                _options.SourceId,
                session.Generation,
                cycleSequence,
                operation,
                _options.IpAddress,
                0,
                stopwatch.ElapsedMilliseconds,
                ConsecutiveFailures > 0 ? "reconnected" : "connected",
                "none",
                ConsecutiveFailures,
                _options.Port,
                "MC-A1E-Binary");
        }
        catch (Exception exception)
        {
            _logger.LogDebug(
                exception,
                "PLC connection operation failed: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}",
                _options.SourceId,
                session.Generation,
                cycleSequence,
                operation,
                _options.IpAddress,
                0,
                stopwatch.ElapsedMilliseconds,
                "failure",
                GetErrorCode(exception),
                ConsecutiveFailures);
            throw;
        }
    }

    private async Task RecordFailureAsync(
        Exception exception,
        long connectionGeneration,
        long cycleSequence,
        CancellationToken cancellationToken)
    {
        var failures = Interlocked.Increment(ref _consecutiveFailures);
        var markDisconnected = failures >= _options.FailuresBeforeDisconnect;
        var (envelope, changed) = _stateCache.RecordFailure(exception.Message, failures, markDisconnected);
        var operation = exception is PlcCommunicationException plcException
            ? plcException.Operation
            : "CollectFrame";
        var address = exception is PlcCommunicationException addressException
            ? addressException.Address ?? "main-frame"
            : "main-frame";
        var length = exception is PlcCommunicationException lengthException
            ? lengthException.Length ?? 0
            : 0;
        var errorCode = GetErrorCode(exception);
        var signature = $"{operation}|{address}|{length}|{errorCode}";
        var shouldLog = ShouldLogFailure(signature, changed || failures == 1, out var suppressedFailureLogs);

        if (shouldLog)
        {
            _logger.LogWarning(
                exception,
                changed
                    ? "READ-ONLY PLC source disconnected: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}, SuppressedFailureLogs={SuppressedFailureLogs}"
                    : "PLC read cycle failed: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}, SuppressedFailureLogs={SuppressedFailureLogs}",
                _options.SourceId,
                connectionGeneration,
                cycleSequence,
                operation,
                address,
                length,
                exception is PlcHardTimeoutException hardTimeout ? hardTimeout.TimeoutMs : 0,
                changed ? "disconnected" : "failure",
                errorCode,
                failures,
                suppressedFailureLogs);
        }

        if (changed)
        {
            await _publisher.BroadcastAsync(envelope, cancellationToken).ConfigureAwait(false);
        }
    }

    private bool ShouldLogFailure(string signature, bool force, out int suppressedFailureLogs)
    {
        lock (_failureLogSync)
        {
            var now = _clock.UtcNow;
            var signatureChanged = !string.Equals(_lastFailureSignature, signature, StringComparison.Ordinal);
            var repeatIntervalElapsed = _lastFailureLogAt is null
                || now - _lastFailureLogAt.Value >= RepeatedFailureLogInterval;

            if (force || signatureChanged || repeatIntervalElapsed)
            {
                suppressedFailureLogs = _suppressedFailureLogs;
                _suppressedFailureLogs = 0;
                _lastFailureSignature = signature;
                _lastFailureLogAt = now;
                return true;
            }

            _suppressedFailureLogs += 1;
            suppressedFailureLogs = 0;
            return false;
        }
    }

    private int ResetFailureLogThrottle()
    {
        lock (_failureLogSync)
        {
            var suppressedFailureLogs = _suppressedFailureLogs;
            _suppressedFailureLogs = 0;
            _lastFailureSignature = null;
            _lastFailureLogAt = null;
            return suppressedFailureLogs;
        }
    }

    private bool ShouldLogPointWarning(string warning, out int suppressedPointWarningLogs)
    {
        lock (_pointWarningLogSync)
        {
            var now = _clock.UtcNow;
            if (!_pointWarningLogStates.TryGetValue(warning, out var state))
            {
                _pointWarningLogStates[warning] = new RepeatedLogState(now, Suppressed: 0);
                suppressedPointWarningLogs = 0;
                return true;
            }

            if (now - state.LastLoggedAt >= RepeatedFailureLogInterval)
            {
                suppressedPointWarningLogs = state.Suppressed;
                _pointWarningLogStates[warning] = new RepeatedLogState(now, Suppressed: 0);
                return true;
            }

            _pointWarningLogStates[warning] = state with { Suppressed = state.Suppressed + 1 };
            suppressedPointWarningLogs = 0;
            return false;
        }
    }

    private void PruneResolvedPointWarnings(IReadOnlyList<string> activeWarnings)
    {
        lock (_pointWarningLogSync)
        {
            if (_pointWarningLogStates.Count == 0)
            {
                return;
            }

            var active = new HashSet<string>(activeWarnings, StringComparer.Ordinal);
            foreach (var warning in _pointWarningLogStates.Keys.Where(key => !active.Contains(key)).ToArray())
            {
                _pointWarningLogStates.Remove(warning);
            }
        }
    }

    private static string FormatHslErrorCode(int? errorCode)
        => errorCode is null ? "HSL_FAILURE" : $"HSL_{errorCode.Value}";

    private static string GetErrorCode(Exception exception)
        => exception is PlcCommunicationException plcException
            ? plcException.ErrorCode
            : exception.GetType().Name;

    private sealed record RepeatedLogState(DateTimeOffset LastLoggedAt, int Suppressed);

    private bool IsCurrent(MitsubishiPlcSession session)
    {
        lock (_sessionSync)
        {
            return ReferenceEquals(_session, session);
        }
    }

    private void RetireCurrentSession(string reason)
    {
        MitsubishiPlcSession? session;
        lock (_sessionSync)
        {
            session = _session;
            _session = null;
        }

        if (session is not null)
        {
            QueueCleanup(session, reason);
        }
    }

    private void RetireSession(MitsubishiPlcSession session, string reason)
    {
        var removed = false;
        lock (_sessionSync)
        {
            if (ReferenceEquals(_session, session))
            {
                _session = null;
                removed = true;
            }
        }

        if (removed)
        {
            QueueCleanup(session, reason);
        }
    }

    private void QueueCleanup(MitsubishiPlcSession session, string reason)
    {
        _logger.LogDebug(
            "Retiring PLC generation {Generation}: {Reason}",
            session.Generation,
            reason);

        _ = Task.Run(() =>
        {
            try
            {
                session.Transport.Abort();
            }
            catch (Exception exception)
            {
                _logger.LogDebug(exception, "PLC generation {Generation} abort failed", session.Generation);
            }

            try
            {
                session.Transport.ConnectClose();
            }
            catch (Exception exception)
            {
                _logger.LogDebug(exception, "PLC generation {Generation} close failed", session.Generation);
            }

            try
            {
                session.Dispose();
            }
            catch (Exception exception)
            {
                _logger.LogDebug(exception, "PLC generation {Generation} dispose failed", session.Generation);
            }
        });
    }

    private sealed class MitsubishiPlcSession : IDisposable
    {
        public MitsubishiPlcSession(long generation, IMitsubishiPlcTransport transport)
        {
            Generation = generation;
            Transport = transport;
        }

        public long Generation { get; }
        public IMitsubishiPlcTransport Transport { get; }
        public SemaphoreSlim IoGate { get; } = new(1, 1);
        public bool Connected { get; set; }

        public void Dispose()
        {
            Transport.Dispose();
            IoGate.Dispose();
        }
    }
}
