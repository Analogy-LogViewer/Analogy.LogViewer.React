type ProblemDetails = {
    title?: string;
    detail?: string;
    status?: number;
    instance?: string;
    type?: string;
    [key: string]: unknown;
};

export type ErrorToastEntry = {
    id: string;
    title: string;
    detail?: string;
    status?: number;
    instance?: string;
    extraFields?: Record<string, unknown>;
};

type Listener = (toasts: ErrorToastEntry[]) => void;

function tryParseProblemDetails(body: string): ProblemDetails | null {
    try {
        const parsed = JSON.parse(body) as unknown;
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            if (typeof obj["title"] === "string" || typeof obj["detail"] === "string" || typeof obj["status"] === "number") {
                return obj as ProblemDetails;
            }
        }
    } catch {
    }
    return null;
}

function extractExtraFields(pd: ProblemDetails): Record<string, unknown> | undefined {
    const known = new Set(["title", "detail", "status", "instance", "type"]);
    const extra: Record<string, unknown> = {};
    for (const key of Object.keys(pd)) {
        if (!known.has(key)) {
            extra[key] = pd[key];
        }
    }
    return Object.keys(extra).length > 0 ? extra : undefined;
}

let toasts: ErrorToastEntry[] = [];
const listeners = new Set<Listener>();

function notify() {
    for (const listener of listeners) {
        listener([...toasts]);
    }
}

function generateId(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}

export const errorToastService = {
    subscribe(listener: Listener): () => void {
        listeners.add(listener);
        listener([...toasts]);
        return () => {
            listeners.delete(listener);
        };
    },

    show(title: string, detail?: string, status?: number, instance?: string, extraFields?: Record<string, unknown>): string {
        const id = generateId();
        toasts = [...toasts, { id, title, detail, status, instance, extraFields }];
        notify();
        return id;
    },

    showFromResponse(statusText: string, status: number, body: string): string {
        const pd = tryParseProblemDetails(body);
        if (pd) {
            return errorToastService.show(
                pd.title ?? statusText,
                pd.detail,
                pd.status ?? status,
                typeof pd.instance === "string" ? pd.instance : undefined,
                extractExtraFields(pd),
            );
        }
        return errorToastService.show(
            `${status} ${statusText}`,
            body || undefined,
        );
    },

    showFromError(error: unknown): string {
        const message = error instanceof Error ? error.message : String(error);
        return errorToastService.show("Error", message);
    },

    dismiss(id: string): void {
        toasts = toasts.filter((t) => t.id !== id);
        notify();
    },

    dismissAll(): void {
        toasts = [];
        notify();
    },
};
