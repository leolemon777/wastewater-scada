using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ScadaHub.Adapters.Mitsubishi;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.State;
using ScadaHub.Tests.Fakes;

namespace ScadaHub.Tests.Mitsubishi;

public sealed class PureWaterPlcCollectorTests
{
    private static readonly DateTimeOffset FrameTime = new(2026, 8, 12, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SuccessfulMainFrame_PublishesAndAdvancesSequence()
    {
        var transport = new FakeMitsubishiPlcTransport();
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(transport));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var snapshot = fixture.Cache.GetSnapshotEnvelope();
        Assert.True(snapshot.Payload.Connected);
        Assert.Equal(1, snapshot.Seq);
        Assert.Equal(FrameTime.ToUnixTimeMilliseconds(), snapshot.Payload.ReceivedAt);
        Assert.True(snapshot.Payload.Bits["Y002"]);
        Assert.Single(fixture.Publisher.Messages);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task ContinuousCollection_ReusesConnectionAndPublishesEveryCompleteFrame()
    {
        var transport = new FakeMitsubishiPlcTransport();
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(transport));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        transport.D51 = 72;
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var snapshot = fixture.Cache.GetSnapshotEnvelope();
        Assert.True(snapshot.Payload.Connected);
        Assert.Equal(2, snapshot.Payload.Sequence);
        Assert.Equal(72, snapshot.Payload.Words["D51"]);
        Assert.Equal(1, transport.ConnectCount);
        Assert.Equal(2, fixture.Publisher.Messages.Count);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task ConnectionRefusal_DoesNotReadOrPublishPartialData()
    {
        var transport = new FakeMitsubishiPlcTransport
        {
            ConnectResult = PlcOperationResult.Failure("connection refused"),
        };
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(transport));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var snapshot = fixture.Cache.GetSnapshotEnvelope();
        var status = fixture.Cache.GetStatus();
        Assert.False(snapshot.Payload.Connected);
        Assert.Equal(0, snapshot.Payload.Sequence);
        Assert.Null(snapshot.Payload.ReceivedAt);
        Assert.Equal(1, transport.ConnectCount);
        Assert.Equal(0, transport.BoolReadCount);
        Assert.Equal(0, transport.WordReadCount);
        Assert.Equal(1, status.ConsecutiveFailures);
        Assert.Empty(fixture.Publisher.Messages);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task TwoConnectionRefusals_PublishInitialDisconnectStatusOnce()
    {
        var first = new FakeMitsubishiPlcTransport
        {
            ConnectResult = PlcOperationResult.Failure("connection refused"),
        };
        var second = new FakeMitsubishiPlcTransport
        {
            ConnectResult = PlcOperationResult.Failure("connection refused"),
        };
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(first, second));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var message = Assert.Single(fixture.Publisher.Messages);
        var status = Assert.IsType<ScadaEnvelope<PureWaterSourceStatusEvent>>(message);
        Assert.False(status.Payload.Connected);
        Assert.Equal(0, status.Payload.Sequence);
        Assert.Equal(2, fixture.Cache.GetStatus().ConsecutiveFailures);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task SingleReadFailure_RecoversOnNextCompleteGeneration()
    {
        var dropped = new FakeMitsubishiPlcTransport { FailingBoolAddress = "X0" };
        var recovered = new FakeMitsubishiPlcTransport { D51 = 81, D52 = 49 };
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(dropped, recovered));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var snapshot = fixture.Cache.GetSnapshotEnvelope();
        Assert.True(snapshot.Payload.Connected);
        Assert.Equal(1, snapshot.Payload.Sequence);
        Assert.Equal(81, snapshot.Payload.Words["D51"]);
        Assert.Equal(0, fixture.Cache.GetStatus().ConsecutiveFailures);
        Assert.Single(fixture.Publisher.Messages);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task FailedPartialFrame_DoesNotAdvanceSequenceOrTimestamp()
    {
        var transport = new FakeMitsubishiPlcTransport { FailingBoolAddress = "M400" };
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(transport));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var snapshot = fixture.Cache.GetSnapshotEnvelope();
        Assert.Equal(0, snapshot.Seq);
        Assert.Null(snapshot.Payload.ReceivedAt);
        Assert.False(snapshot.Payload.Connected);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task TwoConsecutiveFailures_DisconnectAndPreserveLastSuccessfulFrame()
    {
        var first = new FakeMitsubishiPlcTransport();
        var second = new FakeMitsubishiPlcTransport { FailingBoolAddress = "X0" };
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(first, second));

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        var successful = fixture.Cache.GetSnapshotEnvelope();
        first.FailingBoolAddress = "X0";

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var disconnected = fixture.Cache.GetSnapshotEnvelope();
        Assert.False(disconnected.Payload.Connected);
        Assert.Equal(successful.Payload.ReceivedAt, disconnected.Payload.ReceivedAt);
        Assert.Equal(successful.Payload.Sequence, disconnected.Payload.Sequence);
        Assert.Equal(successful.Payload.Bits["Y002"], disconnected.Payload.Bits["Y002"]);
        var messages = fixture.Publisher.Messages.ToArray();
        Assert.Equal(2, messages.Length);
        Assert.IsType<ScadaEnvelope<PureWaterPlcTelemetry>>(messages[0]);
        Assert.IsType<ScadaEnvelope<PureWaterSourceStatusEvent>>(messages[1]);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task HardTimedOutGeneration_CannotOverwriteFreshGeneration()
    {
        var blocked = new FakeMitsubishiPlcTransport { BlockingBoolAddress = "X0" };
        var recovered = new FakeMitsubishiPlcTransport { D51 = 77, D52 = 66 };
        var fixture = CreateFixture(
            new QueueMitsubishiPlcTransportFactory(blocked, recovered),
            operationTimeoutMs: 100);

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        var fresh = fixture.Cache.GetSnapshotEnvelope();

        blocked.ReleaseBlockedRead();
        await Task.Delay(100);
        var afterLateReturn = fixture.Cache.GetSnapshotEnvelope();

        Assert.True(fresh.Payload.Connected);
        Assert.Equal(77, fresh.Payload.Words["D51"]);
        Assert.Equal(fresh.Payload.Sequence, afterLateReturn.Payload.Sequence);
        Assert.Equal(77, afterLateReturn.Payload.Words["D51"]);
        Assert.True(Volatile.Read(ref blocked.AbortCount) > 0);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task RepeatedIdenticalFailures_AreRateLimitedAndRecoveryIsExplicit()
    {
        var failures = Enumerable.Range(0, 4)
            .Select(_ => new FakeMitsubishiPlcTransport { FailingBoolAddress = "X0" })
            .Cast<IMitsubishiPlcTransport>()
            .ToArray();
        var recovered = new FakeMitsubishiPlcTransport();
        var logger = new CapturingLogger<PureWaterPlcCollector>();
        var fixture = CreateFixture(
            new QueueMitsubishiPlcTransportFactory(failures.Append(recovered).ToArray()),
            logger: logger);

        for (var index = 0; index < 5; index++)
        {
            await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        }

        var failureWarnings = logger.Entries
            .Where(entry => entry.Level == Microsoft.Extensions.Logging.LogLevel.Warning
                && entry.Message.Contains("PLC", StringComparison.Ordinal)
                && entry.Properties.ContainsKey("ConsecutiveFailures"))
            .ToArray();
        Assert.Equal(2, failureWarnings.Length);
        Assert.Equal(1, failureWarnings[0].Properties["ConsecutiveFailures"]);
        Assert.Equal(2, failureWarnings[1].Properties["ConsecutiveFailures"]);
        Assert.Contains("disconnected", failureWarnings[1].Message, StringComparison.OrdinalIgnoreCase);

        var recovery = Assert.Single(logger.Entries, entry =>
            entry.Level == Microsoft.Extensions.Logging.LogLevel.Information
            && entry.Message.Contains("acquisition recovered", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(4, recovery.Properties["PreviousFailures"]);
        Assert.Equal(2, recovery.Properties["SuppressedFailureLogs"]);
        Assert.Equal("recovered", recovery.Properties["Result"]);
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task RepeatedPointValidationWarning_IsRateLimitedUntilPointRecovers()
    {
        var transport = new FakeMitsubishiPlcTransport { D51 = 101 };
        var logger = new CapturingLogger<PureWaterPlcCollector>();
        var fixture = CreateFixture(
            new QueueMitsubishiPlcTransportFactory(transport),
            logger: logger);

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        transport.D51 = 50;
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        transport.D51 = 101;
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var pointWarnings = logger.Entries
            .Where(entry => entry.Level == Microsoft.Extensions.Logging.LogLevel.Warning
                && entry.Message.Contains("point validation", StringComparison.OrdinalIgnoreCase))
            .ToArray();
        Assert.Equal(2, pointWarnings.Length);
        Assert.All(pointWarnings, entry => Assert.Equal("OUT_OF_RANGE", entry.Properties["ErrorCode"]));
        await fixture.Collector.DisposeAsync();
    }

    [Fact]
    public async Task FailureBackoff_FollowsOneTwoFiveTenThenFifteenSecondCeiling()
    {
        var transports = Enumerable.Range(0, 5)
            .Select(_ => (IMitsubishiPlcTransport)new FakeMitsubishiPlcTransport
            {
                FailingBoolAddress = "X0",
            })
            .ToArray();
        var fixture = CreateFixture(new QueueMitsubishiPlcTransportFactory(transports));
        var expected = new[] { 1, 2, 5, 10, 15 };

        Assert.Equal(TimeSpan.FromSeconds(1), fixture.Collector.GetNextDelay());
        for (var index = 0; index < expected.Length; index++)
        {
            await fixture.Collector.CollectOnceAsync(CancellationToken.None);
            Assert.Equal(TimeSpan.FromSeconds(expected[index]), fixture.Collector.GetNextDelay());
        }

        await fixture.Collector.DisposeAsync();
    }

    private static CollectorFixture CreateFixture(
        IMitsubishiPlcTransportFactory factory,
        int operationTimeoutMs = 1000,
        ILogger<PureWaterPlcCollector>? logger = null)
    {
        var options = Options.Create(new PureWaterPlcOptions
        {
            Enabled = true,
            IpAddress = "192.168.1.50",
            Port = 5000,
            OperationTimeoutMs = operationTimeoutMs,
            ConnectTimeoutMs = 1000,
            ReceiveTimeoutMs = 1000,
            FailuresBeforeDisconnect = 2,
        });
        var clock = new FakeScadaClock(FrameTime);
        var cache = new PureWaterPlcStateCache(options, clock);
        var publisher = new CapturingRealtimePublisher();
        var collector = new PureWaterPlcCollector(
            options,
            factory,
            new PureWaterPlcReader(),
            cache,
            publisher,
            clock,
            logger ?? NullLogger<PureWaterPlcCollector>.Instance);
        return new CollectorFixture(collector, cache, publisher);
    }

    private sealed record CollectorFixture(
        PureWaterPlcCollector Collector,
        PureWaterPlcStateCache Cache,
        CapturingRealtimePublisher Publisher);
}
