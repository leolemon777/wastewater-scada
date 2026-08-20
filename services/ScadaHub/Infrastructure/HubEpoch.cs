namespace ScadaHub.Infrastructure;

/// <summary>
/// Hub 进程标识（SPEC 8.1 sourceEpoch）：进程启动生成，生命周期不变。
/// Hub 重启后 epoch 改变，前端据此重置事件游标（eventSeq 允许从 1 重新开始）。
/// </summary>
public sealed class HubEpoch
{
    public HubEpoch()
    {
        Value = Guid.NewGuid().ToString();
    }

    public string Value { get; }

    /// <summary>每源 eventSeq 分配器（含 hub.heartbeat 的 scada-hub 源）。</summary>
    public SequenceCounter CounterFor(string sourceId) => new(sourceId);

    public sealed class SequenceCounter
    {
        private long _value;

        public SequenceCounter(string sourceId)
        {
            SourceId = sourceId;
        }

        public string SourceId { get; }

        public long Current => Interlocked.Read(ref _value);

        public long Next() => Interlocked.Increment(ref _value);
    }
}

