using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using ScadaHub.State;

namespace ScadaHub.Realtime;

public sealed class ScadaWebSocketPublisher : IScadaRealtimePublisher, IAsyncDisposable
{
    private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
    private readonly PureWaterPlcStateCache _stateCache;
    private readonly ILogger<ScadaWebSocketPublisher> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public ScadaWebSocketPublisher(
        PureWaterPlcStateCache stateCache,
        ILogger<ScadaWebSocketPublisher> logger)
    {
        _stateCache = stateCache;
        _logger = logger;
    }

    public async Task BroadcastAsync(object message, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(message, message.GetType(), _jsonOptions);
        foreach (var pair in _clients.ToArray())
        {
            try
            {
                await pair.Value.SendAsync(payload, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception) when (exception is WebSocketException or OperationCanceledException or ObjectDisposedException)
            {
                RemoveClient(pair.Key, pair.Value, exception.Message);
            }
        }
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

        using var socket = await context.WebSockets.AcceptWebSocketAsync().ConfigureAwait(false);
        var clientId = Guid.NewGuid();
        var connection = new ClientConnection(socket);
        _clients[clientId] = connection;

        try
        {
            var initial = _stateCache.GetSnapshotEnvelope();
            var initialPayload = JsonSerializer.SerializeToUtf8Bytes(initial, _jsonOptions);
            await connection.SendAsync(initialPayload, cancellationToken).ConfigureAwait(false);
            await ReceiveUntilClosedAsync(socket, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            RemoveClient(clientId, connection, "client closed");
        }
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
        private readonly SemaphoreSlim _sendGate = new(1, 1);
        private int _disposed;

        public ClientConnection(WebSocket socket)
        {
            _socket = socket;
        }

        public async Task SendAsync(byte[] payload, CancellationToken cancellationToken)
        {
            await _sendGate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                if (_socket.State == WebSocketState.Open)
                {
                    await _socket.SendAsync(
                        payload,
                        WebSocketMessageType.Text,
                        endOfMessage: true,
                        cancellationToken).ConfigureAwait(false);
                }
            }
            finally
            {
                _sendGate.Release();
            }
        }

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0)
            {
                return;
            }

            _socket.Abort();
            _sendGate.Dispose();
        }

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
