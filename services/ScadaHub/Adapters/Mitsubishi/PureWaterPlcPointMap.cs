namespace ScadaHub.Adapters.Mitsubishi;

public static class PureWaterPlcPointMap
{
    public static IReadOnlyList<string> InputAddresses { get; } = BuildOctalRange('X', 24);
    public static IReadOnlyList<string> OutputAddresses { get; } = BuildOctalRange('Y', 24);
    public static IReadOnlyList<string> AlarmAddresses { get; } = BuildDecimalRange('M', 400, 16);

    public static IReadOnlySet<string> PublishedModeAddresses { get; } = new HashSet<string>(
        new[] { "M500", "M501", "M502" }
            .Concat(Enumerable.Range(510, 8).Select(value => $"M{value}")),
        StringComparer.OrdinalIgnoreCase);

    public static string FormatOctalBitAddress(char prefix, int zeroBasedIndex)
    {
        if (prefix is not ('X' or 'Y'))
        {
            throw new ArgumentOutOfRangeException(nameof(prefix), "只有 X/Y 使用本八进制地址格式。");
        }

        if (zeroBasedIndex < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(zeroBasedIndex));
        }

        return $"{prefix}{Convert.ToString(zeroBasedIndex, 8).PadLeft(3, '0')}";
    }

    public static IReadOnlyList<string> BuildOctalRange(char prefix, int count)
    {
        if (count < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(count));
        }

        return Enumerable.Range(0, count)
            .Select(index => FormatOctalBitAddress(prefix, index))
            .ToArray();
    }

    public static IReadOnlyList<string> BuildDecimalRange(char prefix, int start, int count)
    {
        if (count < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(count));
        }

        return Enumerable.Range(start, count)
            .Select(value => $"{prefix}{value}")
            .ToArray();
    }
}
