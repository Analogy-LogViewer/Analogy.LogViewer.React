using Analogy.Interfaces;
using Analogy.Interfaces.Factories;
using Analogy.LogViewer.Server.Interfaces;
using System.Reflection;

namespace Analogy.LogViewer.Server.Types
{
    public class FactoryContainer : IFactoryContainer
    {
        public bool AssemblyExist => File.Exists(AssemblyFullPath);
        public string AssemblyFullPath { get; }
        public Assembly Assembly { get; }
        public IAnalogyFactory Factory { get; }
        public FactorySettings FactorySetting { get; }
        public IAnalogyDownloadInformation? DownloadInformation { get; set; }
        public List<IAnalogyCustomActionsFactory> CustomActionsFactories { get; }
        public List<IAnalogyDataProvidersFactory> DataProvidersFactories { get; }
        public List<IAnalogyDataProviderSettings> DataProvidersSettings { get; }
        public List<IAnalogyShareableFactory> ShareableFactories { get; }
        public List<IAnalogyExtensionsFactory> ExtensionsFactories { get; }
        public List<IAnalogyPlotting> GraphPlotter { get; }
        public FactoryContainer(Assembly assembly, string assemblyFullPath, IAnalogyFactory factory, FactorySettings factorySetting)
        {
            Assembly = assembly;
            AssemblyFullPath = assemblyFullPath;
            Factory = factory;
            FactorySetting = factorySetting;
            CustomActionsFactories = [];
            DataProvidersFactories = [];
            DataProvidersSettings = [];
            ShareableFactories = new List<IAnalogyShareableFactory>();
            ExtensionsFactories = new List<IAnalogyExtensionsFactory>();
            GraphPlotter = new List<IAnalogyPlotting>();
        }

        public void AddDataProviderFactory(IAnalogyDataProvidersFactory dataProvidersFactory) =>
            DataProvidersFactories.Add(dataProvidersFactory);

        public void AddDataProvidersSettings(IAnalogyDataProviderSettings settings) =>
            DataProvidersSettings.Add(settings);

        public void AddCustomActionFactory(IAnalogyCustomActionsFactory action) => CustomActionsFactories.Add(action);

        public void AddShareableFactory(IAnalogyShareableFactory shareableFactory) =>
            ShareableFactories.Add(shareableFactory);

        public void AddExtensionFactory(IAnalogyExtensionsFactory extensionFactory) =>
            ExtensionsFactories.Add(extensionFactory);
        public void AddGraphPlotter(IAnalogyPlotting plotter) => GraphPlotter.Add(plotter);
        public void AddDownloadInformation(IAnalogyDownloadInformation downloadInformation)
            => DownloadInformation = downloadInformation;
        public override string ToString() => $"{nameof(Factory)}: {Factory}, {nameof(Assembly)}: {Assembly}";

        public bool ContainsDataProviderOrDataFactory(Guid componentId)
        {
            var contains =
            DataProvidersFactories.Any(d =>
                d.FactoryId == componentId ||
                d.DataProviders.Any(dp => dp.Id == componentId));
            return contains;
        }
    }
}
