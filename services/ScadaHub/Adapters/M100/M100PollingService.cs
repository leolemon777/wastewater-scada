using ScadaHub.Configuration;

namespace ScadaHub.Adapters.M100;

/// <summary>M100 轮询后台服务。M100:Enabled=false 时挂起，不发起任何网络请求。</summary>
public sealed class M100PollingService : BackgroundService
{
    private readonly M100Collector _collector;
    private readonly ILogger<M100PollingService> _logger;

    public M100PollingService(M100Collector collector, ILogger<M100PollingService> logger)
    {
        _collector = collector;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var enabled = _collector.GetNextDelay() != Timeout.InfiniteTimeSpan;
        if (!enabled)
        {
            _logger.LogInformation("M100 只读适配器未启用（M100:Enabled=false），保持挂起。");
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken).ConfigureAwait(false);
            return;
        }

        _logger.LogInformation("M100 只读适配器启动：仅通过 ioread.cgi 读取，无任何写入能力。");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _collector.CollectOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            await Task.Delay(_collector.GetNextDelay(), stoppingToken).ConfigureAwait(false);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await _collector.DisposeAsync().ConfigureAwait(false);
        await base.StopAsync(cancellationToken).ConfigureAwait(false);
    }
}
