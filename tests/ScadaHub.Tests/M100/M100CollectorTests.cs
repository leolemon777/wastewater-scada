using Microsoft.Extensions.Options;
using ScadaHub.Adapters.M100;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;
using ScadaHub.Tests.Fakes;

namespace ScadaHub.Tests.M100;

public sealed class M100CollectorTests
{
    private sealed record Fixture(
        M100Options Options,
        FakeScadaClock Clock,
        M100StateCache Cache,
        CapturingRealtimePublisher Publisher,
        M100Collector Collector,
        FakeM100HttpTransport Transport,
        FakeM100HttpTransportFactory Factory);

    private static Fixture CreateFixture(
        M100DeviceOptions device,
        FakeM100HttpTransport transport,
        bool enabled = true,
        DeviceIoGate? ioGate = null)
    {
        var options = new M100Options { Enabled = enabled, Devices = new List<M100DeviceOptions> { device } };
        var clock = new FakeScadaClock(new DateTimeOffset(2026, 8, 19, 12, 0, 0, TimeSpan.Zero));
        var cache = new M100StateCache(Options.Create(options), clock);
        var publisher = new CapturingRealtimePublisher();
        var logger = new CapturingLogger<M100Collector>();
        var factory = FakeM100HttpTransportFactory.Single(transport);
        var collector = new M100Collector(
            Options.Create(options),
            factory,
            cache,
            publisher,
            clock,
            logger,
            ioGate);
        return new Fixture(options, clock, cache, publisher, collector, transport, factory);
    }

    private static M100DeviceOptions DafDevice() => new()
    {
        Enabled = true,
        SourceId = "m100-daf-01",
        Role = "daf",
        IpAddress = "192.168.0.31",
        PollIntervalMs = 1000,
        RequestTimeoutMs = 3000,
        FailuresBeforeDisconnect = 2,
    };

    [Fact]
    public async Task DisabledCollector_DoesNothing()
    {
        var fixture = CreateFixture(DafDevice(), new FakeM100HttpTransport(), enabled: false);
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        Assert.Empty(fixture.Publisher.Messages);
        Assert.Equal(0, fixture.Transport.ReadCount);
        Assert.Equal(Timeout.InfiniteTimeSpan, fixture.Collector.GetNextDelay());
    }

    [Fact]
    public async Task SuccessfulRead_BroadcastsSnapshotWithEngineeringPoints()
    {
        var fixture = CreateFixture(DafDevice(), new FakeM100HttpTransport
        {
            ResponseBody = "{\"do\":[1,1],\"di\":[0,0],\"ai\":[9516,0],\"ao\":[]}",
        });

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var envelope = Assert.IsType<ScadaEnvelope<M100Telemetry>>(Assert.Single(fixture.Publisher.Messages));
        Assert.Equal("m100.snapshot", envelope.MessageType);
        Assert.Equal("m100-http", envelope.SourceType);
        Assert.Equal("m100-daf-01", envelope.SourceId);
        Assert.Equal("good", envelope.Quality);
        Assert.Equal(1, envelope.Payload.Sequence);
        Assert.True(envelope.Payload.Connected);
        Assert.True(envelope.Payload.Do["do01"]);
        Assert.True(envelope.Payload.Do["do02"]);
        Assert.Equal(9516, envelope.Payload.Ai["ai01"]);
        // pH = (9.516 - 4) / 16 * 14 = 4.8265
        Assert.Equal(4.826, envelope.Payload.Points["ph"]!.Value, precision: 3);
        Assert.Empty(envelope.Payload.Warnings);
    }

    [Fact]
    public async Task UndergroundRole_ConvertsAiToLevel()
    {
        var device = new M100DeviceOptions
        {
            Enabled = true,
                    SourceId = "m100-underground-01",
            Role = "underground",
            IpAddress = "192.168.0.8",
            PollIntervalMs = 1000,
        };
        var fixture = CreateFixture(device, new FakeM100HttpTransport
        {
            ResponseBody = "{\"do\":[0,0],\"di\":[0,0],\"ai\":[16084,0],\"ao\":[]}",
        });

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var envelope = Assert.IsType<ScadaEnvelope<M100Telemetry>>(Assert.Single(fixture.Publisher.Messages));
        // level = (16.084 - 4) / 16 * 5 = 3.776
        Assert.Equal(3.776, envelope.Payload.Points["level"]!.Value, precision: 3);
        Assert.False(envelope.Payload.Points.ContainsKey("ph"));
    }

    [Fact]
    public async Task OutOfRangeCurrent_MarksPointUnknownWithWarning()
    {
        var fixture = CreateFixture(DafDevice(), new FakeM100HttpTransport
        {
            ResponseBody = "{\"do\":[1,0],\"di\":[0,0],\"ai\":[1200,0],\"ao\":[]}", // 1.2mA 故障电流
        });

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var envelope = Assert.IsType<ScadaEnvelope<M100Telemetry>>(Assert.Single(fixture.Publisher.Messages));
        Assert.Null(envelope.Payload.Points["ph"]);
        Assert.Contains(envelope.Payload.Warnings, warning => warning.Contains("超出 4-20mA"));
    }

    [Fact]
    public async Task UnauthorizedResponse_DisconnectsAfterThresholdAndBroadcastsStatusOnce()
    {
        var transport = new FakeM100HttpTransport { FailHttpStatus = 401 };
        var fixture = CreateFixture(DafDevice(), transport);

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        fixture.Clock.Advance(TimeSpan.FromSeconds(2));
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        // 两次失败后：应有一条 source.status（翻转）而没有任何 snapshot
        var status = fixture.Publisher.Messages.OfType<ScadaEnvelope<Contracts.PureWaterSourceStatusEvent>>().ToList();
        Assert.Single(status);
        Assert.Equal("source.status", status[0].MessageType);
        Assert.Equal("m100-daf-01", status[0].SourceId);
        Assert.False(status[0].Payload.Connected);
        Assert.Contains("401", status[0].Payload.Reason);
        Assert.Empty(fixture.Publisher.Messages.OfType<ScadaEnvelope<M100Telemetry>>());

        var persisted = fixture.Cache.GetStatus("m100-daf-01");
        Assert.False(persisted.Connected);
        Assert.Equal(2, persisted.ConsecutiveFailures);
    }

    [Fact]
    public async Task RecoversWithFreshSequenceAfterFailures()
    {
        var transport = new FakeM100HttpTransport();
        var fixture = CreateFixture(DafDevice(), transport);

        transport.FailHttpStatus = 500;
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);
        fixture.Clock.Advance(TimeSpan.FromSeconds(2));
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        transport.FailHttpStatus = null;
        fixture.Clock.Advance(TimeSpan.FromSeconds(2));
        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        var snapshot = fixture.Publisher.Messages.OfType<ScadaEnvelope<M100Telemetry>>().Single();
        Assert.True(snapshot.Payload.Connected);
        Assert.Equal(1, snapshot.Payload.Sequence);
        Assert.Equal("good", fixture.Cache.GetStatus("m100-daf-01").Quality);
    }

    [Fact]
    public async Task MalformedBody_CountsAsFailure()
    {
        var fixture = CreateFixture(DafDevice(), new FakeM100HttpTransport
        {
            InvalidBody = "<html>login page</html>",
        });

        await fixture.Collector.CollectOnceAsync(CancellationToken.None);

        Assert.Empty(fixture.Publisher.Messages.OfType<ScadaEnvelope<M100Telemetry>>());
        Assert.Equal(1, fixture.Cache.GetStatus("m100-daf-01").ConsecutiveFailures);
    }

    [Fact]
    public void NextDelayBeforeInitialization_ReturnsPollInterval()
    {
        var fixture = CreateFixture(DafDevice(), new FakeM100HttpTransport());
        Assert.Equal(TimeSpan.FromMilliseconds(1000), fixture.Collector.GetNextDelay());
    }
}
