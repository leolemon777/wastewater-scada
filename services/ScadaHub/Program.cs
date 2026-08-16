using Microsoft.Extensions.Options;
using ScadaHub.Adapters.Mitsubishi;
using ScadaHub.Api;
using ScadaHub.Configuration;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: false);

builder.Services
    .AddOptions<PureWaterPlcOptions>()
    .Bind(builder.Configuration.GetSection(PureWaterPlcOptions.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<PureWaterPlcOptions>, PureWaterPlcOptionsValidator>();

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
builder.Services.AddSingleton<PureWaterPlcStateCache>();
builder.Services.AddSingleton<IMitsubishiPlcTransportFactory, HslMitsubishiPlcTransportFactory>();
builder.Services.AddSingleton<PureWaterPlcReader>();
builder.Services.AddSingleton<IScadaRealtimePublisher, ScadaWebSocketPublisher>();
builder.Services.AddSingleton<PureWaterPlcCollector>();
builder.Services.AddHostedService<PureWaterPlcPollingService>();

var app = builder.Build();

app.UseCors("local-scada-ui");
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(20),
});
app.MapPureWaterPlcEndpoints();

app.Run();

public partial class Program;
