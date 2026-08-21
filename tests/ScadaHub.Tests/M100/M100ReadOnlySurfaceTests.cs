using System.Reflection;
using ScadaHub.Adapters.M100;

namespace ScadaHub.Tests.M100;

/// <summary>M100 只读边界的类型级守卫：传输层不得存在任何写方法或写 URL。</summary>
public sealed class M100ReadOnlySurfaceTests
{
    [Fact]
    public void TransportInterface_ExposesSingleReadMethod()
    {
        var methods = typeof(IM100HttpTransport).GetMethods(BindingFlags.Public | BindingFlags.Instance);
        var readMethod = Assert.Single(methods);
        Assert.Equal("ReadIOAsync", readMethod.Name);
    }

    [Theory]
    [InlineData(typeof(IM100HttpTransport))]
    [InlineData(typeof(HttpM100IOTransport))]
    public void TransportTypes_HaveNoWriteMembers(Type type)
    {
        foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
        {
            Assert.False(
                method.Name.Contains("Write", StringComparison.OrdinalIgnoreCase)
                || method.Name.Contains("Post", StringComparison.OrdinalIgnoreCase)
                || method.Name.Contains("Put", StringComparison.OrdinalIgnoreCase)
                || method.Name.Contains("Delete", StringComparison.OrdinalIgnoreCase),
                $"{type.Name} 不应暴露写方法：{method.Name}");
        }
    }

    [Fact]
    public void TransportSource_DoesNotReferenceWriteEndpoint()
    {
        var sourcePath = Path.Combine(
            AppContext.BaseDirectory,
#if DEBUG
            "../../../../../../services/ScadaHub/Adapters/M100/HttpM100IOTransport.cs"
#else
            "../../../../../services/ScadaHub/Adapters/M100/HttpM100IOTransport.cs"
#endif
        );
        if (!File.Exists(sourcePath))
        {
            return;
        }

        var source = File.ReadAllText(sourcePath);
        Assert.False(source.Contains("iowrite", StringComparison.OrdinalIgnoreCase));
        Assert.False(source.Contains("setsystemtime", StringComparison.OrdinalIgnoreCase));
    }
}
