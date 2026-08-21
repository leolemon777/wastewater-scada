namespace ScadaHub;

/// <summary>构建期嵌入的版本信息（SDK SourceRevisionId；缺失时为 unknown）。</summary>
public static class SourceRevision
{
    public static string Commit { get; } =
        typeof(Program).Assembly.GetCustomAttributesData()
            .FirstOrDefault(data => string.Equals(data.AttributeType.Name, "AssemblyMetadataAttribute", StringComparison.Ordinal)
                && data.ConstructorArguments.Count == 2
                && string.Equals(data.ConstructorArguments[0].Value as string, "SourceRevisionId", StringComparison.Ordinal))
            ?.ConstructorArguments[1].Value as string
        ?? "unknown";
}
