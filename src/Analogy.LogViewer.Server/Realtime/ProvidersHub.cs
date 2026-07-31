using Microsoft.AspNetCore.SignalR;

namespace Analogy.LogViewer.Server.Realtime;

public class ProvidersHub : Hub
{
    public const string ProviderGroupPrefix = "provider:";

    public static string ProviderGroup(Guid providerId) => $"{ProviderGroupPrefix}{providerId:D}";

    public async Task JoinProviderGroup(string providerId)
    {
        if (!Guid.TryParse(providerId, out var id) || id == Guid.Empty)
        {
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, ProviderGroup(id));
    }

    public async Task LeaveProviderGroup(string providerId)
    {
        if (!Guid.TryParse(providerId, out var id) || id == Guid.Empty)
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ProviderGroup(id));
    }
}
