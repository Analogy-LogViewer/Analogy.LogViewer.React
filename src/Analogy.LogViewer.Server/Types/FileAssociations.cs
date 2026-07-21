namespace Analogy.LogViewer.Server.Types
{
    public class FileAssociations
    {
        public Guid OfflineDataProviderId { get; set; }
        public IEnumerable<string> Associations { get; set; }

        public FileAssociations(Guid dataProviderId, IEnumerable<string> fileAssociations)
        {
            OfflineDataProviderId = dataProviderId;
            Associations = fileAssociations;
        }

        public void Update(List<string> fileAssociations)
        {
            Associations = fileAssociations;
        }
    }
}
