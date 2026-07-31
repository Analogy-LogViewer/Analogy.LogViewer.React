import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import { ecsLogger } from "./ecsLogger";

const PIPE_URL = "/providersHub";

export const connection = new HubConnectionBuilder()
    .withUrl(PIPE_URL)
    .withHubProtocol(new MessagePackHubProtocol)
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 2000 })
    .build();

export const connectToSignalR = async () => {
    if (connection.state === HubConnectionState.Connected || connection.state === HubConnectionState.Connecting) {
        return;
    }

    ecsLogger.info(`Connecting to "${PIPE_URL}"`);
    return connection.start().then(() => {
        ecsLogger.info(`Connected to "${PIPE_URL}"`)
        return Promise.resolve();
    }).catch((err: unknown) => ecsLogger.error(`Failed to connect to ${PIPE_URL}`, err))
};

export const joinProviderGroup = async (providerId: string) => {
    if (!providerId) {
        return;
    }
    await connectToSignalR();
    await connection.invoke("JoinProviderGroup", providerId);
};

export const leaveProviderGroup = async (providerId: string) => {
    if (!providerId || connection.state !== HubConnectionState.Connected) {
        return;
    }
    await connection.invoke("LeaveProviderGroup", providerId);
};