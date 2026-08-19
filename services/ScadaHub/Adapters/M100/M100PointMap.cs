using ScadaHub.Contracts;

namespace ScadaHub.Adapters.M100;

/// <summary>
/// M100 点位工程换算。按设备 Role 将 AI 原始电流（uA）换算为工程值；
/// 电流超出 4-20mA 量程时返回 null 并产出警告（仪表故障电流不得换算为错误工程值）。
/// </summary>
public static class M100PointMap
{
    public const string DafRole = "daf";
    public const string UndergroundRole = "underground";

    public const string PhPoint = "ph";
    public const string LevelPoint = "level";

    private const double PhSpan = 14.0;
    private const double LevelSpan = 5.0;

    public static string AdapterLabel(string role) => role?.ToLowerInvariant() switch
    {
        DafRole => "USR-M100 气浮前端只读适配器",
        UndergroundRole => "USR-M100 地下池液位只读适配器",
        _ => "USR-M100 只读适配器",
    };

    /// <summary>将 AI[0] 换算为工程值。daf → pH(0-14)；underground → 液位(0-5m)。</summary>
    public static IReadOnlyDictionary<string, double?> ApplyEngineering(
        string role,
        M100Frame frame,
        out IReadOnlyList<string> warnings)
    {
        var collected = new List<string>(frame.PointWarnings);
        var points = new Dictionary<string, double?>(StringComparer.OrdinalIgnoreCase);

        var rawUa = frame.Ai.Count > 0 ? frame.Ai[0] : null;
        var pointName = role?.ToLowerInvariant() switch
        {
            DafRole => PhPoint,
            UndergroundRole => LevelPoint,
            _ => null,
        };

        if (pointName is null)
        {
            warnings = collected;
            return points;
        }

        if (rawUa is null)
        {
            points[pointName] = null;
            collected.Add($"ai01 无有效原始值，{pointName} 未知。");
        }
        else
        {
            var mA = rawUa.Value / 1000.0;
            if (mA < 4.0 || mA > 20.0)
            {
                points[pointName] = null;
                collected.Add($"ai01={mA:0.###}mA 超出 4-20mA 量程，{pointName} 置为未知。");
            }
            else
            {
                var span = string.Equals(role, DafRole, StringComparison.OrdinalIgnoreCase) ? PhSpan : LevelSpan;
                points[pointName] = Math.Round((mA - 4.0) / 16.0 * span, 3);
            }
        }

        warnings = collected;
        return points;
    }
}
