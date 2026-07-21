namespace Analogy.LogViewer.Server.Types
{
    [Serializable]
    public class PreDefineAlert
    {
        public string IncludeText { get; }
        public string ExcludeText { get; }
        public string Sources { get; }
        public string Modules { get; }

        public PreDefineAlert(string includeText, string excludeText, string sources, string modules)
        {
            IncludeText = includeText ?? string.Empty;
            ExcludeText = excludeText ?? string.Empty;
            Sources = sources ?? string.Empty;
            Modules = modules ?? string.Empty;
        }

        public override string ToString()
        {
            return $"Alert: Message Text:{IncludeText}. Exclude:{ExcludeText}. Sources:{Sources}. Modules:{Modules}";
        }
    }
}
