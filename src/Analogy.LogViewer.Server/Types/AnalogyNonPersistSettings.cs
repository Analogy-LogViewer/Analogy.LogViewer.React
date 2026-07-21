using Microsoft.Win32;

namespace Analogy.LogViewer.Server.Types
{
    public class AnalogyNonPersistSettings
    {
        private static string AnalogyRegistryKey => @"SOFTWARE\Analogy.LogViewer";
        public List<string> AdditionalAssembliesDependenciesLocations { get; }
        public bool DisableUpdatesByDataProvidersOverrides { get; set; }
        public bool DisableUpdateFromRegistry { get; set; }
        public string CurrentLogLayoutFileName { get; } = "AnalogyLogsCurrentLayout.xml";
        public string CurrentLogLayoutName { get; } = "Active Layout";
        public bool UpdateAreDisabled => DisableUpdateFromRegistry || DisableUpdatesByDataProvidersOverrides || CommonUtils.IsRunningFromProgramFileFolder();
        public string AnalogyOrganizationName => "Analogy-LogViewer";
        public string AnalogyRepositoryName => "Analogy.LogViewer";
        private ILogger Logger { get; set; }
        public AnalogyNonPersistSettings(ILogger<AnalogyNonPersistSettings> logger)
        {
            Logger = logger;
            AdditionalAssembliesDependenciesLocations = new List<string>();
            try
            {
                using (RegistryKey? key = Registry.LocalMachine.OpenSubKey(AnalogyRegistryKey))
                {
                    object? updateRegistryValue = key?.GetValue("DisableUpdates");
                    if (updateRegistryValue != null && bool.TryParse(updateRegistryValue.ToString(), out var disable))
                    {
                        logger.LogInformation($"Disable mode: {disable}");
                        DisableUpdateFromRegistry = disable;
                    }
                }
            }
            catch (Exception e)
            {
                Logger.LogError($"Error reading registry: {e}", nameof(AnalogyNonPersistSettings));
            }
        }

        public void AddDependencyLocation(string path)
        {
            if (Directory.Exists(path))
            {
                if (!AdditionalAssembliesDependenciesLocations.Contains(path))
                {
                    AdditionalAssembliesDependenciesLocations.Add(path);
                }
                else
                {
                    Logger.LogWarning($"{path} already exist in dependencies list", nameof(AddDependencyLocation));
                }
            }
            else
            {
                Logger.LogError($"{path} does not exist. Ignoring", nameof(AddDependencyLocation));
            }
        }
    }
}
