using Microsoft.Extensions.Options;
using ScadaHub.Configuration;

namespace ScadaHub.Tests.M100;

public sealed class M100OptionsValidatorTests
{
    private static M100Options ValidOptions() => new()
    {
        Enabled = false,
        Devices = new List<M100DeviceOptions>
        {
            new()
            {
                SourceId = "m100-daf-01",
                Role = "daf",
                IpAddress = "",
                PollIntervalMs = 1000,
                RequestTimeoutMs = 3000,
                FailuresBeforeDisconnect = 2,
            },
        },
    };

    [Fact]
    public void Disabled_WithBlankIpAddress_Passes()
    {
        var result = new M100OptionsValidator().Validate(null, ValidOptions());
        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Enabled_WithoutDevices_Fails()
    {
        var options = new M100Options { Enabled = true, Devices = new List<M100DeviceOptions>() };
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Failures!, failure => failure.Contains("至少配置一台"));
    }

    [Fact]
    public void Enabled_WithBlankIpAddress_Fails()
    {
        var options = ValidOptions();
        options.Enabled = true;
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Failures!, failure => failure.Contains("IpAddress 必须是合法 IPv4"));
    }

    [Theory]
    [InlineData("192.168.0.31")]
    [InlineData("192.168.0.8")]
    [InlineData("192.168.2.80")]
    public void Enabled_WithValidHostAddresses_Passes(string ipAddress)
    {
        var options = ValidOptions();
        options.Enabled = true;
        options.Devices[0].IpAddress = ipAddress;
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("169.254.1.1")]
    [InlineData("0.0.0.0")]
    [InlineData("224.0.0.1")]
    [InlineData("not-an-ip")]
    public void Enabled_WithInvalidAddress_Fails(string ipAddress)
    {
        var options = ValidOptions();
        options.Enabled = true;
        options.Devices[0].IpAddress = ipAddress;
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
    }

    [Fact]
    public void DuplicateSourceIds_Fail()
    {
        var options = ValidOptions();
        options.Devices.Add(new M100DeviceOptions
        {
            SourceId = "m100-daf-01",
            Role = "underground",
        });
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Failures!, failure => failure.Contains("重复 SourceId"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("flow")]
    public void UnknownRole_Fails(string role)
    {
        var options = ValidOptions();
        options.Devices[0].Role = role;
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Failures!, failure => failure.Contains("Role"));
    }

    [Fact]
    public void TooFastPollInterval_Fails()
    {
        var options = ValidOptions();
        options.Devices[0].PollIntervalMs = 499;
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Failures!, failure => failure.Contains("PollIntervalMs"));
    }

    [Fact]
    public void ZeroFailuresBeforeDisconnect_Fails()
    {
        var options = ValidOptions();
        options.Devices[0].FailuresBeforeDisconnect = 0;
        var result = new M100OptionsValidator().Validate(null, options);
        Assert.False(result.Succeeded);
    }
}
