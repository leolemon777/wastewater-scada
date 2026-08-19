using ScadaHub.Realtime;
using ScadaHub.State;

namespace ScadaHub.Api;

public static class PureWaterPlcEndpoints
{
    public static IEndpointRouteBuilder MapPureWaterPlcEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
            "/api/pure-water/plc/snapshot",
            (PureWaterPlcStateCache cache) => Results.Ok(cache.GetSnapshotEnvelope()));

        endpoints.MapGet(
            "/api/pure-water/plc/status",
            (PureWaterPlcStateCache cache) => Results.Ok(cache.GetStatus()));

        endpoints.MapGet(
            "/api/health",
            (PureWaterPlcStateCache cache, M100StateCache m100Cache) => Results.Ok(new
            {
                status = "ok",
                service = "scada-hub",
                readOnly = true,
                pureWaterPlc = cache.GetStatus(),
                m100 = m100Cache.GetStatuses(),
            }));

        endpoints.Map(
            "/ws/scada",
            (HttpContext context, IScadaRealtimePublisher publisher) =>
                publisher.HandleClientAsync(context, context.RequestAborted));

        return endpoints;
    }
}
