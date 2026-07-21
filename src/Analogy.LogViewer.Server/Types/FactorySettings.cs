namespace Analogy.LogViewer.Server.Types
{
    [Serializable]
    public class FactorySettings
    {
        public string FactoryName { get; set; }
        public Guid FactoryId { get; set; }
        public DataProviderFactoryStatus Status { get; set; }

        public FactorySettings(string factoryName, Guid factoryId, DataProviderFactoryStatus status)
        {
            FactoryName = factoryName;
            FactoryId = factoryId;
            Status = status;
        }
        public override string ToString() => $"{nameof(FactoryName)}: {FactoryName}, {nameof(FactoryId)}: {FactoryId}, {nameof(Status)}: {Status}";
    }
}
