using ScadaHub.Configuration;

namespace ScadaHub.Adapters.Mitsubishi;

public interface IMitsubishiPlcTransport : IDisposable
{
    int ReceiveTimeout { get; set; }
    int ConnectTimeout { get; set; }

    PlcOperationResult ConnectServer();
    PlcOperationResult ConnectClose();
    void Abort();
    PlcReadResult<bool[]> ReadBool(string address, ushort length);
    PlcReadResult<ushort[]> ReadUInt16(string address, ushort length);
}

public interface IMitsubishiPlcTransportFactory
{
    IMitsubishiPlcTransport Create(PureWaterPlcOptions options);
}
