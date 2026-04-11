import '@testing-library/jest-dom/vitest';

beforeEach(() => {
    if (!globalThis.fetch) {
        globalThis.fetch = vi.fn();
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});
