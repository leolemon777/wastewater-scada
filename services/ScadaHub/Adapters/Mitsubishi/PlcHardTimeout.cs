namespace ScadaHub.Adapters.Mitsubishi;

internal static class PlcHardTimeout
{
    public static async Task<T> RunAsync<T>(
        string operationName,
        string? address,
        ushort length,
        int timeoutMs,
        Func<T> operation,
        CancellationToken cancellationToken)
    {
        var operationTask = Task.Run(operation, CancellationToken.None);
        using var delayCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var delayTask = Task.Delay(timeoutMs, delayCancellation.Token);
        var completed = await Task.WhenAny(operationTask, delayTask).ConfigureAwait(false);

        if (completed == operationTask)
        {
            await delayCancellation.CancelAsync().ConfigureAwait(false);
            return await operationTask.ConfigureAwait(false);
        }

        cancellationToken.ThrowIfCancellationRequested();
        _ = operationTask.ContinueWith(
            task => _ = task.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
        throw new PlcHardTimeoutException(operationName, timeoutMs, address, length);
    }
}
