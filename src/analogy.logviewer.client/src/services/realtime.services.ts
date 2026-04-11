import { HubConnectionBuilder } from "@microsoft/signalr";
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import { createEffect, createEvent } from "effector"
import { videoRecordingStatus } from "../types/videoRecordingStatus";
import { ecsLogger } from "./ecsLogger";

const PIPE_URL = "/MediaManagerRealtimeData";
const group = 'MediaManager';

export const recordingStatusUpdated = createEvent<videoRecordingStatus>()

export const connection = new HubConnectionBuilder()
    .withUrl(PIPE_URL)
    .withHubProtocol(new MessagePackHubProtocol)
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 2000 })
    .build();

export const connectToSignalR = createEffect(async () => {
    ecsLogger.info(`Connecting to "${PIPE_URL}"`);
    return connection.start().then(() => {
        ecsLogger.info(`Connected to "${PIPE_URL}"`)
        return connection.invoke('AddToGroup', group)
    }).catch((err: unknown) => ecsLogger.error(`Failed to connect to ${PIPE_URL}`, err))
})