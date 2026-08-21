namespace ScadaHub.Infrastructure;

/// <summary>
/// 设备 IO 硬门禁（SPEC-PLAN 11.2）。
/// 直接读取进程环境变量与宿主环境，不进入普通 IConfiguration，因此不可能被
/// local JSON、环境配置节或命令行参数覆盖。Testing 环境恒为抑制。
/// </summary>
public sealed class DeviceIoGate
{
    public const string DisableEnvironmentVariable = "SCADA_DISABLE_ALL_DEVICE_IO";

    public DeviceIoGate(bool ioSuppressed)
    {
        IoSuppressed = ioSuppressed;
    }

    public bool IoSuppressed { get; }

    public static DeviceIoGate FromEnvironment(IHostEnvironment environment)
    {
        var suppressed = environment.IsEnvironment("Testing")
            || Environment.GetEnvironmentVariable(DisableEnvironmentVariable) == "1";
        return new DeviceIoGate(suppressed);
    }
}
