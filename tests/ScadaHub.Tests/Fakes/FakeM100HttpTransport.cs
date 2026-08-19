using ScadaHub.Adapters.M100;
using ScadaHub.Configuration;

namespace ScadaHub.Tests.Fakes;

/// <summary>
/// 旋钮式 M100 HTTP 传输 fake：可切换正常 JSON / 401 / 异常 / 坏 JSON，
/// 并统计读取次数。仅模拟只读 ioread 响应。
/// </summary>
internal sealed class FakeM100HttpTransport : IM100HttpTransport
{
    public string ResponseBody { get; set; } =
        "{\"do\":[1,1],\"di\":[0,0],\"ai\":[9516,0],\"ao\":[]}";

    public int? FailHttpStatus { get; set; }

    public Exception? ThrowException { get; set; }

    public string? InvalidBody { get; set; }

    public int ReadCount { get; private set; }

    public Task<M100HttpResponse> ReadIOAsync(CancellationToken cancellationToken)
    {
        ReadCount++;
        if (ThrowException is not null)
        {
            throw ThrowException;
        }

        if (FailHttpStatus is not null)
        {
            return Task.FromResult(new M100HttpResponse(
                false, FailHttpStatus.Value, null, $"HTTP {FailHttpStatus.Value}"));
        }

        if (InvalidBody is not null)
        {
            return Task.FromResult(new M100HttpResponse(true, 200, InvalidBody, null));
        }

        return Task.FromResult(new M100HttpResponse(true, 200, ResponseBody, null));
    }
}

internal sealed class FakeM100HttpTransportFactory : IM100HttpTransportFactory
{
    private readonly Func<M100DeviceOptions, IM100HttpTransport> _create;

    public FakeM100HttpTransportFactory(Func<M100DeviceOptions, IM100HttpTransport> create)
    {
        _create = create;
    }

    public static FakeM100HttpTransportFactory Single(FakeM100HttpTransport transport)
        => new(_ => transport);

    public IM100HttpTransport Create(M100DeviceOptions device) => _create(device);
}
