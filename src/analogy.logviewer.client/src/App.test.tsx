import { render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { ArgoState } from './types/argoState';

type Handler = (...args: unknown[]) => void;

type RealtimeMocks = {
    handlers: Map<string, Handler>;
    connectToSignalR: ReturnType<typeof vi.fn>;
    connection: {
        on: ReturnType<typeof vi.fn>;
        off: ReturnType<typeof vi.fn>;
    };
};

const realtime = vi.hoisted((): RealtimeMocks => {
    const handlers = new Map<string, Handler>();
    const connection = {
        on: vi.fn((eventName: string, cb: Handler) => {
            handlers.set(eventName, cb);
        }),
        off: vi.fn((eventName: string, cb: Handler) => {
            if (handlers.get(eventName) === cb) {
                handlers.delete(eventName);
            }
        }),
    };

    return {
        handlers,
        connectToSignalR: vi.fn(async () => undefined),
        connection,
    };
});

vi.mock('./services/realtime.services', () => {
    return {
        connectToSignalR: realtime.connectToSignalR,
        connection: realtime.connection,
    };
});

describe('App', () => {
    let configSystemType: string;

    beforeEach(() => {
        configSystemType = 'Argo';
        // Setup:
        // - App fetches configuration on mount via `/api/Operations/GetConfiguration`.
        // - We stub fetch so the component can initialize without making a real network call.
        const fetchImpl = vi.fn(async () => {
            return {
                ok: true,
                json: async () => ({ systemType: configSystemType }),
                text: async () => '',
                status: 200,
                statusText: 'OK',
            } as unknown as Response;
        });

        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchImpl as unknown as typeof fetch);
    });

    it('renders Argo heartbeat states and updates toggle when NotifyArgoHeartbeatState is received', async () => {
        // Purpose:
        // - Validate the integration between SignalR and the Argo heartbeat UI: when the Hub publishes an
        //   Argo heartbeat state (`NotifyArgoHeartbeatState`), the relevant toggle is turned on.
        //
        // Test notes:
        // - App registers SignalR handlers via `connection.on(...)`.
        // - We mock `./services/realtime.services` and capture the registered handler so the test can
        //   trigger it synchronously.
        // - `ArgoHeartbeatStateToggles` renders each state as `role="switch"` with `aria-label` equal
        //   to the enum name (e.g. `InProcedure`).
        render(
            <ThemeProvider>
                <App />
            </ThemeProvider>,
        );

        await waitFor(() => {
            expect(realtime.connection.on).toHaveBeenCalledWith('NotifyArgoHeartbeatState', expect.any(Function));
        });

        const inProcedureToggle = await screen.findByRole('switch', { name: 'InProcedure' });
        expect(inProcedureToggle).toHaveAttribute('aria-checked', 'false');

        const notifyArgoHeartbeatState = realtime.handlers.get('NotifyArgoHeartbeatState');
        expect(notifyArgoHeartbeatState).toBeTypeOf('function');

        act(() => {
            notifyArgoHeartbeatState?.([[ArgoState.InProcedure], true]);
        });

        await waitFor(() => {
            expect(screen.getByRole('switch', { name: 'InProcedure' })).toHaveAttribute('aria-checked', 'true');
        });
    });

    it('increments snapshots badge when PublishSnapshot is received (Argo)', async () => {
        configSystemType = 'Argo';
        // Purpose:
        // - Validate the main integration between SignalR and the UI: when the Hub publishes a snapshot
        //   (`PublishSnapshot`), the `StatusToolbar` snapshots badge count increases.
        //
        // Test notes:
        // - App registers SignalR handlers via `connection.on(...)`.
        // - We mock `./services/realtime.services` and capture the registered handler so the test can
        //   trigger it synchronously.
        // - `StatusToolbar` uses `useTheme()`, so App must be rendered inside `ThemeProvider`.

        // Arrange:
        // - Render App.
        // - Wait until App has subscribed to `PublishSnapshot`.
        render(
            <ThemeProvider>
                <App />
            </ThemeProvider>,
        );

        await waitFor(() => {
            expect(realtime.connection.on).toHaveBeenCalledWith('PublishSnapshot', expect.any(Function));
        });

        const snapshotsButtons = screen.getAllByRole('button', { name: 'Snapshots' });
        expect(snapshotsButtons.length).toBeGreaterThan(0);
        const snapshotsButton = snapshotsButtons[0];
        const snapshotsContainer = snapshotsButton.parentElement;
        expect(snapshotsContainer).not.toBeNull();

        // Assert initial state:
        // - Badge is not shown when snapshots count is 0.
        expect(within(snapshotsContainer as HTMLElement).queryByText('1')).toBeNull();

        const publishSnapshot = realtime.handlers.get('PublishSnapshot');
        expect(publishSnapshot).toBeTypeOf('function');

        // Act:
        // - Trigger `PublishSnapshot` with a snapshot payload.
        act(() => {
            publishSnapshot?.({
                Id: 'snapshot-1',
                SystemSnapshotId: 'system-1',
                Time: new Date('2026-01-01T12:00:00Z').toISOString(),
                MediaType: 'Png',
                Content: new Uint8Array([1, 2, 3]),
                DuringActiveRecording: false,
                Restricted: false,
                SnapshotSource: 'UnitTest',
                Properties: {},
            });
        });

        // Assert:
        // - Badge count increments to 1.
        await waitFor(() => {
            expect(within(snapshotsContainer as HTMLElement).getByText('1')).toBeInTheDocument();
        });

        // Act:
        // - Trigger a second snapshot publish.
        act(() => {
            publishSnapshot?.({
                Id: 'snapshot-2',
                SystemSnapshotId: 'system-2',
                Time: new Date('2026-01-01T12:00:01Z').toISOString(),
                MediaType: 'Png',
                Content: new Uint8Array([4, 5, 6]),
                DuringActiveRecording: false,
                Restricted: false,
                SnapshotSource: 'UnitTest',
                Properties: {},
            });
        });

        // Assert:
        // - Badge count increments to 2.
        await waitFor(() => {
            expect(within(snapshotsContainer as HTMLElement).getByText('2')).toBeInTheDocument();
        });
    });

    it('increments snapshots badge when PublishSnapshot is received (DaVinciGen5)', async () => {
        configSystemType = 'DaVinciGen5';
        // Purpose:
        // - Validate the main integration between SignalR and the UI: when the Hub publishes a snapshot
        //   (`PublishSnapshot`), the `StatusToolbar` snapshots badge count increases.
        //
        // Test notes:
        // - App registers SignalR handlers via `connection.on(...)`.
        // - We mock `./services/realtime.services` and capture the registered handler so the test can
        //   trigger it synchronously.
        // - `StatusToolbar` uses `useTheme()`, so App must be rendered inside `ThemeProvider`.

        // Arrange:
        // - Render App.
        // - Wait until App has subscribed to `PublishSnapshot`.
        render(
            <ThemeProvider>
                <App />
            </ThemeProvider>,
        );

        await waitFor(() => {
            expect(realtime.connection.on).toHaveBeenCalledWith('PublishSnapshot', expect.any(Function));
        });

        const snapshotsButtons = screen.getAllByRole('button', { name: 'Snapshots' });
        expect(snapshotsButtons.length).toBeGreaterThan(0);
        const snapshotsButton = snapshotsButtons[0];
        const snapshotsContainer = snapshotsButton.parentElement;
        expect(snapshotsContainer).not.toBeNull();

        // Assert initial state:
        // - Badge is not shown when snapshots count is 0.
        expect(within(snapshotsContainer as HTMLElement).queryByText('1')).toBeNull();

        const publishSnapshot = realtime.handlers.get('PublishSnapshot');
        expect(publishSnapshot).toBeTypeOf('function');

        // Act:
        // - Trigger `PublishSnapshot` with a snapshot payload.
        act(() => {
            publishSnapshot?.({
                Id: 'snapshot-1',
                SystemSnapshotId: 'system-1',
                Time: new Date('2026-01-01T12:00:00Z').toISOString(),
                MediaType: 'Png',
                Content: new Uint8Array([1, 2, 3]),
                DuringActiveRecording: false,
                Restricted: false,
                SnapshotSource: 'UnitTest',
                Properties: {},
            });
        });

        // Assert:
        // - Badge count increments to 1.
        await waitFor(() => {
            expect(within(snapshotsContainer as HTMLElement).getByText('1')).toBeInTheDocument();
        });

        // Act:
        // - Trigger a second snapshot publish.
        act(() => {
            publishSnapshot?.({
                Id: 'snapshot-2',
                SystemSnapshotId: 'system-2',
                Time: new Date('2026-01-01T12:00:01Z').toISOString(),
                MediaType: 'Png',
                Content: new Uint8Array([4, 5, 6]),
                DuringActiveRecording: false,
                Restricted: false,
                SnapshotSource: 'UnitTest',
                Properties: {},
            });
        });

        // Assert:
        // - Badge count increments to 2.
        await waitFor(() => {
            expect(within(snapshotsContainer as HTMLElement).getByText('2')).toBeInTheDocument();
        });
    });
});
