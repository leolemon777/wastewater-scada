using Microsoft.AspNetCore.Http;

namespace ScadaHub.Realtime;

public interface IScadaRealtimePublisher
{
    Task BroadcastAsync(object message, CancellationToken cancellationToken);
    Task HandleClientAsync(HttpContext context, CancellationToken cancellationToken);
}
