using System.Collections.Concurrent;
using ScadaHub.Adapters.Mitsubishi;
using ScadaHub.Configuration;

namespace ScadaHub.Tests.Fakes;

internal sealed class QueueMitsubishiPlcTransportFactory : IMitsubishiPlcTransportFactory
{
    private readonly ConcurrentQueue<IMitsubishiPlcTransport> _transports;

    public QueueMitsubishiPlcTransportFactory(params IMitsubishiPlcTransport[] transports)
    {
        _transports = new ConcurrentQueue<IMitsubishiPlcTransport>(transports);
    }

    public IMitsubishiPlcTransport Create(PureWaterPlcOptions options)
    {
        if (_transports.TryDequeue(out var transport))
        {
            return transport;
        }

        throw new InvalidOperationException("测试没有准备下一代 PLC transport。");
    }
}

internal sealed class FakeMitsubishiPlcTransport : IMitsubishiPlcTransport
{
    private readonly ManualResetEventSlim _blockedReadGate = new(initialState: false);
    private int _disposed;

    public PlcOperationResult ConnectResult { get; set; } = PlcOperationResult.Success();
    public string? FailingBoolAddress { get; set; }
    public string? FailingWordAddress { get; set; }
    public string? BlockingBoolAddress { get; set; }
    public bool ReturnShortXPayload { get; set; }
    public ushort D51 { get; set; } = 64;
    public ushort D52 { get; set; } = 58;
    public ushort D90 { get; set; }
    public int ReceiveTimeout { get; set; }
    public int ConnectTimeout { get; set; }
    public int AbortCount;
    public int CloseCount;
    public int ConnectCount;
    public int BoolReadCount;
    public int WordReadCount;
    public ManualResetEventSlim BlockedReadStarted { get; } = new(false);

    public void ReleaseBlockedRead() => _blockedReadGate.Set();

    public PlcOperationResult ConnectServer()
    {
        Interlocked.Increment(ref ConnectCount);
        return ConnectResult;
    }

    public PlcOperationResult ConnectClose()
    {
        Interlocked.Increment(ref CloseCount);
        return PlcOperationResult.Success();
    }

    public void Abort()
    {
        Interlocked.Increment(ref AbortCount);
    }

    public PlcReadResult<bool[]> ReadBool(string address, ushort length)
    {
        Interlocked.Increment(ref BoolReadCount);

        if (string.Equals(address, BlockingBoolAddress, StringComparison.OrdinalIgnoreCase))
        {
            BlockedReadStarted.Set();
            _blockedReadGate.Wait();
        }

        if (string.Equals(address, FailingBoolAddress, StringComparison.OrdinalIgnoreCase))
        {
            return PlcReadResult<bool[]>.Failure($"注入读取失败：{address}");
        }

        var actualLength = ReturnShortXPayload && string.Equals(address, "X0", StringComparison.OrdinalIgnoreCase)
            ? Math.Max(0, length - 1)
            : length;
        var values = new bool[actualLength];

        if (string.Equals(address, "X0", StringComparison.OrdinalIgnoreCase) && values.Length > 8)
        {
            values[0] = true;
            values[8] = true;
        }
        else if (string.Equals(address, "Y0", StringComparison.OrdinalIgnoreCase) && values.Length > 10)
        {
            values[2] = true;
            values[10] = true;
        }
        else if (string.Equals(address, "M400", StringComparison.OrdinalIgnoreCase) && values.Length > 12)
        {
            values[0] = true;
            values[12] = true;
        }
        else if (string.Equals(address, "M500", StringComparison.OrdinalIgnoreCase) && values.Length > 16)
        {
            values[0] = true;
            values[10] = true;
            values[16] = true;
        }

        return PlcReadResult<bool[]>.Success(values);
    }

    public PlcReadResult<ushort[]> ReadUInt16(string address, ushort length)
    {
        Interlocked.Increment(ref WordReadCount);
        if (string.Equals(address, FailingWordAddress, StringComparison.OrdinalIgnoreCase))
        {
            return PlcReadResult<ushort[]>.Failure($"注入读取失败：{address}");
        }

        if (string.Equals(address, "D51", StringComparison.OrdinalIgnoreCase))
        {
            return PlcReadResult<ushort[]>.Success(new[] { D51, D52 });
        }

        if (string.Equals(address, "D90", StringComparison.OrdinalIgnoreCase))
        {
            return PlcReadResult<ushort[]>.Success(new[] { D90 });
        }

        return PlcReadResult<ushort[]>.Success(new ushort[length]);
    }

    public void Dispose()
    {
        Interlocked.Exchange(ref _disposed, 1);
    }

    public bool IsDisposed => Volatile.Read(ref _disposed) != 0;
}
