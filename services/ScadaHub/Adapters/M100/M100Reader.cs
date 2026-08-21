using System.Text.Json;
using ScadaHub.Contracts;

namespace ScadaHub.Adapters.M100;

/// <summary>解析 ioread.cgi 返回的 {"do":[..],"di":[..],"ai":[..]} JSON。</summary>
public static class M100Reader
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static bool TryParse(string body, out M100Frame frame)
    {
        frame = new M100Frame
        {
            Do = Array.Empty<bool?>(),
            Di = Array.Empty<bool?>(),
            Ai = Array.Empty<int?>(),
        };

        if (string.IsNullOrWhiteSpace(body))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(body, new JsonDocumentOptions
            {
                AllowTrailingCommas = true,
                CommentHandling = JsonCommentHandling.Skip,
            });

            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var warnings = new List<string>();
            var doValues = ParseFlagArray(root, "do", warnings);
            var diValues = ParseFlagArray(root, "di", warnings);
            var aiValues = ParseCurrentArray(root, "ai", warnings);

            frame = new M100Frame
            {
                Do = doValues,
                Di = diValues,
                Ai = aiValues,
                PointWarnings = warnings,
            };
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool?[] ParseFlagArray(JsonElement root, string name, List<string> warnings)
    {
        if (!root.TryGetProperty(name, out var element) || element.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<bool?>();
        }

        var values = new bool?[element.GetArrayLength()];
        var index = 0;
        foreach (var item in element.EnumerateArray())
        {
            values[index] = item.ValueKind switch
            {
                JsonValueKind.Number when item.TryGetInt32(out var raw) && raw is 0 or 1 => raw == 1,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => null,
            };

            if (values[index] is null)
            {
                warnings.Add($"{name}{IndexLabel(index)} 原始值无法解析为 0/1。");
            }

            index++;
        }

        return values;
    }

    private static int?[] ParseCurrentArray(JsonElement root, string name, List<string> warnings)
    {
        if (!root.TryGetProperty(name, out var element) || element.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<int?>();
        }

        var values = new int?[element.GetArrayLength()];
        var index = 0;
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out var raw) && raw >= 0)
            {
                values[index] = raw;
            }
            else
            {
                values[index] = null;
                warnings.Add($"{name}{IndexLabel(index)} 原始值无效（负数或非数值）。");
            }

            index++;
        }

        return values;
    }

    internal static string IndexLabel(int index) => (index + 1).ToString("00");
}
