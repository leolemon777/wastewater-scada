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
    public void EnabledConfiguration_IsRejectedInReadonlyTrial()
    {
        // SPEC 4.3：readonly-trial 版本未授权启用纯水 PLC（正式启用需另行评审）。
        var options = ValidEnabledOptions();
        var result = _validator.Validate(null, options);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Failures!, failure => failure.Contains("readonly-trial"));
    }

    private static PureWaterPlcOptions ValidEnabledOptions() => new()
    {
        Enabled = true,
        IpAddress = "192.168.1.50",
        Port = 5000,
    };
}
