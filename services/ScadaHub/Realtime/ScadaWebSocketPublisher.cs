using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using ScadaHub.State;

namespace ScadaHub.Realtime;

/// <summary>
/// 采集与 WebSocket 分发解耦（SPEC 12.1）：
/// - BroadcastAsync 只做"序列化一次 + 入队"，不等待任何网络发送——采集永不被慢客户端阻塞；
/// - 每客户端独立有界发送队列（64 条或 1MiB，先到为准），发送超时 5s；
/// - 可合并消息（m100.snapshot / purewater.plc.snapshot / hub.heartbeat）按
///   sourceId+messageType 只保留最新；source.status 等不可静默丢弃；
/// - 不可合并消息无法入队时以 WebSocket 1013 关闭慢客户端使其重连回放；
/// - 初始回放与广播在同一 registry 锁内完成注册与入队（锁内不做网络 IO）；
/// - 最大客户端数 8，超出拒绝。
/// </summary>
public sealed class ScadaWebSocketPublisher : IScadaRealtimePublisher, IAsyncDisposable
{
    private const int MaxQueuedMessages = 64;
    private const int MaxQueuedBytes = 1024 * 1024;
    private static readonly TimeSpan SendTimeout = TimeSpan.FromSeconds(5);
    private const int MaxClients = 8;

    private static readonly HashSet<string> MergeableMessageTypes = new(StringComparer.Ordinal)
    {
        "m100.snapshot",
        "purewater.plc.snapshot",
        "hub.heartbeat",
    };

    private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
    private readonly PureWaterPlcStateCache _stateCache;
    private readonly M100StateCache _m100StateCache;
    private readonly ILogger<ScadaWebSocketPublisher> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly object _registryLock = new();

    public ScadaWebSocketPublisher(
        PureWaterPlcStateCache stateCache,
        M100StateCache m100StateCache,
        ILogger<ScadaWebSocketPublisher> logger)
    {
        _stateCache = stateCache;
        _m100StateCache = m100StateCache;
        _logger = logger;
    }

    public Task BroadcastAsync(object message, CancellationToken cancellationToken)
    {
        if (message is null) return Task.CompletedTask;
        var frame = new QueueFrame(
            message.GetType(),
            JsonSerializer.SerializeToUtf8Bytes(message, message.GetType(), _jsonOptions),
            MergeKeyOf(message));

        foreach (var pair in _clients.ToArray())
        {
            pair.Value.EnqueueOrClose(frame);
        }

        return Task.CompletedTask;
    }

    public async Task HandleClientAsync(HttpContext context, CancellationToken cancellationToken)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        if (!OriginIsAllowed(context.Request.Headers.Origin.ToString()))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        // SPEC 12.1：客户端上限。
        if (_clients.Count >= MaxClients)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            return;
        }

        using var socket = await context.WebSockets.AcceptWebSocketAsync().ConfigureAwait(false);
        var clientId = Guid.NewGuid();
        var connection = new ClientConnection(socket, _logger);
        var drainTask = Task.CompletedTask;

        // SPEC 8.4：RegisterAndReplay —— 在 registry 锁内注册并完成初始回放入队，
        // 与 BroadcastAsync 的遍历互斥，保证回放与后续广播顺序一致（锁内无网络 IO）。
        lock (_registryLock)
        {
            if (_clients.Count >= MaxClients)
            {
                connection.Dispose();
                return;
            }

            _clients[clientId] = connection;
            connection.EnqueueOrClose(new QueueFrame(
                typeof(Contracts.ScadaEnvelope<Contracts.PureWaterPlcTelemetry>),
                JsonSerializer.SerializeToUtf8Bytes(_stateCache.GetSnapshotEnvelope(), _jsonOptions),
                "purewater-plc-01|purewater.plc.snapshot"));
            foreach (var m100Envelope in _m100StateCache.GetAllSnapshotEnvelopes())
            {
                connection.EnqueueOrClose(new QueueFrame(
                    m100Envelope.GetType(),
                    JsonSerializer.SerializeToUtf8Bytes(m100Envelope, m100Envelope.GetType(), _jsonOptions),
                    $"{m100Envelope.SourceId}|{m100Envelope.MessageType}"));
            }
        }

        try
        {
            drainTask = connection.RunDrainLoopAsync(cancellationToken);
            await ReceiveUntilClosedAsync(socket, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            RemoveClient(clientId, connection, "client closed");
            try
            {
                await drainTask.ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
            }
        }
    }

    private static string? MergeKeyOf(object message) => message switch
    {
        Contracts.ScadaEnvelope<Contracts.M100Telemetry> m100 => $"{m100.SourceId}|{m100.MessageType}",
        Contracts.ScadaEnvelope<Contracts.PureWaterPlcTelemetry> pure => $"{pure.SourceId}|{pure.MessageType}",
        Contracts.ScadaEnvelope<Adapters.M100.HubHeartbeatPayload> heartbeat => $"{heartbeat.SourceId}|{heartbeat.MessageType}",
        // 未知消息类型保守处理为不可合并（慢客户端满队列时 1013，绝不静默丢弃）。
        _ => null,
    };

    private sealed record QueueFrame(Type MessageType, byte[] Payload, string? MergeKey)
    {
        public int Size => Payload.Length;
    }

    public async ValueTask DisposeAsync()
    {
        var clients = _clients.ToArray();
        _clients.Clear();
        foreach (var pair in clients)
        {
            await pair.Value.DisposeAsync().ConfigureAwait(false);
        }
    }

    private static bool OriginIsAllowed(string origin)
    {
        if (string.IsNullOrWhiteSpace(origin) || string.Equals(origin, "null", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return Uri.TryCreate(origin, UriKind.Absolute, out var uri)
            && uri.Scheme is "http" or "https"
            && (uri.IsLoopback || string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase));
    }

    private static async Task ReceiveUntilClosedAsync(WebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[1024];
        while (socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            var result = await socket.ReceiveAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await socket.CloseOutputAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "closed",
                    CancellationToken.None).ConfigureAwait(false);
                return;
            }

            await socket.CloseOutputAsync(
                WebSocketCloseStatus.PolicyViolation,
                "SCADA Hub 第一阶段为只读通道，不接受客户端命令。",
                CancellationToken.None).ConfigureAwait(false);
            return;
        }
    }

    private void RemoveClient(Guid clientId, ClientConnection connection, string reason)
    {
        if (_clients.TryRemove(clientId, out _))
        {
            _logger.LogDebug("WebSocket client {ClientId} removed: {Reason}", clientId, reason);
        }

        connection.Dispose();
    }

    private sealed class ClientConnection : IDisposable, IAsyncDisposable
    {
        private readonly WebSocket _socket;
        private readonly ILogger<ScadaWebSocketPublisher> _logger;
        private readonly object _mailboxLock = new();
        private readonly List<QueueFrame> _mailbox = new();
        private readonly SemaphoreSlim _signal = new(0);
        private int _disposed;
        private bool _closeSlowClient;

        public ClientConnection(WebSocket socket, ILogger<ScadaWebSocketPublisher> logger)
        {
            _socket = socket;
            _logger = logger;
        }

        /// <summary>入队（可合并替换旧帧；满且不可合并 -> 标记 1013 关闭）。</summary>
        public void EnqueueOrClose(QueueFrame frame)
        {
            lock (_mailboxLock)
            {
                if (Volatile.Read(ref _disposed) != 0) return;

                if (frame.MergeKey is not null)
                {
                    _mailbox.RemoveAll(existing => existing.MergeKey == frame.MergeKey);
                }

                var totalBytes = _mailbox.Sum(existing => existing.Size) + frame.Size;
                if (_mailbox.Count >= MaxQueuedMessages || totalBytes > MaxQueuedBytes)
                {
                    if (frame.MergeKey is null)
                    {
                        // SPEC 12.1：source.status 等不可静默丢弃 -> 1013 让客户端重连回放。
                        _closeSlowClient = true;
                        _mailbox.Clear();
                    }
                    // 可合并消息超出界限时丢弃本帧（旧帧仍在，最新值在下一周期重发）。
                }
                else
                {
                    _mailbox.Add(frame);
                }
            }

            if (_signal.CurrentCount == 0)
            {
                _signal.Release();
            }
        }

        public async Task RunDrainLoopAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && Volatile.Read(ref _disposed) == 0)
            {
                await _signal.WaitAsync(cancellationToken).ConfigureAwait(false);

                List<QueueFrame> pending;
                bool closeSlow;
                lock (_mailboxLock)
                {
                    pending = new List<QueueFrame>(_mailbox);
                    _mailbox.Clear();
                    closeSlow = _closeSlowClient;
                    _closeSlowClient = false;
                }

                if (closeSlow)
                {
                    await CloseAsync(WebSocketCloseStatus.MessageTooBig,
                        "slow client: bounded queue overflow (1013 semantics)",
                        CancellationToken.None).ConfigureAwait(false);
                    return;
                }

                foreach (var frame in pending)
                {
                    if (_socket.State != WebSocketState.Open) return;
                    using var timeout = new CancellationTokenSource(SendTimeout);
                    try
                    {
                        await _socket.SendAsync(
                            frame.Payload,
                            WebSocketMessageType.Text,
                            endOfMessage: true,
                            timeout.Token).ConfigureAwait(false);
                    }
                    catch (Exception exception) when (
                        exception is WebSocketException
                            or OperationCanceledException
                            or ObjectDisposedException)
                    {
                        _logger.LogDebug("WebSocket send failed, dropping client: {Message}", exception.Message);
                        Dispose();
                        return;
                    }
                }
            }
        }

        private async Task CloseAsync(WebSocketCloseStatus status, string reason, CancellationToken cancellationToken)
        {
            if (_socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
            {
                try
                {
                    await _socket.CloseOutputAsync(status, reason, cancellationToken).ConfigureAwait(false);
                }
                catch (Exception exception) when (exception is WebSocketException or ObjectDisposedException)
                {
                }
            }

            Dispose();
        }

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0)
            {
                return;
            }

            _socket.Abort();
            _signal.Dispose();
        }

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
