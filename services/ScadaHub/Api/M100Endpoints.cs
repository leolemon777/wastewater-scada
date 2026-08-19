using ScadaHub.Realtime;
using ScadaHub.State;

namespace ScadaHub.Api;

public static class M100Endpoints
{
    public static IEndpointRouteBuilder MapM100Endpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
            "/api/m100/snapshots",
            (M100StateCache cache) => Results.Ok(cache.GetAllSnapshotEnvelopes()));

        endpoints.MapGet(
            "/api/m100/statuses",
            (M100StateCache cache) => Results.Ok(cache.GetStatuses()));

        return endpoints;
    }
}
