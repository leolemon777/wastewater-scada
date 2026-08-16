using HslCommunication.Profinet.Melsec;
using ScadaHub.Configuration;

namespace ScadaHub.Adapters.Mitsubishi;

public sealed class HslMitsubishiPlcTransportFactory : IMitsubishiPlcTransportFactory
{
    public IMitsubishiPlcTransport Create(PureWaterPlcOptions options)
    {
        return new HslMitsubishiPlcTransport(options.IpAddress, options.Port)
        {
            ConnectTimeout = options.ConnectTimeoutMs,
            ReceiveTimeout = options.ReceiveTimeoutMs,
        };
    }
}

public sealed class HslMitsubishiPlcTransport : IMitsubishiPlcTransport
{
    private readonly MelsecA1ENet _client;
    private int _disposed;

    public HslMitsubishiPlcTransport(string ipAddress, int port)
    {
        _client = new MelsecA1ENet(ipAddress, port);
    }

    public int ReceiveTimeout
    {
        get => _client.ReceiveTimeOut;
        set => _client.ReceiveTimeOut = value;
    }

    public int ConnectTimeout
    {
        get => _client.ConnectTimeOut;
        set => _client.ConnectTimeOut = value;
    }

    public PlcOperationResult ConnectServer()
    {
        var result = _client.ConnectServer();
        return result.IsSuccess
            ? PlcOperationResult.Success()
            : PlcOperationResult.Failure(result.Message, result.ErrorCode);
    }

    public PlcOperationResult ConnectClose()
    {
        var result = _client.ConnectClose();
        return result.IsSuccess
            ? PlcOperationResult.Success()
            : PlcOperationResult.Failure(result.Message, result.ErrorCode);
    }

    public void Abort()
    {
        _client.CommunicationPipe?.CloseCommunication();
    }

    public PlcReadResult<bool[]> ReadBool(string address, ushort length)
    {
        var result = _client.ReadBool(address, length);
        return result.IsSuccess
            ? PlcReadResult<bool[]>.Success(result.Content)
            : PlcReadResult<bool[]>.Failure(result.Message, result.ErrorCode);
    }

    public PlcReadResult<ushort[]> ReadUInt16(string address, ushort length)
    {
        var result = _client.ReadUInt16(address, length);
        return result.IsSuccess
            ? PlcReadResult<ushort[]>.Success(result.Content)
            : PlcReadResult<ushort[]>.Failure(result.Message, result.ErrorCode);
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        _client.ConnectClose();
    }
}
