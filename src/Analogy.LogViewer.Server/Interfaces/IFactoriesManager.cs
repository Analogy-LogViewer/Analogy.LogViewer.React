using Analogy.Interfaces;
using Analogy.Interfaces.Factories;
using Analogy.LogViewer.Server.Types;
using System.Reflection;
using static System.Net.Mime.MediaTypeNames;

namespace Analogy.LogViewer.Server.Interfaces;

public interface IFactoriesManager
{
    List<string> ProbingPaths { get; set; }
    List<FactoryContainer> Factories { get; }
    Task AddExternalDataSources();

    IEnumerable<(IAnalogyOfflineDataProvider DataProvider, Guid FactoryID)> GetSupportedOfflineDataSources(
        string[] fileNames);

    IEnumerable<IAnalogyOfflineDataProvider> GetSupportedOfflineDataSourcesFromFactory(Guid factoryId,
        string[] fileNames);

    IEnumerable<IAnalogyOfflineDataProvider> GetOfflineDataSources(Guid factoryId);

    Assembly? GetAssemblyOfFactory(IAnalogyFactory factory);
    List<IAnalogyDataProviderSettings> GetProvidersSettings();
    List<FactoryContainer> GetFactoryContainer(Guid componentId);
    IEnumerable<IAnalogyExtension> GetExtensions(IAnalogyDataProvider dataProvider);
    IEnumerable<IAnalogyExtension> GetAllExtensions();
    FactoryContainer FactoryContainer(Guid componentId);
    IEnumerable<(IAnalogyExtension Extension, Assembly Assembly)> GetAllExtensionsWithAssemblies();
    void ShutDownAllFactories();
    Task InitializeIfNeeded(IAnalogyDataProvider dataProvider);
    IEnumerable<IAnalogyOfflineDataProvider> GetAllOfflineDataSources(IEnumerable<Guid> dataProviders);
}