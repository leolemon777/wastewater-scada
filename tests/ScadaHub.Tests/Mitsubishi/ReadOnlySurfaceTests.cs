using ScadaHub.Adapters.Mitsubishi;

namespace ScadaHub.Tests.Mitsubishi;

public sealed class ReadOnlySurfaceTests
{
    private static readonly string[] ForbiddenFragments =
    {
        "Write",
        "RemoteRun",
        "RemoteStop",
        "SetPlcType",
        "SetDateTime",
    };

    [Fact]
    public void TransportContract_ContainsNoPlcMutationMethods()
    {
        var methodNames = typeof(IMitsubishiPlcTransport)
            .GetMethods()
            .Select(method => method.Name)
            .ToArray();

        foreach (var forbidden in ForbiddenFragments)
        {
            Assert.DoesNotContain(methodNames, name => name.Contains(forbidden, StringComparison.OrdinalIgnoreCase));
        }

        Assert.Contains(nameof(IMitsubishiPlcTransport.ReadBool), methodNames);
        Assert.Contains(nameof(IMitsubishiPlcTransport.ReadUInt16), methodNames);
    }
}
