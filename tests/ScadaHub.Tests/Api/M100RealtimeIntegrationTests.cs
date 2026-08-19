using System.Net;
using System.Net.WebSockets;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ScadaHub.Adapters.M100;
using ScadaHub.Api;
using ScadaHub.Configuration;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;
using ScadaHub.Tests.Fakes;

namespace ScadaHub.Tests.Api;

public sealed class M100RealtimeIntegrationTests
{
    [Fact]
    public async Task FakeTransport_FlowsThroughWebSocketThenPublishesDisconnectStatus()
    {
        var transport = new FakeM100HttpTransport
        {
            ResponseBody = "{\"do\":[1,1],\"di\":[0,0],\"ai\":[9516,0],\"ao\":[]}",
        };
        var options = Options.Create(new M100Options
        {
            Enabled = true,
            Devices = new List<M100DeviceOptions>
            {
                new()
                {
                    SourceId = "m100-daf-01",
                    Role = "daf",
                    IpAddress = "192.168.0.31",
                    Username = "admin",
                    Password = "admin",
                    PollIntervalMs = 1000,
                    RequestTimeoutMs = 3000,
                    FailuresBeforeDisconnect = 2,
                },
                new()
                {
                    SourceId = "m100-underground-01",
                    Role = "underground",
                    IpAddress = "192.168.0.8",
                    Username = "admin",
                    Password = "admin",
                    PollIntervalMs = 1000,
                    RequestTimeoutMs = 3000,
                    FailuresBeforeDisconnect = 2,
                },
            },
        });
        var clock = new FakeScadaClock(new DateTimeOffset(2026, 8, 19, 12, 0, 0, TimeSpan.Zero));

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddSingleton<IOptions<PureWaterPlcOptions>>(
            Options.Create(new PureWaterPlcOptions()));
        builder.Services.AddSingleton<IOptions<M100Options>>(options);
        builder.Services.AddSingleton<IScadaClock>(clock);
        builder.Services.AddSingleton<PureWaterPlcStateCache>();
        builder.Services.AddSingleton<M100StateCache>();
        builder.Services.AddSingleton<IM100HttpTransportFactory>(FakeM100HttpTransportFactory.Single(transport));
        builder.Services.AddSingleton<IScadaRealtimePublisher, ScadaWebSocketPublisher>();
        builder.Services.AddSingleton<M100Collector>();

        await using var app = builder.Build();
        app.UseWebSockets();
        app.MapPureWaterPlcEndpoints();
        app.MapM100Endpoints();
        await app.StartAsync();

        var server = app.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>()?.Addresses;
        var baseAddress = Assert.Single(addresses ?? Array.Empty<string>());
        var websocketAddress = new Uri(baseAddress.Replace("http://", "ws://", StringComparison.Ordinal) + "/ws/scada");
        var collector = app.Services.GetRequiredService<M100Collector>();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var socket = new ClientWebSocket();
        await socket.ConnectAsync(websocketAddress, timeout.Token);

        // 初始保持帧：纯水（禁用）→ m100 两台（断连态）
        using var pureWaterInitial = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("purewater.plc.snapshot", pureWaterInitial.RootElement.GetProperty("messageType").GetString());
        using var dafInitial = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("m100.snapshot", dafInitial.RootElement.GetProperty("messageType").GetString());
        Assert.Equal("m100-daf-01", dafInitial.RootElement.GetProperty("sourceId").GetString());
        Assert.False(dafInitial.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean());
        using var undergroundInitial = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("m100-underground-01", undergroundInitial.RootElement.GetProperty("sourceId").GetString());

        await collector.CollectOnceAsync(timeout.Token);

        using var dafLive = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("m100.snapshot", dafLive.RootElement.GetProperty("messageType").GetString());
        var dafPayload = dafLive.RootElement.GetProperty("payload");
        Assert.True(dafPayload.GetProperty("connected").GetBoolean());
        Assert.Equal(1, dafPayload.GetProperty("sequence").GetInt64());
        Assert.True(dafPayload.GetProperty("do").GetProperty("do01").GetBoolean());
        Assert.Equal(4.826, dafPayload.GetProperty("points").GetProperty("ph").GetDouble(), precision: 3);

        using var undergroundLive = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("m100-underground-01", undergroundLive.RootElement.GetProperty("sourceId").GetString());
        // fake 对两台设备返回同一 body：ai01=9516uA → level = (9.516-4)/16*5 = 1.724
        Assert.Equal(1.724, undergroundLive.RootElement.GetProperty("payload")
            .GetProperty("points").GetProperty("level").GetDouble(), precision: 3);

        clock.Advance(TimeSpan.FromSeconds(2));
        transport.FailHttpStatus = 401;
        await collector.CollectOnceAsync(timeout.Token);
        clock.Advance(TimeSpan.FromSeconds(2));
        await collector.CollectOnceAsync(timeout.Token);

        using var dafDisconnected = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("source.status", dafDisconnected.RootElement.GetProperty("messageType").GetString());
        Assert.Equal("m100-daf-01", dafDisconnected.RootElement.GetProperty("sourceId").GetString());
        Assert.False(dafDisconnected.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean());
        using var undergroundDisconnected = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("m100-underground-01", undergroundDisconnected.RootElement.GetProperty("sourceId").GetString());
        Assert.False(undergroundDisconnected.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean());

        using var httpClient = new HttpClient { BaseAddress = new Uri(baseAddress) };
        using var snapshotsResponse = await httpClient.GetAsync("/api/m100/snapshots", timeout.Token);
        snapshotsResponse.EnsureSuccessStatusCode();
        using var snapshots = JsonDocument.Parse(await snapshotsResponse.Content.ReadAsStringAsync(timeout.Token));
        Assert.Equal(2, snapshots.RootElement.GetArrayLength());

        using var statusesResponse = await httpClient.GetAsync("/api/m100/statuses", timeout.Token);
        statusesResponse.EnsureSuccessStatusCode();
        using var statuses = JsonDocument.Parse(await statusesResponse.Content.ReadAsStringAsync(timeout.Token));
        Assert.Equal(2, statuses.RootElement.GetArrayLength());
        Assert.Equal("offline", statuses.RootElement[0].GetProperty("quality").GetString());

        using var commandResponse = await httpClient.PostAsync(
            "/api/m100/snapshots",
            new StringContent(string.Empty),
            timeout.Token);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, commandResponse.StatusCode);

        try
        {
            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "test complete", timeout.Token);
        }
        catch (WebSocketException)
        {
            // 并行测试下服务端可能先完成关闭，忽略关闭握手竞态。
        }

        await collector.DisposeAsync();
        await app.StopAsync(timeout.Token);
    }

    private static async Task<JsonDocument> ReceiveJsonAsync(
        ClientWebSocket socket,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[4096];
        using var stream = new MemoryStream();
        WebSocketReceiveResult result;
        do
        {
            result = await socket.ReceiveAsync(buffer, cancellationToken);
            Assert.Equal(WebSocketMessageType.Text, result.MessageType);
            stream.Write(buffer, 0, result.Count);
        }
        while (!result.EndOfMessage);

        stream.Position = 0;
        return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
    }
}
