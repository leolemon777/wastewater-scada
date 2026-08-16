using ScadaHub.Adapters.Mitsubishi;

namespace ScadaHub.Tests.Mitsubishi;

public sealed class PureWaterPlcPointMapTests
{
    [Fact]
    public void XAndY_AreMappedFromArrayIndexToOctalLabels()
    {
        Assert.Equal("X000", PureWaterPlcPointMap.FormatOctalBitAddress('X', 0));
        Assert.Equal("X007", PureWaterPlcPointMap.FormatOctalBitAddress('X', 7));
        Assert.Equal("X010", PureWaterPlcPointMap.FormatOctalBitAddress('X', 8));
        Assert.Equal("X017", PureWaterPlcPointMap.FormatOctalBitAddress('X', 15));
        Assert.Equal("X020", PureWaterPlcPointMap.FormatOctalBitAddress('X', 16));
        Assert.Equal("X027", PureWaterPlcPointMap.FormatOctalBitAddress('X', 23));

        Assert.Equal("Y010", PureWaterPlcPointMap.FormatOctalBitAddress('Y', 8));
        Assert.DoesNotContain("X008", PureWaterPlcPointMap.InputAddresses);
        Assert.DoesNotContain("X009", PureWaterPlcPointMap.InputAddresses);
        Assert.DoesNotContain("Y008", PureWaterPlcPointMap.OutputAddresses);
        Assert.DoesNotContain("Y009", PureWaterPlcPointMap.OutputAddresses);
    }

    [Fact]
    public void ModeBlock_OnlyPublishesReviewedAddresses()
    {
        Assert.Contains("M500", PureWaterPlcPointMap.PublishedModeAddresses);
        Assert.Contains("M510", PureWaterPlcPointMap.PublishedModeAddresses);
        Assert.Contains("M517", PureWaterPlcPointMap.PublishedModeAddresses);
        Assert.DoesNotContain("M503", PureWaterPlcPointMap.PublishedModeAddresses);
        Assert.DoesNotContain("M509", PureWaterPlcPointMap.PublishedModeAddresses);
    }
}
