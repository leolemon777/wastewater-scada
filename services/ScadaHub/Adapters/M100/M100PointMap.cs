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


    /// <summary>
    /// 构造 contractVersion=2 的 tags 结构（SPEC 8.2）：daf -> pH/do01/do02；
    /// underground -> levelValue/levelPercent。值 null 表示 invalid。
    /// </summary>
    public static IReadOnlyDictionary<string, Contracts.M100TagSnapshot> BuildTags(
        string role,
        M100Frame frame,
        IReadOnlyDictionary<string, double?> points,
        long sampledAtUnixMs)
    {
        var tags = new Dictionary<string, Contracts.M100TagSnapshot>(StringComparer.OrdinalIgnoreCase);
        var rawAi = frame.Ai.Count > 0 ? frame.Ai[0] : null;

        Contracts.M100TagSnapshot Analog(string tagId, double? value, string unit, string pointName)
        {
            var invalid = value is null;
            return new Contracts.M100TagSnapshot
            {
                Value = invalid ? null : value,
                LastGoodValue = value,
                Quality = invalid ? "invalid" : "good",
                Unit = unit,
                RawKey = "ai01",
                RawValue = rawAi,
                RawUnit = "uA",
                SampledAt = sampledAtUnixMs,
                Warning = invalid ? $"{pointName} 无有效值（量程外或原始值缺失）" : null,
            };
        }

        Contracts.M100TagSnapshot Flag(string tagId, bool? value, string rawKey)
        {
            return new Contracts.M100TagSnapshot
            {
                Value = value,
                LastGoodValue = value,
                Quality = "good",
                Unit = "boolean",
                RawKey = rawKey,
                RawValue = value,
                RawUnit = "boolean",
                SampledAt = sampledAtUnixMs,
                Warning = null,
            };
        }

        if (string.Equals(role, DafRole, StringComparison.OrdinalIgnoreCase))
        {
            tags["tk-daf.pH"] = Analog("tk-daf.pH", points.TryGetValue(PhPoint, out var ph) ? ph : null, "pH", "pH");
            var do01 = frame.Do.Count > 0 ? frame.Do[0] : null;
            var do02 = frame.Do.Count > 1 ? frame.Do[1] : null;
            tags["tk-daf.aerationCommanded"] = Flag("tk-daf.aerationCommanded", do01, "do01");
            tags["tk-daf.scraperCommanded"] = Flag("tk-daf.scraperCommanded", do02, "do02");
        }
        else if (string.Equals(role, UndergroundRole, StringComparison.OrdinalIgnoreCase))
        {
            var level = points.TryGetValue(LevelPoint, out var lv) ? lv : null;
            tags["tk-intermediate.levelValue"] = Analog("tk-intermediate.levelValue", level, "m", "液位");
            double? percent = level is null
                ? null
                : Math.Min(100.0, Math.Max(0.0, (level.Value / LevelSpan) * 100));
            tags["tk-intermediate.levelPercent"] = new Contracts.M100TagSnapshot
            {
                Value = percent,
                LastGoodValue = percent,
                Quality = percent is null ? "invalid" : "good",
                Unit = "%",
                RawKey = "ai01",
                RawValue = rawAi,
                RawUnit = "uA",
                SampledAt = sampledAtUnixMs,
                Warning = percent is null ? "液位百分比依赖有效液位" : null,
            };
        }

        return tags;
    }

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
