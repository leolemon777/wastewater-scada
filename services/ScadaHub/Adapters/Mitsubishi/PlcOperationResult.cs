namespace ScadaHub.Adapters.Mitsubishi;

public readonly record struct PlcOperationResult(bool IsSuccess, string Message, int? ErrorCode = null)
{
    public static PlcOperationResult Success() => new(true, string.Empty);
    public static PlcOperationResult Failure(string message, int? errorCode = null)
        => new(false, message, errorCode);
}

public sealed record PlcReadResult<T>(bool IsSuccess, T? Content, string Message, int? ErrorCode = null)
{
    public static PlcReadResult<T> Success(T content) => new(true, content, string.Empty);
    public static PlcReadResult<T> Failure(string message, int? errorCode = null)
        => new(false, default, message, errorCode);
}
