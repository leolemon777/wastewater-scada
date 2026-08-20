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
using ScadaHub.Adapters.Mitsubishi;
using ScadaHub.Api;
using ScadaHub.Configuration;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;
using ScadaHub.Tests.Fakes;

namespace ScadaHub.Tests.Api;

public sealed class PureWaterPlcRealtimeIntegrationTests
{
    [Fact]
    public async Task FakeTransport_FlowsThroughWebSocketThenPublishesDisconnectStatus()
    {
        var first = new FakeMitsubishiPlcTransport { D51 = 73, D52 = 61 };
        var second = new FakeMitsubishiPlcTransport { FailingBoolAddress = "X0" };
        var options = Options.Create(new PureWaterPlcOptions
        {
            Enabled = true,
            IpAddress = "192.168.1.50",
            Port = 5000,
            PollIntervalMs = 1000,
            ConnectTimeoutMs = 1000,
            ReceiveTimeoutMs = 1000,
            OperationTimeoutMs = 1000,
            FailuresBeforeDisconnect = 2,
            StaleAfterMs = 10_000,
            DisconnectedAfterMs = 30_000,
        });
        var clock = new FakeScadaClock(new DateTimeOffset(2026, 8, 12, 12, 0, 0, TimeSpan.Zero));

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing",
        });
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddSingleton<IOptions<PureWaterPlcOptions>>(options);
        builder.Services.AddSingleton<IOptions<M100Options>>(Options.Create(new M100Options()));
        builder.Services.AddSingleton(new ScadaHub.Infrastructure.HubEpoch());
        builder.Services.AddSingleton(new ScadaHub.Infrastructure.DeviceIoGate(false));
        builder.Services.AddSingleton<IScadaClock>(clock);
        builder.Services.AddSingleton<PureWaterPlcStateCache>();
        builder.Services.AddSingleton<M100StateCache>();
        builder.Services.AddSingleton<IMitsubishiPlcTransportFactory>(
            new QueueMitsubishiPlcTransportFactory(first, second));
        builder.Services.AddSingleton<PureWaterPlcReader>();
        builder.Services.AddSingleton<IScadaRealtimePublisher, ScadaWebSocketPublisher>();
        builder.Services.AddSingleton<PureWaterPlcCollector>();

        await using var app = builder.Build();
        app.UseWebSockets();
        app.MapPureWaterPlcEndpoints();
        await app.StartAsync();

        var server = app.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>()?.Addresses;
        var baseAddress = Assert.Single(addresses ?? Array.Empty<string>());
        var websocketAddress = new Uri(baseAddress.Replace("http://", "ws://", StringComparison.Ordinal) + "/ws/scada");
        var collector = app.Services.GetRequiredService<PureWaterPlcCollector>();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var socket = new ClientWebSocket();
        await socket.ConnectAsync(websocketAddress, timeout.Token);

        using var initial = await ReceiveJsonAsync(socket, timeout.Token);
        Assert.Equal("purewater.plc.snapshot", initial.RootElement.GetProperty("messageType").GetString());
        Assert.True(initial.RootElement.GetProperty("payload").GetProperty("enabled").GetBoolean());
        Assert.False(initial.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean());

        await collector.CollectOnceAsync(timeout.Token);
        using var live = await ReceiveJsonAsync(socket, timeout.Token);
        var livePayload = live.RootElement.GetProperty("payload");
        Assert.Equal("purewater.plc.snapshot", live.RootElement.GetProperty("messageType").GetString());
        Assert.True(livePayload.GetProperty("connected").GetBoolean());
        Assert.Equal(1, livePayload.GetProperty("sequence").GetInt64());
        Assert.Equal(73, livePayload.GetProperty("words").GetProperty("D51").GetInt32());
        Assert.Equal(73, livePayload.GetProperty("rawWords").GetProperty("D51").GetInt32());

        first.FailingBoolAddress = "X0";
        await collector.CollectOnceAsync(timeout.Token);
        await collector.CollectOnceAsync(timeout.Token);

        using var disconnected = await ReceiveJsonAsync(socket, timeout.Token);
        var disconnectedPayload = disconnected.RootElement.GetProperty("payload");
        Assert.Equal("source.status", disconnected.RootElement.GetProperty("messageType").GetString());
        Assert.False(disconnectedPayload.GetProperty("connected").GetBoolean());
        Assert.Equal(1, disconnectedPayload.GetProperty("sequence").GetInt64());

        using var httpClient = new HttpClient { BaseAddress = new Uri(baseAddress) };
        using var heldResponse = await httpClient.GetAsync("/api/pure-water/plc/snapshot", timeout.Token);
        heldResponse.EnsureSuccessStatusCode();
        using var held = JsonDocument.Parse(await heldResponse.Content.ReadAsStringAsync(timeout.Token));
        Assert.False(held.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean());
        Assert.Equal(73, held.RootElement.GetProperty("payload").GetProperty("words").GetProperty("D51").GetInt32());

        using var commandResponse = await httpClient.PostAsync(
            "/api/pure-water/plc/snapshot",
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
