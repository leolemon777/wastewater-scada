using System.Diagnostics;
using Microsoft.Extensions.Options;
using ScadaHub.Configuration;
using ScadaHub.Contracts;
using ScadaHub.Infrastructure;
using ScadaHub.Realtime;
using ScadaHub.State;

namespace ScadaHub.Adapters.M100;

/// <summary>
/// M100 多设备轮询编排。每设备独立序列号、失败计数与退避（0 失败→周期，之后 1/2/5/10/15s 阶梯）；
/// 成功每周期广播 m100.snapshot；失败仅在状态翻转时广播 source.status（与纯水适配器同约定）。
/// </summary>
public sealed class M100Collector : IAsyncDisposable
{
    internal static readonly TimeSpan RepeatedFailureLogInterval = TimeSpan.FromMinutes(1);
    private static readonly int[] BackoffMs = { 1000, 2000, 5000, 10_000, 15_000 };

    private readonly M100Options _options;
    private readonly IM100HttpTransportFactory _transportFactory;
    private readonly M100StateCache _stateCache;
    private readonly IScadaRealtimePublisher _publisher;
    private readonly IScadaClock _clock;
    private readonly ILogger<M100Collector> _logger;
    private readonly DeviceIoGate _ioGate;
    private readonly List<DeviceRuntime> _runtimes = new();
    private readonly SemaphoreSlim _cycleGate = new(1, 1);
    private bool _initialized;

    public M100Collector(
        IOptions<M100Options> options,
        IM100HttpTransportFactory transportFactory,
        M100StateCache stateCache,
        IScadaRealtimePublisher publisher,
        IScadaClock clock,
        ILogger<M100Collector> logger,
        DeviceIoGate? ioGate = null)
    {
        _options = options.Value;
        _transportFactory = transportFactory;
        _stateCache = stateCache;
        _publisher = publisher;
        _clock = clock;
        _logger = logger;
        _ioGate = ioGate ?? new DeviceIoGate(ioSuppressed: false);
    }

    public async Task CollectOnceAsync(CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            return;
        }

        await _cycleGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_ioGate.IoSuppressed)
            {
                if (!_initialized)
                {
                    _initialized = true;
                    _logger.LogWarning(
                        "M100 设备 IO 已被硬门禁抑制（Testing 或 {Variable}=1）：不创建任何传输、不发起网络请求。",
                        DeviceIoGate.DisableEnvironmentVariable);
                }

                return;
            }

            EnsureInitialized();
            var now = _clock.UtcNow;
            var due = _runtimes.Where(runtime => now >= runtime.NextDue).ToArray();
            if (due.Length == 0)
            {
                return;
            }

            await Task.WhenAll(due.Select(runtime => CollectDeviceAsync(runtime, cancellationToken))).ConfigureAwait(false);
        }
        finally
        {
            _cycleGate.Release();
        }
    }

    /// <summary>返回距最近一台设备到期的时间（钳制到 >=500ms），供轮询循环睡眠。</summary>
    public TimeSpan GetNextDelay()
    {
        if (!_options.Enabled || _options.Devices.Count == 0
            || !_options.Devices.Any(device => device.Enabled))
        {
            return Timeout.InfiniteTimeSpan;
        }

        if (!_initialized)
        {
            return TimeSpan.FromMilliseconds(Math.Max(
                _options.Devices.Where(device => device.Enabled).Min(d => d.PollIntervalMs), 500));
        }

        if (_runtimes.Count == 0)
        {
            // 已初始化但无运行时：硬门禁抑制或全部设备级禁用。
            return Timeout.InfiniteTimeSpan;
        }

        var now = _clock.UtcNow;
        var nearest = _runtimes.Min(runtime => runtime.NextDue);
        var delay = nearest - now;
        return delay <= TimeSpan.Zero
            ? TimeSpan.FromMilliseconds(500)
            : delay;
    }

    private async Task CollectDeviceAsync(DeviceRuntime runtime, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var response = await runtime.Transport.ReadIOAsync(cancellationToken).ConfigureAwait(false);
            stopwatch.Stop();

            if (!response.Success || response.Body is null || !M100Reader.TryParse(response.Body, out var frame))
            {
                var reason = !response.Success
                    ? ComposeFailureReason(response)
                    : "ioread.cgi 返回内容无法解析为 IO JSON。";
                await RecordFailureAsync(runtime, reason, stopwatch).ConfigureAwait(false);
                return;
            }

            runtime.ConsecutiveFailures = 0;
            runtime.Sequence++;
            var receivedAt = _clock.UtcNow;
            var points = M100PointMap.ApplyEngineering(runtime.Options.Role, frame, out var warnings);
            frame = frame with { PointWarnings = warnings.ToArray() };

            var envelope = _stateCache.PublishSuccess(
                runtime.Options.SourceId,
                frame,
                points,
                runtime.Sequence,
                receivedAt);
            await _publisher.BroadcastAsync(envelope, cancellationToken).ConfigureAwait(false);

            if (runtime.RecoveryPending)
            {
                runtime.RecoveryPending = false;
                _logger.LogInformation(
                    "M100 {SourceId} 恢复在线：role={Role} seq={Sequence} 用时 {DurationMs}ms。",
                    runtime.Options.SourceId, runtime.Options.Role, runtime.Sequence, stopwatch.ElapsedMilliseconds);
            }

            foreach (var warning in warnings)
            {
                var key = $"{runtime.Options.SourceId}|{warning}";
                if (IsSuppressed(runtime, key, receivedAt))
                {
                    continue;
                }

                runtime.LastWarningLog[key] = receivedAt;
                _logger.LogWarning("M100 {SourceId} 点位警告：{Warning}", runtime.Options.SourceId, warning);
            }

            runtime.NextDue = receivedAt + TimeSpan.FromMilliseconds(runtime.Options.PollIntervalMs);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            await RecordFailureAsync(runtime, exception.Message, stopwatch).ConfigureAwait(false);
        }
    }

    private static string ComposeFailureReason(M100HttpResponse response) => response.HttpStatus switch
    {
        401 => "HTTP 401：设备要求登录认证，请在 M100:Devices 配置 Username/Password。",
        null when response.Error is not null => response.Error,
        _ => $"ioread.cgi 请求失败（{(response.HttpStatus.HasValue ? $"HTTP {response.HttpStatus}" : response.Error ?? "未知错误")}）。",
    };

    private async Task RecordFailureAsync(DeviceRuntime runtime, string reason, Stopwatch stopwatch)
    {
        runtime.ConsecutiveFailures++;
        var markDisconnected = runtime.ConsecutiveFailures >= runtime.Options.FailuresBeforeDisconnect;
        runtime.RecoveryPending = true;

        var (envelope, changed) = _stateCache.RecordFailure(
            runtime.Options.SourceId,
            reason,
            runtime.ConsecutiveFailures,
            markDisconnected);

        if (changed)
        {
            await _publisher.BroadcastAsync(envelope, CancellationToken.None).ConfigureAwait(false);
        }

        var now = _clock.UtcNow;
        var logKey = $"{runtime.Options.SourceId}|{reason}";
        if (IsSuppressed(runtime, logKey, now))
        {
            runtime.NextDue = now + BackoffDelay(runtime.ConsecutiveFailures);
            return;
        }

        runtime.LastWarningLog[logKey] = now;
        _logger.LogWarning(
            "M100 {SourceId} 读取失败（只读适配器）：连续 {ConsecutiveFailures} 次，原因：{Reason}，用时 {DurationMs}ms。",
            runtime.Options.SourceId, runtime.ConsecutiveFailures, reason, stopwatch.ElapsedMilliseconds);

        runtime.NextDue = now + BackoffDelay(runtime.ConsecutiveFailures);
    }

    private static TimeSpan BackoffDelay(int consecutiveFailures)
    {
        var index = Math.Clamp(consecutiveFailures - 1, 0, BackoffMs.Length - 1);
        return TimeSpan.FromMilliseconds(BackoffMs[index]);
    }

    private bool IsSuppressed(DeviceRuntime runtime, string key, DateTimeOffset now)
        => runtime.LastWarningLog.TryGetValue(key, out var last)
            && now - last < RepeatedFailureLogInterval;

    private void EnsureInitialized()
    {
        if (_initialized)
        {
            return;
        }

        foreach (var device in _options.Devices)
        {
            if (!device.Enabled)
            {
                _logger.LogInformation(
                    "M100 设备 {SourceId} 处于设备级禁用（Enabled=false）：不创建传输，Tag 保持 unknown。",
                    device.SourceId);
                continue;
            }

            _runtimes.Add(new DeviceRuntime(device, _transportFactory.Create(device)));
            _logger.LogInformation(
                "M100 只读适配器注册设备 {SourceId}：role={Role} ip={IpAddress} 周期={PollIntervalMs}ms。",
                device.SourceId, device.Role, device.IpAddress, device.PollIntervalMs);
        }

        _initialized = true;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var runtime in _runtimes)
        {
            if (runtime.Transport is IDisposable disposable)
            {
                disposable.Dispose();
            }
        }

        await Task.CompletedTask;
    }

    private sealed class DeviceRuntime
    {
        public DeviceRuntime(M100DeviceOptions options, IM100HttpTransport transport)
        {
            Options = options;
            Transport = transport;
        }

        public M100DeviceOptions Options { get; }
        public IM100HttpTransport Transport { get; }
        public long Sequence { get; set; }
        public int ConsecutiveFailures { get; set; }
        public bool RecoveryPending { get; set; }
        public DateTimeOffset NextDue { get; set; }
        public Dictionary<string, DateTimeOffset> LastWarningLog { get; } = new();
    }
}
