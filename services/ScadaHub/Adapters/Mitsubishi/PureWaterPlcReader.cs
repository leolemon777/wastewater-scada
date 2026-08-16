using System.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using ScadaHub.Contracts;

namespace ScadaHub.Adapters.Mitsubishi;

public sealed class PureWaterPlcReader
{
    private readonly ILogger<PureWaterPlcReader> _logger;

    public PureWaterPlcReader(ILogger<PureWaterPlcReader>? logger = null)
    {
        _logger = logger ?? NullLogger<PureWaterPlcReader>.Instance;
    }

    public async Task<PureWaterPlcFrame> ReadMainFrameAsync(
        IMitsubishiPlcTransport transport,
        int operationTimeoutMs,
        CancellationToken cancellationToken)
        => await ReadMainFrameAsync(
            transport,
            operationTimeoutMs,
            PlcReadContext.Unspecified,
            cancellationToken).ConfigureAwait(false);

    public async Task<PureWaterPlcFrame> ReadMainFrameAsync(
        IMitsubishiPlcTransport transport,
        int operationTimeoutMs,
        PlcReadContext context,
        CancellationToken cancellationToken)
    {
        var x = await ReadBoolAsync(transport, "X0", 24, operationTimeoutMs, context, cancellationToken).ConfigureAwait(false);
        var y = await ReadBoolAsync(transport, "Y0", 24, operationTimeoutMs, context, cancellationToken).ConfigureAwait(false);
        var alarms = await ReadBoolAsync(transport, "M400", 16, operationTimeoutMs, context, cancellationToken).ConfigureAwait(false);
        var modes = await ReadBoolAsync(transport, "M500", 18, operationTimeoutMs, context, cancellationToken).ConfigureAwait(false);
        var levels = await ReadUInt16Async(transport, "D51", 2, operationTimeoutMs, context, cancellationToken).ConfigureAwait(false);
        var alarmWord = await ReadUInt16Async(transport, "D90", 1, operationTimeoutMs, context, cancellationToken).ConfigureAwait(false);

        var bits = new Dictionary<string, bool?>(StringComparer.OrdinalIgnoreCase);
        AddBits(bits, PureWaterPlcPointMap.InputAddresses, x);
        AddBits(bits, PureWaterPlcPointMap.OutputAddresses, y);
        AddBits(bits, PureWaterPlcPointMap.AlarmAddresses, alarms);

        for (var index = 0; index < modes.Length; index++)
        {
            var address = $"M{500 + index}";
            if (PureWaterPlcPointMap.PublishedModeAddresses.Contains(address))
            {
                bits[address] = modes[index];
            }
        }

        var warnings = new List<string>();
        var words = new Dictionary<string, int?>(StringComparer.OrdinalIgnoreCase)
        {
            ["D51"] = NormalizePercent("D51", levels[0], warnings),
            ["D52"] = NormalizePercent("D52", levels[1], warnings),
            ["D90"] = alarmWord[0],
        };
        var rawWords = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["D51"] = levels[0],
            ["D52"] = levels[1],
            ["D90"] = alarmWord[0],
        };

        return new PureWaterPlcFrame
        {
            Bits = bits,
            Words = words,
            RawWords = rawWords,
            PointWarnings = warnings,
        };
    }

    private async Task<bool[]> ReadBoolAsync(
        IMitsubishiPlcTransport transport,
        string address,
        ushort length,
        int operationTimeoutMs,
        PlcReadContext context,
        CancellationToken cancellationToken)
    {
        const string operation = "ReadBool";
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var result = await PlcHardTimeout.RunAsync(
                operation,
                address,
                length,
                operationTimeoutMs,
                () => transport.ReadBool(address, length),
                cancellationToken).ConfigureAwait(false);

            if (!result.IsSuccess)
            {
                throw new PlcCommunicationException(
                    $"读取 {address} 失败：{result.Message}",
                    operation,
                    address,
                    length,
                    FormatHslErrorCode(result.ErrorCode));
            }

            if (result.Content is null || result.Content.Length != length)
            {
                throw new PlcCommunicationException(
                    $"读取 {address} 返回长度异常，期望 {length}，实际 {result.Content?.Length ?? 0}。",
                    operation,
                    address,
                    length,
                    "PAYLOAD_LENGTH");
            }

            LogOperation(context, operation, address, length, stopwatch.ElapsedMilliseconds, "success", "none");
            return result.Content;
        }
        catch (Exception exception)
        {
            LogOperation(
                context,
                operation,
                address,
                length,
                stopwatch.ElapsedMilliseconds,
                "failure",
                GetErrorCode(exception));
            throw;
        }
    }

    private async Task<ushort[]> ReadUInt16Async(
        IMitsubishiPlcTransport transport,
        string address,
        ushort length,
        int operationTimeoutMs,
        PlcReadContext context,
        CancellationToken cancellationToken)
    {
        const string operation = "ReadUInt16";
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var result = await PlcHardTimeout.RunAsync(
                operation,
                address,
                length,
                operationTimeoutMs,
                () => transport.ReadUInt16(address, length),
                cancellationToken).ConfigureAwait(false);

            if (!result.IsSuccess)
            {
                throw new PlcCommunicationException(
                    $"读取 {address} 失败：{result.Message}",
                    operation,
                    address,
                    length,
                    FormatHslErrorCode(result.ErrorCode));
            }

            if (result.Content is null || result.Content.Length != length)
            {
                throw new PlcCommunicationException(
                    $"读取 {address} 返回长度异常，期望 {length}，实际 {result.Content?.Length ?? 0}。",
                    operation,
                    address,
                    length,
                    "PAYLOAD_LENGTH");
            }

            LogOperation(context, operation, address, length, stopwatch.ElapsedMilliseconds, "success", "none");
            return result.Content;
        }
        catch (Exception exception)
        {
            LogOperation(
                context,
                operation,
                address,
                length,
                stopwatch.ElapsedMilliseconds,
                "failure",
                GetErrorCode(exception));
            throw;
        }
    }

    private void LogOperation(
        PlcReadContext context,
        string operation,
        string address,
        ushort length,
        long durationMs,
        string result,
        string errorCode)
    {
        _logger.LogDebug(
            "PLC operation: SourceId={SourceId}, ConnectionGeneration={ConnectionGeneration}, CycleSequence={CycleSequence}, Operation={Operation}, Address={Address}, Length={Length}, DurationMs={DurationMs}, Result={Result}, ErrorCode={ErrorCode}, ConsecutiveFailures={ConsecutiveFailures}",
            context.SourceId,
            context.ConnectionGeneration,
            context.CycleSequence,
            operation,
            address,
            length,
            durationMs,
            result,
            errorCode,
            context.ConsecutiveFailures);
    }

    private static string FormatHslErrorCode(int? errorCode)
        => errorCode is null ? "HSL_FAILURE" : $"HSL_{errorCode.Value}";

    private static string GetErrorCode(Exception exception)
        => exception is PlcCommunicationException plcException
            ? plcException.ErrorCode
            : exception.GetType().Name;

    private static void AddBits(
        IDictionary<string, bool?> target,
        IReadOnlyList<string> addresses,
        IReadOnlyList<bool> values)
    {
        for (var index = 0; index < addresses.Count; index++)
        {
            target[addresses[index]] = values[index];
        }
    }

    private static int? NormalizePercent(string address, ushort value, ICollection<string> warnings)
    {
        if (value <= 100)
        {
            return value;
        }

        warnings.Add($"{address} 液位值 {value} 超出 0-100%，已标记为未知。");
        return null;
    }
}
