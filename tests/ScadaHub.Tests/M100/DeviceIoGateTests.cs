using Microsoft.Extensions.Options;
using ScadaHub.Adapters.M100;
using ScadaHub.Configuration;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;
using ScadaHub.Tests.Fakes;

namespace ScadaHub.Tests.M100;

/// <summary>
/// 设备 IO 硬门禁测试（SPEC-PLAN 11.2 / 14.1）：
/// Testing 环境或 SCADA_DISABLE_ALL_DEVICE_IO=1 时，即使设备配置全部启用，
/// transport factory 的 create/read 也必须为 0，硬门禁不可被配置覆盖。
/// </summary>
public sealed class DeviceIoGateTests
{
    [Fact]
    public void TestingEnvironment_IsAlwaysSuppressed()
    {
        var gate = DeviceIoGate.FromEnvironment(new TestHostEnvironment("Testing"));
        Assert.True(gate.IoSuppressed);
    }

    [Fact]
    public void DisableEnvironmentVariable_SuppressesEvenInProduction()
    {
        var original = Environment.GetEnvironmentVariable(DeviceIoGate.DisableEnvironmentVariable);
        try
        {
            Environment.SetEnvironmentVariable(DeviceIoGate.DisableEnvironmentVariable, "1");
            var gate = DeviceIoGate.FromEnvironment(new TestHostEnvironment("Production"));
            Assert.True(gate.IoSuppressed);
        }
        finally
        {
            Environment.SetEnvironmentVariable(DeviceIoGate.DisableEnvironmentVariable, original);
        }
    }

    [Fact]
    public void ProductionWithoutVariable_IsOpen()
    {
        var original = Environment.GetEnvironmentVariable(DeviceIoGate.DisableEnvironmentVariable);
        try
        {
            Environment.SetEnvironmentVariable(DeviceIoGate.DisableEnvironmentVariable, null);
            var gate = DeviceIoGate.FromEnvironment(new TestHostEnvironment("Production"));
            Assert.False(gate.IoSuppressed);
        }
        finally
        {
            Environment.SetEnvironmentVariable(DeviceIoGate.DisableEnvironmentVariable, original);
        }
    }

    [Fact]
    public async Task SuppressedGate_WithEnabledConfig_CreatesAndReadsNothing()
    {
        var transport = new FakeM100HttpTransport();
        var factory = FakeM100HttpTransportFactory.Single(transport);
        var options = new M100Options
        {
            Enabled = true,
            Devices = new List<M100DeviceOptions>
            {
                new()
                {
                    Enabled = true,
                    SourceId = "m100-daf-01",
                    Role = "daf",
                    IpAddress = "192.168.0.31",
                },
            },
        };
        var clock = new FakeScadaClock(new DateTimeOffset(2026, 8, 20, 0, 0, 0, TimeSpan.Zero));
        var cache = new M100StateCache(Options.Create(options), clock);
        var publisher = new CapturingRealtimePublisher();
        var collector = new M100Collector(
            Options.Create(options),
            factory,
            cache,
            publisher,
            clock,
            new CapturingLogger<M100Collector>(),
            ioGate: new DeviceIoGate(ioSuppressed: true));

        await collector.CollectOnceAsync(CancellationToken.None);
        await collector.CollectOnceAsync(CancellationToken.None);

        Assert.Equal(0, factory.CreateCount);
        Assert.Equal(0, transport.ReadCount);
        Assert.Empty(publisher.Messages);
    }

    [Fact]
    public async Task DeviceLevelDisabled_CreatesNoTransportAndStaysUnknown()
    {
        var transport = new FakeM100HttpTransport();
        var factory = FakeM100HttpTransportFactory.Single(transport);
        var options = new M100Options
        {
            Enabled = true,
            Devices = new List<M100DeviceOptions>
            {
                new()
                {
                    Enabled = false,
                    SourceId = "m100-daf-01",
                    Role = "daf",
                    IpAddress = "192.168.0.31",
                },
            },
        };
        var clock = new FakeScadaClock(new DateTimeOffset(2026, 8, 20, 0, 0, 0, TimeSpan.Zero));
        var cache = new M100StateCache(Options.Create(options), clock);
        var publisher = new CapturingRealtimePublisher();
        var collector = new M100Collector(
            Options.Create(options),
            factory,
            cache,
            publisher,
            clock,
            new CapturingLogger<M100Collector>());

        await collector.CollectOnceAsync(CancellationToken.None);

        Assert.Equal(0, factory.CreateCount);
        Assert.Equal(Timeout.InfiniteTimeSpan, collector.GetNextDelay());
        var status = cache.GetStatus("m100-daf-01");
        Assert.False(status.Connected);
        Assert.False(status.Enabled);
    }

    private sealed class TestHostEnvironment(string environmentName) : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = "ScadaHub.Tests";
        public string ContentRootPath { get; set; } = ".";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; }
            = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
