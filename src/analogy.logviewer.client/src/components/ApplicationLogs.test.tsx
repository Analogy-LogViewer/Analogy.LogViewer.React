import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/realtime.services', () => {
    return {
        connection: {
            on: vi.fn(),
            off: vi.fn(),
        },
        joinProviderGroup: vi.fn(async () => undefined),
        leaveProviderGroup: vi.fn(async () => undefined),
    };
});

import { ApplicationLogs } from './ApplicationLogs';

describe('ApplicationLogs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uploads picked log file content to the server using multipart form data', async () => {
        const user = userEvent.setup();
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        const providerId = 'c4f14ec2-6b28-456e-a52b-f3d2e69ca8de';
        const { container } = render(
            <ApplicationLogs
                onBack={() => undefined}
                selectedFactoryTitle='Factory A'
                selectedProviderId={providerId}
                selectedProviderTitle='Provider A'
                selectedProviderType='Offline'
            />,
        );

        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).not.toBeNull();

        const file = new File(['2026-10-10 INFO Startup complete'], 'uploaded.log', { type: 'text/plain' });
        await user.upload(fileInput as HTMLInputElement, file);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
        });

        const [requestedUrl, requestOptions] = fetchMock.mock.calls[0]!;
        expect(requestedUrl).toBe('/api/Logging/GetLogFromUpload');
        expect(requestOptions?.method).toBe('POST');
        expect(requestOptions?.body).toBeInstanceOf(FormData);

        const body = requestOptions?.body as FormData;
        const uploadedPart = body.get('file');
        expect(uploadedPart).toBeInstanceOf(File);
        const uploadedFile = uploadedPart as File;
        expect(uploadedFile.name).toBe(file.name);
        expect(uploadedFile.size).toBe(file.size);
        expect(body.get('dataProviderId')).toBe(providerId);
    });
});
