namespace ScadaHub.Configuration;

/// <summary>
/// 只读试运行 allowlist（SPEC 4.3）：M100 配置集合只能包含以下两台权威设备，
/// SourceId/Role/IP 必须完全匹配；不允许新增第三台。设备级 Enabled 可分别启停。
/// 真实 SN/MAC 身份由现场签字清单确认（WP8），软件只验证配置一致性。
/// </summary>
public static class M100Allowlist
{
    public sealed record AllowedDevice(string SourceId, string Role, string IpAddress);

    public static readonly IReadOnlyList<AllowedDevice> Devices = new[]
    {
        new AllowedDevice("m100-daf-01", "daf", "192.168.0.31"),
        new AllowedDevice("m100-underground-01", "underground", "192.168.0.8"),
    };

    /// <summary>fail-closed 匹配：数量、SourceId/Role/IP 逐项精确相等（大小写敏感）。</summary>
    public static IReadOnlyList<string> Validate(IReadOnlyList<M100DeviceOptions> devices)
    {
        var failures = new List<string>();
        if (devices.Count != Devices.Count)
        {
            failures.Add($"M100:Devices 必须且只能包含 allowlist 的 {Devices.Count} 台设备（当前 {devices.Count} 台，禁止新增）。");
            return failures;
        }

        foreach (var allowed in Devices)
        {
            var match = devices.FirstOrDefault(d => d.SourceId == allowed.SourceId);
            if (match is null)
            {
                failures.Add($"M100:Devices 缺少 allowlist 设备 {allowed.SourceId}。");
                continue;
            }

            if (!string.Equals(match.Role, allowed.Role, StringComparison.Ordinal))
            {
                failures.Add($"M100:Devices[{allowed.SourceId}].Role 必须为 {allowed.Role}。");
            }

            if (!string.Equals(match.IpAddress, allowed.IpAddress, StringComparison.Ordinal))
            {
                failures.Add($"M100:Devices[{allowed.SourceId}].IpAddress 必须为 {allowed.IpAddress}（allowlist 固定值）。");
            }
        }

        return failures;
    }
}
