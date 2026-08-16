using ScadaHub.Configuration;

namespace ScadaHub.Tests.Configuration;

public sealed class PureWaterPlcOptionsValidatorTests
{
    private readonly PureWaterPlcOptionsValidator _validator = new();

    [Fact]
    public void DisabledDefaultConfiguration_AllowsBlankIp()
    {
        var result = _validator.Validate(null, new PureWaterPlcOptions());
        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("192.168.0.13")]
    [InlineData("192.168.2.74")]
    [InlineData("0.0.0.0")]
    [InlineData("127.0.0.1")]
    [InlineData("169.254.10.20")]
    [InlineData("192.168.1.0")]
    [InlineData("192.168.1.255")]
    [InlineData("239.1.2.3")]
    [InlineData("not-an-ip")]
    public void EnabledConfiguration_RejectsReservedOrInvalidAddresses(string ipAddress)
    {
        var options = ValidEnabledOptions();
        options.IpAddress = ipAddress;

        var result = _validator.Validate(null, options);

        Assert.True(result.Failed);
    }

    [Fact]
    public void EnabledConfiguration_AcceptsReviewedPlcDataSubnetAndPort()
    {
        var result = _validator.Validate(null, ValidEnabledOptions());
        Assert.True(result.Succeeded);
    }

    private static PureWaterPlcOptions ValidEnabledOptions() => new()
    {
        Enabled = true,
        IpAddress = "192.168.1.50",
        Port = 5000,
    };
}
