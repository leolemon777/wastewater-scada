using System.Net;
using Microsoft.Extensions.Options;

namespace ScadaHub.Configuration;

public sealed class PureWaterPlcOptions
{
    public const string SectionName = "PureWaterPlc";

    public bool Enabled { get; set; }
    public string SourceId { get; set; } = "purewater-plc-01";
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 5000;
    public int PollIntervalMs { get; set; } = 1000;
    public int ConnectTimeoutMs { get; set; } = 3000;
    public int ReceiveTimeoutMs { get; set; } = 3000;
    public int OperationTimeoutMs { get; set; } = 5000;
    public int FailuresBeforeDisconnect { get; set; } = 2;
    public int StaleAfterMs { get; set; } = 10_000;
    public int DisconnectedAfterMs { get; set; } = 30_000;
}

public sealed class PureWaterPlcOptionsValidator : IValidateOptions<PureWaterPlcOptions>
{
    public ValidateOptionsResult Validate(string? name, PureWaterPlcOptions options)
    {
        var failures = new List<string>();

        if (string.IsNullOrWhiteSpace(options.SourceId))
        {
            failures.Add("PureWaterPlc:SourceId 不能为空。");
        }

        if (options.PollIntervalMs < 500)
        {
            failures.Add("PureWaterPlc:PollIntervalMs 不得小于 500ms。");
        }

        if (options.ConnectTimeoutMs is < 100 or > 60_000)
        {
            failures.Add("PureWaterPlc:ConnectTimeoutMs 必须在 100-60000ms 之间。");
        }

        if (options.ReceiveTimeoutMs is < 100 or > 60_000)
        {
            failures.Add("PureWaterPlc:ReceiveTimeoutMs 必须在 100-60000ms 之间。");
        }

        if (options.OperationTimeoutMs is < 100 or > 60_000)
        {
            failures.Add("PureWaterPlc:OperationTimeoutMs 必须在 100-60000ms 之间。");
        }

        if (options.FailuresBeforeDisconnect < 1)
        {
            failures.Add("PureWaterPlc:FailuresBeforeDisconnect 必须大于等于 1。");
        }

        if (options.StaleAfterMs <= options.PollIntervalMs)
        {
            failures.Add("PureWaterPlc:StaleAfterMs 必须大于轮询周期。");
        }

        if (options.DisconnectedAfterMs <= options.StaleAfterMs)
        {
            failures.Add("PureWaterPlc:DisconnectedAfterMs 必须大于 StaleAfterMs。");
        }

        if (options.Enabled)
        {
            // SPEC 4.3：只读试运行版本未授权启用纯水 PLC（正式启用需另行评审并修订 SPEC）。
            failures.Add("PureWaterPlc:Enabled 在 readonly-trial 版本必须为 false（未授权启用）。");
            ValidateEnabledAddress(options, failures);
        }

        return failures.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(failures);
    }

    private static void ValidateEnabledAddress(PureWaterPlcOptions options, ICollection<string> failures)
    {
        if (!IPAddress.TryParse(options.IpAddress, out var address)
            || address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
        {
            failures.Add("启用纯水 PLC 时必须配置合法的 IPv4 单播地址。");
        }
        else
        {
            var octets = address.GetAddressBytes();
            var invalidHost = octets[0] is 0 or >= 224 || octets[3] is 0 or 255;
            var localOnlyOrAutomatic = octets[0] == 127
                || octets[0] == 169 && octets[1] == 254;
            var reservedProjectSubnet = octets[0] == 192
                && octets[1] == 168
                && octets[2] is 0 or 2;

            if (invalidHost)
            {
                failures.Add("PureWaterPlc:IpAddress 必须是可用的 IPv4 主机地址。");
            }

            if (localOnlyOrAutomatic)
            {
                failures.Add("PureWaterPlc:IpAddress 不能使用回环地址或 APIPA 自动地址。");
            }

            if (reservedProjectSubnet)
            {
                failures.Add("纯水 PLC 数据 IP 不能使用 M100 的 192.168.0.x 或网桥管理的 192.168.2.x 网段。");
            }
        }

        var portAllowed = options.Port is >= 1025 and <= 5548
            || options.Port is >= 5560 and <= 65534;
        if (!portAllowed)
        {
            failures.Add("PureWaterPlc:Port 不在 FX3U-ENET-ADP MC Protocol TCP 允许范围内。");
        }
    }
}
