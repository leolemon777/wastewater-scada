using Microsoft.Extensions.Options;
using ScadaHub.Adapters.M100;
using ScadaHub.Adapters.Mitsubishi;
using ScadaHub.Api;
using ScadaHub.Configuration;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;

var builder = WebApplication.CreateBuilder(args);
// SPEC-PLAN 19：Windows 服务宿主（服务名由 Install 脚本注册为 WastewaterScadaReadonly）。
builder.Host.UseWindowsService();
builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: false);

builder.Services
    .AddOptions<PureWaterPlcOptions>()
    .Bind(builder.Configuration.GetSection(PureWaterPlcOptions.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<PureWaterPlcOptions>, PureWaterPlcOptionsValidator>();

builder.Services
    .AddOptions<M100Options>()
    .Bind(builder.Configuration.GetSection(M100Options.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<M100Options>, M100OptionsValidator>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("local-scada-ui", policy =>
    {
        policy
            .WithOrigins("http://127.0.0.1:5173", "http://localhost:5173")
            .AllowAnyHeader()
            .WithMethods("GET");
    });
});

builder.Services.AddSingleton<IScadaClock, SystemScadaClock>();
// 设备 IO 硬门禁（SPEC-PLAN 11.2）：进程环境直读，先于任何设备注册；
// Testing 或 SCADA_DISABLE_ALL_DEVICE_IO=1 时所有适配器不出网。
builder.Services.AddSingleton(DeviceIoGate.FromEnvironment(builder.Environment));
builder.Services.AddSingleton<HubEpoch>();
builder.Services.AddSingleton<PureWaterPlcStateCache>();
builder.Services.AddSingleton<IMitsubishiPlcTransportFactory, HslMitsubishiPlcTransportFactory>();
builder.Services.AddSingleton<PureWaterPlcReader>();
builder.Services.AddSingleton<M100StateCache>();
builder.Services.AddSingleton<IM100HttpTransportFactory, HttpM100IOTransportFactory>();
builder.Services.AddSingleton<IScadaRealtimePublisher, ScadaWebSocketPublisher>();
builder.Services.AddSingleton<PureWaterPlcCollector>();
builder.Services.AddSingleton<M100Collector>();
builder.Services.AddHostedService<PureWaterPlcPollingService>();
builder.Services.AddHostedService<M100PollingService>();
builder.Services.AddHostedService<HubHeartbeatService>();

var app = builder.Build();

app.UseCors("local-scada-ui");
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(20),
});
app.MapPureWaterPlcEndpoints();
app.MapM100Endpoints();

// SPEC-PLAN 13：分层健康检查——进程存活 / 服务就绪 / 每源数据状态。
// source 全断不使 readiness 503；现场数据健康只经 /api/sources/status 与 UI/报警表达。
app.MapGet("/api/health/live", () => Results.Ok(new
{
    status = "alive",
    version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0",
    commit = ScadaHub.SourceRevision.Commit,
    timestamp = DateTimeOffset.UtcNow,
}));
app.MapGet("/api/health/ready", (M100StateCache m100Cache, PureWaterPlcStateCache plcCache) =>
{
    var ready = m100Cache is not null && plcCache is not null;
    return ready
        ? Results.Ok(new { status = "ready", version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0", commit = ScadaHub.SourceRevision.Commit, timestamp = DateTimeOffset.UtcNow })
        : Results.Json(new { status = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
});
app.MapGet("/api/sources/status", (M100StateCache m100Cache, PureWaterPlcStateCache plcCache) => Results.Ok(new
{
    m100 = m100Cache.GetStatuses(),
    pureWaterPlc = plcCache.GetStatus(),
}));

// SPEC-PLAN 17.1：同源提供构建后的静态前端（发布包 app/wwwroot，由 Build 脚本拷贝 dist）。
var wwwroot = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(wwwroot))
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwroot) });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwroot) });
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwroot) });
}

app.Run();

public partial class Program;
