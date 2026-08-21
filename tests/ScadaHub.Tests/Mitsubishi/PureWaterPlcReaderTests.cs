using System.Diagnostics;
using ScadaHub.Adapters.Mitsubishi;
using ScadaHub.Tests.Fakes;

namespace ScadaHub.Tests.Mitsubishi;

public sealed class PureWaterPlcReaderTests
{
    [Fact]
    public async Task CompleteFrame_MapsReviewedBitsAndWords()
    {
        var transport = new FakeMitsubishiPlcTransport { D51 = 64, D52 = 58, D90 = 5 };
        var frame = await new PureWaterPlcReader().ReadMainFrameAsync(
            transport,
            operationTimeoutMs: 1000,
            CancellationToken.None);

        Assert.True(frame.Bits["X000"]);
        Assert.True(frame.Bits["X010"]);
        Assert.True(frame.Bits["Y002"]);
        Assert.True(frame.Bits["Y012"]);
        Assert.True(frame.Bits["M400"]);
        Assert.True(frame.Bits["M412"]);
        Assert.True(frame.Bits["M500"]);
        Assert.True(frame.Bits["M510"]);
        Assert.True(frame.Bits["M516"]);
        Assert.False(frame.Bits.ContainsKey("M503"));
        Assert.Equal(64, frame.Words["D51"]);
        Assert.Equal(58, frame.Words["D52"]);
        Assert.Equal(5, frame.Words["D90"]);
        Assert.Equal(64, frame.RawWords["D51"]);
        Assert.Equal(58, frame.RawWords["D52"]);
        Assert.Equal(5, frame.RawWords["D90"]);
        Assert.Empty(frame.PointWarnings);
    }

    [Fact]
    public async Task MainFrame_EmitsStructuredOperationDiagnosticsAtDebugLevel()
    {
        var transport = new FakeMitsubishiPlcTransport();
        var logger = new CapturingLogger<PureWaterPlcReader>();
        var context = new PlcReadContext(
            "purewater-plc-01",
            ConnectionGeneration: 7,
            CycleSequence: 12,
            ConsecutiveFailures: 1);

        await new PureWaterPlcReader(logger).ReadMainFrameAsync(
            transport,
            operationTimeoutMs: 1000,
            context,
            CancellationToken.None);

        var operations = logger.Entries
            .Where(entry => entry.Level == Microsoft.Extensions.Logging.LogLevel.Debug)
            .ToArray();
        Assert.Equal(6, operations.Length);

        var xRead = Assert.Single(operations, entry => Equals(entry.Properties["Address"], "X0"));
        Assert.Equal("purewater-plc-01", xRead.Properties["SourceId"]);
        Assert.Equal(7L, xRead.Properties["ConnectionGeneration"]);
        Assert.Equal(12L, xRead.Properties["CycleSequence"]);
        Assert.Equal("ReadBool", xRead.Properties["Operation"]);
        Assert.Equal((ushort)24, xRead.Properties["Length"]);
        Assert.Equal("success", xRead.Properties["Result"]);
        Assert.Equal("none", xRead.Properties["ErrorCode"]);
        Assert.Equal(1, xRead.Properties["ConsecutiveFailures"]);
        Assert.True(Convert.ToInt64(xRead.Properties["DurationMs"]) >= 0);
    }

    [Fact]
    public async Task OutOfRangeLevels_AreUnknownInsteadOfClampedHealthy()
    {
        var transport = new FakeMitsubishiPlcTransport { D51 = 101, D52 = ushort.MaxValue };
        var frame = await new PureWaterPlcReader().ReadMainFrameAsync(
            transport,
            operationTimeoutMs: 1000,
            CancellationToken.None);

        Assert.Null(frame.Words["D51"]);
        Assert.Null(frame.Words["D52"]);
        Assert.Equal(101, frame.RawWords["D51"]);
        Assert.Equal(ushort.MaxValue, frame.RawWords["D52"]);
        Assert.Equal(2, frame.PointWarnings.Count);
    }

    [Fact]
    public async Task ShortRequiredPayload_RejectsWholeFrame()
    {
        var transport = new FakeMitsubishiPlcTransport { ReturnShortXPayload = true };

        var exception = await Assert.ThrowsAsync<PlcCommunicationException>(() =>
            new PureWaterPlcReader().ReadMainFrameAsync(
                transport,
                operationTimeoutMs: 1000,
                CancellationToken.None));

        Assert.Contains("长度异常", exception.Message);
    }

    [Fact]
    public async Task BlockedRead_IsCutOffByApplicationHardTimeout()
    {
        var transport = new FakeMitsubishiPlcTransport { BlockingBoolAddress = "X0" };
        var stopwatch = Stopwatch.StartNew();

        await Assert.ThrowsAsync<PlcHardTimeoutException>(() =>
            new PureWaterPlcReader().ReadMainFrameAsync(
                transport,
                operationTimeoutMs: 100,
                CancellationToken.None));

        stopwatch.Stop();
        transport.ReleaseBlockedRead();
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(1));
    }
}
