using Analogy.Interfaces;
using Analogy.Interfaces.Factories;
using Analogy.LogViewer.Server.Interfaces;
using Analogy.LogViewer.Template.Managers;
using System.Reflection;
using static System.Net.Mime.MediaTypeNames;

namespace Analogy.LogViewer.Server.Types
{
    public class FactoriesManager(
        IAnalogyUserSettings settings,
        AnalogyNonPersistSettings analogyNonPersistSettings,
        IAnalogyFoldersAccess foldersAccess,
        NotificationManager notificationManager,
        ILogger<FactoriesManager> logger)
        : IFactoriesManager
    {
        public List<string> ProbingPaths { get; set; } = new List<string>();
        public List<FactoryContainer> Factories { get; } = new();
        private IAnalogyUserSettings Settings { get; } = settings;
        private IAnalogyFoldersAccess FoldersAccess { get; } = foldersAccess;
        private NotificationManager NotificationManager { get; } = notificationManager;
        private bool ExternalAdded { get; set; }
        private ILogger Logger { get; } = logger;
        private AnalogyNonPersistSettings AnalogyNonPersistSettings { get; } = analogyNonPersistSettings;
        private Dictionary<IAnalogyDataProvider, bool> Initialized { get; set; } = new();

        public IEnumerable<(IAnalogyOfflineDataProvider DataProvider, Guid FactoryID)> GetSupportedOfflineDataSources(
            string[] fileNames)
        {
            foreach (var factory in Factories.Where(f => f.FactorySetting.Status != DataProviderFactoryStatus.Disabled))
            {
                foreach (var dataProvidersFactory in factory.DataProvidersFactories)
                {
                    var supported = dataProvidersFactory.DataProviders.Where(i =>
                        i is IAnalogyOfflineDataProvider offline && offline.CanOpenAllFiles(fileNames));
                    foreach (IAnalogyDataProvider dataSource in supported)
                    {
                        yield return (dataSource as IAnalogyOfflineDataProvider, dataProvidersFactory.FactoryId);
                    }
                }
            }
        }
        public IEnumerable<IAnalogyOfflineDataProvider> GetOfflineDataSources(Guid factoryId)
        {
            foreach (var factory in Factories.Where(f => f.FactorySetting.Status != DataProviderFactoryStatus.Disabled))
            {
                foreach (var dataProvidersFactory in factory.DataProvidersFactories)
                {
                    var supported = dataProvidersFactory.DataProviders.Where(i =>
                        dataProvidersFactory.FactoryId == factoryId && i is IAnalogyOfflineDataProvider).Cast<IAnalogyOfflineDataProvider>();
                    foreach (var dataSource in supported)
                    {
                        yield return dataSource;
                    }
                }
            }
        }
        public IEnumerable<IAnalogyOfflineDataProvider> GetSupportedOfflineDataSourcesFromFactory(Guid factoryId,
            string[] fileNames)
        {
            return GetSupportedOfflineDataSources(fileNames).Where(res => res.FactoryID == factoryId)
                .Select(res => res.DataProvider);
        }

        public Assembly? GetAssemblyOfFactory(IAnalogyFactory factory)
            => Factories.SingleOrDefault(f => f.Factory == factory)?.Assembly;
        public List<IAnalogyDataProviderSettings> GetProvidersSettings() => Factories
            .Where(f => f.FactorySetting.Status != DataProviderFactoryStatus.Disabled)
            .SelectMany(f => f.DataProvidersSettings)
            .ToList();


        public List<FactoryContainer> GetFactoryContainer(Guid componentId)
            => Factories.Where(f => f.ContainsDataProviderOrDataFactory(componentId)).ToList();
        public IEnumerable<IAnalogyExtension> GetExtensions(IAnalogyDataProvider dataProvider)
            => GetAllExtensions().Where(e => e.TargetComponentId == dataProvider.Id);

        public IEnumerable<IAnalogyExtension> GetAllExtensions()
        {
            foreach (var factory in Factories)
            {
                if (factory.FactorySetting.Status == DataProviderFactoryStatus.Disabled)
                {
                    continue;
                }

                foreach (var extensionFactory in factory.ExtensionsFactories)
                {
                    foreach (IAnalogyExtension extension in extensionFactory.Extensions)
                    {
                        yield return extension;
                    }
                }
            }
        }
        public IEnumerable<(IAnalogyExtension Extension, Assembly Assembly)> GetAllExtensionsWithAssemblies()
        {
            foreach (var factory in Factories)
            {
                if (factory.FactorySetting.Status == DataProviderFactoryStatus.Disabled)
                {
                    continue;
                }

                foreach (var extensionFactory in factory.ExtensionsFactories)
                {
                    foreach (IAnalogyExtension extension in extensionFactory.Extensions)
                    {
                        yield return (extension, factory.Assembly);
                    }
                }
            }
        }

        public FactoryContainer FactoryContainer(Guid componentId)
            => Factories.FirstOrDefault(f => f.Factory.FactoryId == componentId ||
                                             f.DataProvidersFactories.Any(dpf =>
                                                 dpf.DataProviders.Any(dp => dp.Id == componentId)));

        public void ShutDownAllFactories()
        {
            foreach (FactoryContainer factory in Factories)
            {
                foreach (var provider in factory.DataProvidersFactories)
                {
                    var realTimes = provider.DataProviders.Where(f => f is IAnalogyRealTimeDataProvider)
                        .Cast<IAnalogyRealTimeDataProvider>().ToList();
                    foreach (var realTime in realTimes)
                    {
                        try
                        {
                            realTime.ShutDown().Wait(5000);
                        }
                        catch (Exception e)
                        {
                            Logger.LogError($"Error shutdown {realTime.OptionalTitle}", e, provider.Title);
                        }
                    }
                }
            }
        }

        public async Task InitializeIfNeeded(IAnalogyDataProvider dataProvider)
        {
            if (!Initialized.ContainsKey(dataProvider))
            {
                try
                {
                    await dataProvider.InitializeDataProvider(Logger);
                    Initialized[dataProvider] = true;
                }
                catch (Exception e)
                {
                    Logger.LogError(e, $"Error Initialize Real time provider: {dataProvider.OptionalTitle}: {e.Message}", e);
                }
            }
        }

        public async Task AddExternalDataSources()
        {
            if (ExternalAdded)
            {
                return;
            }

            ExternalAdded = true;
            #region load assemblies
            var analogyAssemblies = Directory.EnumerateFiles(AppDomain.CurrentDomain.BaseDirectory,
                @"*Analogy.LogViewer.*.dll", SearchOption.AllDirectories).ToList();
            if (Settings.AdditionalProbingLocations != null)
            {
                foreach (string folder in Settings.AdditionalProbingLocations)
                {
                    try
                    {
                        if (Directory.Exists(folder))
                        {
                            analogyAssemblies.AddRange(Directory.EnumerateFiles(folder, @"*Analogy.LogViewer.*.dll",
                                SearchOption.TopDirectoryOnly).ToList());
                        }
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"Error probing folder {folder}. Error: {e.Message}", e,
                            nameof(FactoriesManager));
                    }
                }
            }
            #endregion
            #region load types
            var typesToLoad = new List<(Assembly Assembly, string FileName, List<Type> Types)>();
            foreach (string aFile in analogyAssemblies)
            {
                if (aFile.Contains("Analogy.LogViewer.Template"))
                {
                    continue;
                }

                try
                {
                    string fileName = Path.GetFullPath(aFile);
                    string path = Path.GetDirectoryName(aFile);
                    Assembly assembly = Assembly.LoadFrom(fileName);
                    if (!ProbingPaths.Contains(path))
                    {
                        ProbingPaths.Add(path);
                    }

                    var types = assembly.GetTypes().Where(t => !t.IsAbstract).ToList();
                    typesToLoad.Add((assembly, aFile, types));
                }
                catch (Exception e)
                {
                    Logger.LogError(e, $"{aFile}: Error during data providers: {e} ({e.InnerException}. {aFile})", nameof(FactoriesManager));
                }
            }
            #endregion
            #region Load Factories
            foreach ((Assembly assembly, string fileName, List<Type> types) in typesToLoad)
            {
                foreach (var f in types.Where(aType => aType.GetInterface(nameof(IAnalogyFactory)) != null))
                {
                    try
                    {
                        var factory = (Activator.CreateInstance(f) as IAnalogyFactory)!;
                        await factory.InitializeFactory(FoldersAccess, Logger);
                        var setting = Settings.GetOrAddFactorySetting(factory);
                        setting.FactoryName = factory.Title;
                        FactoryContainer fc = new FactoryContainer(assembly, fileName, factory, setting);
                        if (Factories.Exists(fa => fa.Factory.FactoryId == factory.FactoryId))
                        {
                            var toRemove = Factories.FirstOrDefault(fa => fa.Factory.FactoryId == factory.FactoryId);
                            if (toRemove != null)
                            {
                                Factories.Remove(toRemove);
                            }
                        }

                        if (factory.AdditionalProbingLocation != null)
                        {
                            foreach (var path in factory.AdditionalProbingLocation)
                            {
                                AnalogyNonPersistSettings.AddDependencyLocation(path);
                            }
                        }
                        factory.RegisterNotificationCallback(NotificationManager);
                        Factories.Add(fc);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }
            }
            #endregion
            foreach ((Assembly assembly, string fileName, List<Type> types) in typesToLoad)
            {
                foreach (Type dpf in types.Where(aType => aType.GetInterface(nameof(IAnalogyDataProvidersFactory)) != null))
                {
                    try
                    {
                        var dataProviderFactory = (Activator.CreateInstance(dpf) as IAnalogyDataProvidersFactory);
                        if (dataProviderFactory is null)
                        {
                            continue;
                        }
                        var factory = Factories.First(f => f.Factory.FactoryId == dataProviderFactory?.FactoryId);
                        factory.AddDataProviderFactory(dataProviderFactory);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError(
                            $"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})",
                            nameof(FactoriesManager));
                    }
                }

                foreach (Type isettings in types.Where(aType => aType.GetInterface(nameof(IAnalogyDataProviderSettings)) != null))
                {
                    try
                    {
                        var settings = (Activator.CreateInstance(isettings) as IAnalogyDataProviderSettings);
                        if (settings is null)
                        {
                            continue;
                        }
                        var factory = Factories.First(f => f.Factory.FactoryId == settings?.FactoryId);
                        factory.AddDataProvidersSettings(settings);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }

                foreach (Type iaction in types.Where(aType => aType.GetInterface(nameof(IAnalogyCustomActionsFactory)) != null))
                {
                    try
                    {
                        var custom = (Activator.CreateInstance(iaction) as IAnalogyCustomActionsFactory);
                        if (custom is null)
                        {
                            continue;
                        }
                        var factory = Factories.First(f => f.Factory.FactoryId == custom?.FactoryId);
                        factory.AddCustomActionFactory(custom);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }

                foreach (Type ishare in types.Where(aType => aType.GetInterface(nameof(IAnalogyShareableFactory)) != null))
                {
                    try
                    {
                        var share = (Activator.CreateInstance(ishare) as IAnalogyShareableFactory)!;
                        var factory = Factories.First(f => f.Factory.FactoryId == share?.FactoryId);
                        factory.AddShareableFactory(share);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }

                foreach (Type aType in types.Where(aType => aType.GetInterface(nameof(IAnalogyExtensionsFactory)) != null))
                {
                    try
                    {
                        var extension = (Activator.CreateInstance(aType) as IAnalogyExtensionsFactory)!;
                        var factory = Factories.First(f => f.Factory.FactoryId == extension?.FactoryId);
                        factory.AddExtensionFactory(extension);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }

                foreach (Type aType in types.Where(aType => aType.GetInterface(nameof(IAnalogyDownloadInformation)) != null))
                {
                    try
                    {
                        var downloadInfo = (Activator.CreateInstance(aType) as IAnalogyDownloadInformation)!;
                        var factory = Factories.First(f => f.Factory.FactoryId == downloadInfo?.FactoryId);
                        factory.AddDownloadInformation(downloadInfo);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during data providers: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }

                foreach (Type plotter in types.Where(aType => aType.GetInterface(nameof(IAnalogyPlotting)) != null))
                {
                    try
                    {
                        var plot = (Activator.CreateInstance(plotter) as IAnalogyPlotting)!;
                        var factory = Factories.First(f => f.Factory.FactoryId == plot.FactoryId);
                        factory.AddGraphPlotter(plot);
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during plotter loading: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }

                foreach (Type policyType in types.Where(aType => aType.GetInterface(nameof(IAnalogyPolicyEnforcer)) != null))
                {
                    try
                    {
                        var policy = (Activator.CreateInstance(policyType) as IAnalogyPolicyEnforcer)!;
                        if (policy.DisableUpdates)
                        {
                            Logger.LogWarning($"disable Update by: {policyType.FullName}");
                            AnalogyNonPersistSettings.DisableUpdatesByDataProvidersOverrides = true;
                        }
                    }
                    catch (Exception e)
                    {
                        Logger.LogError($"{fileName}: Error during plotter loading: {e} ({e.InnerException}. {fileName})", nameof(FactoriesManager));
                    }
                }
            }
        }
        public IEnumerable<IAnalogyOfflineDataProvider> GetAllOfflineDataSources(IEnumerable<Guid> dataProviders)
        {
            foreach (var fc in Factories)
            {
                if (fc.FactorySetting.Status == DataProviderFactoryStatus.Disabled)
                {
                    continue;
                }
                foreach (var dpf in fc.DataProvidersFactories)
                {
                    IEnumerable<IAnalogyOfflineDataProvider> supported =
                        dpf.DataProviders.Where(d => d is IAnalogyOfflineDataProvider).Cast<IAnalogyOfflineDataProvider>();
                    foreach (var analogyDataSource in supported)
                    {
                        if (dataProviders.Any(dp => dp == analogyDataSource.Id))
                        {
                            yield return analogyDataSource;
                        }
                    }
                }
            }
        }
    }
}
