using Analogy.Interfaces;
using Analogy.Interfaces.DataTypes;
using Analogy.Interfaces.Factories;
using Analogy.LogViewer.Server.Interfaces;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace Analogy.LogViewer.Server.Realtime;

public class RealtimeStreamingService(IHubContext<ProvidersHub> hubContext, IFactoriesManager factoriesManager)
{
    private readonly ConcurrentDictionary<Guid, ActiveRealtimeStream> _activeStreams = new();

    public async Task<(bool Ok, string? Error)> StartProviderStream(Guid providerId)
    {
        if (providerId == Guid.Empty)
        {
            return (false, "A valid provider id is required.");
        }

        if (_activeStreams.ContainsKey(providerId))
        {
            return (true, null);
        }

        var realtimeProvider = FindRealtimeProvider(providerId);
        if (realtimeProvider is null)
        {
            return (false, $"Realtime provider not found for id: {providerId}");
        }

        await factoriesManager.InitializeIfNeeded(realtimeProvider);

        EventHandler<AnalogyLogMessageArgs> onMessageReady = (_, args) =>
        {
            _ = BroadcastMessage(providerId, args.Message);
        };
        EventHandler<AnalogyLogMessagesArgs> onManyMessagesReady = (_, args) =>
        {
            foreach (var message in args.Messages)
            {
                _ = BroadcastMessage(providerId, message);
            }
        };

        realtimeProvider.OnMessageReady += onMessageReady;
        realtimeProvider.OnManyMessagesReady += onManyMessagesReady;

        var canStart = await realtimeProvider.CanStartReceiving();
        if (!canStart)
        {
            realtimeProvider.OnMessageReady -= onMessageReady;
            realtimeProvider.OnManyMessagesReady -= onManyMessagesReady;
            return (false, $"Provider {providerId} cannot start receiving.");
        }

        await realtimeProvider.StartReceiving();

        _activeStreams[providerId] = new ActiveRealtimeStream(realtimeProvider, onMessageReady, onManyMessagesReady);
        return (true, null);
    }

    public async Task StopProviderStream(Guid providerId)
    {
        if (!_activeStreams.TryRemove(providerId, out var stream))
        {
            return;
        }

        stream.Provider.OnMessageReady -= stream.OnMessageReady;
        stream.Provider.OnManyMessagesReady -= stream.OnManyMessagesReady;
        await stream.Provider.StopReceiving();
    }

    private async Task BroadcastMessage(Guid providerId, IAnalogyLogMessage message)
    {
        await hubContext.Clients.Group(ProvidersHub.ProviderGroup(providerId))
            .SendAsync("ProviderLogMessage", message);
    }

    private IAnalogyRealTimeDataProvider? FindRealtimeProvider(Guid providerId)
    {
        foreach (var factoryContainer in factoriesManager.Factories)
        {
            foreach (var dataProvidersFactory in factoryContainer.DataProvidersFactories)
            {
                var provider = GetRealtimeProvider(dataProvidersFactory, providerId);
                if (provider is not null)
                {
                    return provider;
                }
            }
        }

        return null;
    }

    private static IAnalogyRealTimeDataProvider? GetRealtimeProvider(IAnalogyDataProvidersFactory dataProvidersFactory, Guid providerId)
    {
        var factoryType = dataProvidersFactory.GetType();

        var getRealtimeProviderMethod = factoryType.GetMethod("GetRealtimeProvider", new[] { typeof(Guid) })
                                       ?? factoryType.GetMethod("GetRealTimeProvider", new[] { typeof(Guid) })
                                       ?? factoryType.GetMethod("GetRealtimeProvider", new[] { typeof(string) })
                                       ?? factoryType.GetMethod("GetRealTimeProvider", new[] { typeof(string) });

        if (getRealtimeProviderMethod is not null)
        {
            var args = getRealtimeProviderMethod.GetParameters().Length == 1 &&
                       getRealtimeProviderMethod.GetParameters()[0].ParameterType == typeof(string)
                ? new object[] { providerId.ToString() }
                : new object[] { providerId };

            var result = getRealtimeProviderMethod.Invoke(dataProvidersFactory, args);
            if (result is IAnalogyRealTimeDataProvider realtimeProviderFromFactory)
            {
                return realtimeProviderFromFactory;
            }
        }

        return dataProvidersFactory.DataProviders
            .FirstOrDefault(dp => dp.Id == providerId && dp is IAnalogyRealTimeDataProvider) as IAnalogyRealTimeDataProvider;
    }

    private sealed record ActiveRealtimeStream(
        IAnalogyRealTimeDataProvider Provider,
        EventHandler<AnalogyLogMessageArgs> OnMessageReady,
        EventHandler<AnalogyLogMessagesArgs> OnManyMessagesReady);
}
