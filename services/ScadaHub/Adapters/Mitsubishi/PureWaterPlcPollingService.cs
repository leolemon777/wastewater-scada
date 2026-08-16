using Microsoft.Extensions.Options;
using ScadaHub.Configuration;

namespace ScadaHub.Adapters.Mitsubishi;

public sealed class PureWaterPlcPollingService : BackgroundService
{
    private readonly PureWaterPlcOptions _options;
    private readonly PureWaterPlcCollector _collector;
    private readonly ILogger<PureWaterPlcPollingService> _logger;

    public PureWaterPlcPollingService(
        IOptions<PureWaterPlcOptions> options,
        PureWaterPlcCollector collector,
        ILogger<PureWaterPlcPollingService> logger)
    {
        _options = options.Value;
        _collector = collector;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Pure-water Mitsubishi adapter starting in READ-ONLY mode. Enabled={Enabled}, Protocol=MC-A1E-Binary, Port={Port}",
            _options.Enabled,
            _options.Port);
        _logger.LogInformation(
            "Pure-water main-frame groups: X0x24, Y0x24, M400x16, M500x18(reviewed subset), D51x2, D90x1");

        if (!_options.Enabled)
        {
            _logger.LogInformation("Pure-water PLC adapter is disabled; no PLC connection will be attempted.");
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken).ConfigureAwait(false);
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            await _collector.CollectOnceAsync(stoppingToken).ConfigureAwait(false);
            await Task.Delay(_collector.GetNextDelay(), stoppingToken).ConfigureAwait(false);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken).ConfigureAwait(false);
        await _collector.DisposeAsync().ConfigureAwait(false);
    }
}
