using Analogy.Interfaces;
using Analogy.Interfaces.Factories;
using System.Reflection;
using Analogy.LogViewer.Server.Types;

namespace Analogy.LogViewer.Server.Interfaces
{
    public interface IFactoryContainer
    {
        bool AssemblyExist { get; }
        string AssemblyFullPath { get; }
        Assembly Assembly { get; }
        IAnalogyFactory Factory { get; }
        FactorySettings FactorySetting { get; }
        IAnalogyDownloadInformation? DownloadInformation { get; set; }
        List<IAnalogyCustomActionsFactory> CustomActionsFactories { get; }
        List<IAnalogyDataProvidersFactory> DataProvidersFactories { get; }
        List<IAnalogyDataProviderSettings> DataProvidersSettings { get; }
        List<IAnalogyShareableFactory> ShareableFactories { get; }
        List<IAnalogyExtensionsFactory> ExtensionsFactories { get; }
        List<IAnalogyPlotting> GraphPlotter { get; }
        void AddDataProviderFactory(IAnalogyDataProvidersFactory dataProvidersFactory);
        void AddDataProvidersSettings(IAnalogyDataProviderSettings settings);
        void AddCustomActionFactory(IAnalogyCustomActionsFactory action);
        void AddShareableFactory(IAnalogyShareableFactory shareableFactory);
        void AddExtensionFactory(IAnalogyExtensionsFactory extensionFactory);
        void AddGraphPlotter(IAnalogyPlotting plotter);
        void AddDownloadInformation(IAnalogyDownloadInformation downloadInformation);
        string ToString();
        bool ContainsDataProviderOrDataFactory(Guid componentId);
    }
}
