namespace ScadaHub.Adapters.Mitsubishi;

public class PlcCommunicationException : Exception
{
    public PlcCommunicationException(
        string message,
        string operation = "unknown",
        string? address = null,
        ushort? length = null,
        string? errorCode = null,
        Exception? innerException = null)
        : base(message, innerException)
    {
        Operation = operation;
        Address = address;
        Length = length;
        ErrorCode = errorCode ?? "COMMUNICATION_FAILURE";
    }

    public string Operation { get; }
    public string? Address { get; }
    public ushort? Length { get; }
    public string ErrorCode { get; }
}

public sealed class PlcHardTimeoutException : PlcCommunicationException
{
    public PlcHardTimeoutException(
        string operation,
        int timeoutMs,
        string? address = null,
        ushort? length = null)
        : base(
            $"PLC 操作 {operation} 超过硬截止时间 {timeoutMs}ms。",
            operation,
            address,
            length,
            "HARD_TIMEOUT")
    {
        TimeoutMs = timeoutMs;
    }

    public int TimeoutMs { get; }
}
