using System.Net;
using Microsoft.Extensions.Options;

namespace ScadaHub.Configuration;

public sealed class M100Options
{
    public const string SectionName = "M100";

    public bool Enabled { get; set; }
    public List<M100DeviceOptions> Devices { get; set; } = new();
}

/// <summary>单台 M100 网关配置。Role 决定点位工程换算（daf / underground）；设备级 Enabled 默认 false（fail-closed，SPEC-PLAN 11.2）。</summary>
public sealed class M100DeviceOptions
{
    public bool Enabled { get; set; }
    public string SourceId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int PollIntervalMs { get; set; } = 1000;
    public int RequestTimeoutMs { get; set; } = 3000;
    public int FailuresBeforeDisconnect { get; set; } = 2;
}

public sealed class M100OptionsValidator : IValidateOptions<M100Options>
{
    public static readonly IReadOnlyCollection<string> KnownRoles = new[] { "daf", "underground" };

    public ValidateOptionsResult Validate(string? name, M100Options options)
    {
        var failures = new List<string>();

        if (options.Devices.Count == 0)
        {
            failures.Add("M100:Devices 必须至少配置一台设备。");
        }

        var sourceIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var device in options.Devices)
        {
            if (string.IsNullOrWhiteSpace(device.SourceId))
            {
                failures.Add("M100:Devices[*].SourceId 不能为空。");
            }
            else if (!sourceIds.Add(device.SourceId))
            {
                failures.Add($"M100:Devices 存在重复 SourceId：{device.SourceId}。");
            }

            if (!KnownRoles.Contains(device.Role, StringComparer.OrdinalIgnoreCase))
            {
                failures.Add($"M100:Devices[{device.SourceId}].Role 必须是 {string.Join("/", KnownRoles)} 之一。");
            }

            if (device.PollIntervalMs < 500)
            {
                failures.Add($"M100:Devices[{device.SourceId}].PollIntervalMs 不得小于 500ms。");
            }

            if (device.RequestTimeoutMs is < 100 or > 60_000)
            {
                failures.Add($"M100:Devices[{device.SourceId}].RequestTimeoutMs 必须在 100-60000ms 之间。");
            }

            if (device.FailuresBeforeDisconnect < 1)
            {
                failures.Add($"M100:Devices[{device.SourceId}].FailuresBeforeDisconnect 必须大于等于 1。");
            }
        }

        if (options.Enabled)
        {
            foreach (var device in options.Devices)
            {
                if (!IPAddress.TryParse(device.IpAddress, out var address)
                    || address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
                {
                    failures.Add($"启用 M100 时 Devices[{device.SourceId}].IpAddress 必须是合法 IPv4 地址。");
                    continue;
                }

                var octets = address.GetAddressBytes();
                if (octets[0] is 0 or >= 224 || octets[3] is 0 or 255)
                {
                    failures.Add($"M100:Devices[{device.SourceId}].IpAddress 必须是可用的 IPv4 主机地址。");
                }

                if (octets[0] == 127 || octets[0] == 169 && octets[1] == 254)
                {
                    failures.Add($"M100:Devices[{device.SourceId}].IpAddress 不能使用回环地址或 APIPA 自动地址。");
                }
            }
        }

        return failures.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(failures);
    }
}
