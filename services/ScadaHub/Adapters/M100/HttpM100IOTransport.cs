using System.Net.Http.Headers;
using System.Text;
using ScadaHub.Configuration;

namespace ScadaHub.Adapters.M100;

/// <summary>
/// M100 本机 IO 只读传输。严格只读：仅允许 ioread.cgi 读取，
/// 任何设备写入端点都不属于本接口。
/// </summary>
public interface IM100HttpTransport
{
    Task<M100HttpResponse> ReadIOAsync(CancellationToken cancellationToken);
}

public sealed record M100HttpResponse(
    bool Success,
    int? HttpStatus,
    string? Body,
    string? Error);

public interface IM100HttpTransportFactory
{
    IM100HttpTransport Create(M100DeviceOptions device);
}

/// <summary>基于 HttpClient 的 ioread.cgi 读取实现（Basic 认证 + 双重超时）。</summary>
public sealed class HttpM100IOTransport : IM100HttpTransport, IDisposable
{
    private readonly HttpClient _client;
    private readonly Uri _readUri;

    public HttpM100IOTransport(M100DeviceOptions device)
    {
        if (!Uri.TryCreate($"http://{device.IpAddress}/ioread.cgi?read", UriKind.Absolute, out _readUri!))
        {
            throw new InvalidOperationException($"M100 设备 {device.SourceId} 的 IpAddress 无法构造读取地址。");
        }

        _client = new HttpClient
        {
            Timeout = TimeSpan.FromMilliseconds(Math.Clamp(device.RequestTimeoutMs, 100, 60_000)),
        };

        if (!string.IsNullOrEmpty(device.Username))
        {
            var token = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{device.Username}:{device.Password}"));
            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", token);
        }
    }

    public async Task<M100HttpResponse> ReadIOAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var response = await _client.GetAsync(_readUri, cancellationToken).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

            return response.IsSuccessStatusCode
                ? new M100HttpResponse(true, (int)response.StatusCode, body, null)
                : new M100HttpResponse(
                    false,
                    (int)response.StatusCode,
                    body,
                    DescribeFailure((int)response.StatusCode, device: null));
        }
        catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (exception is TaskCanceledException or HttpRequestException or InvalidOperationException)
        {
            return new M100HttpResponse(false, null, null, exception is TaskCanceledException
                ? $"请求超时（>{_client.Timeout.TotalMilliseconds:0}ms）"
                : exception.Message);
        }
    }

    internal static string DescribeFailure(int statusCode, string? device) => statusCode switch
    {
        401 => "HTTP 401：设备要求登录认证，请在 M100:Devices 配置 Username/Password",
        _ => $"HTTP {statusCode}",
    };

    public void Dispose() => _client.Dispose();
}

public sealed class HttpM100IOTransportFactory : IM100HttpTransportFactory
{
    public IM100HttpTransport Create(M100DeviceOptions device) => new HttpM100IOTransport(device);
}
