type WebView2 = {
    postMessage?: (message: unknown) => void;
};

type WebView2Window = Window & {
    chrome?: {
        webview?: WebView2;
    };
};

type EcsLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

type EcsLogEvent = {
    "@timestamp": string;
    message: string;
    ecs: {
        version: string;
    };
    log: {
        level: EcsLogLevel;
    };
    event?: {
        dataset?: string;
    };
    labels?: Record<string, string>;
    tags?: string[];
    error?: {
        message?: string;
        stack_trace?: string;
        type?: string;
    };
};

const getWebView2 = (): WebView2 | undefined => {
    return (window as WebView2Window).chrome?.webview;
};

const isWebView2 = (): boolean => {
    return Boolean(getWebView2()?.postMessage);
};

const serializeUnknown = (value: unknown): string => {
    if (value instanceof Error) {
        return value.message;
    }

    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const buildEcsEvent = (level: EcsLogLevel, message: string, error?: unknown, extra?: Record<string, unknown>): EcsLogEvent & Record<string, unknown> => {
    const base: EcsLogEvent & Record<string, unknown> = {
        "@timestamp": new Date().toISOString(),
        message,
        ecs: {
            version: "8.11.0",
        },
        log: {
            level,
        },
        event: {
            dataset: "mediamanager.client",
        },
    };

    if (error instanceof Error) {
        base.error = {
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
        };
    } else if (error != null) {
        base.error = {
            message: serializeUnknown(error),
        };
    }

    if (extra && Object.keys(extra).length > 0) {
        Object.assign(base, extra);
    }

    return base;
};

const emitToWebView2 = (event: Record<string, unknown>) => {
    const webview = getWebView2();
    webview?.postMessage?.({ type: "ecsLog", payload: event });
};

export const ecsLogger = {
    isEnabled: (): boolean => isWebView2(),

    info: (message: string, extra?: Record<string, unknown>) => {
        console.log(message);
        if (!isWebView2()) {
            return;
        }
        emitToWebView2(buildEcsEvent("info", message, undefined, extra));
    },

    warn: (message: string, extra?: Record<string, unknown>) => {
        console.warn(message);
        if (!isWebView2()) {
            return;
        }
        emitToWebView2(buildEcsEvent("warn", message, undefined, extra));
    },

    error: (message: string, error?: unknown, extra?: Record<string, unknown>) => {
        console.error(message, error);
        if (!isWebView2()) {
            return;
        }
        emitToWebView2(buildEcsEvent("error", message, error, extra));
    },
};
