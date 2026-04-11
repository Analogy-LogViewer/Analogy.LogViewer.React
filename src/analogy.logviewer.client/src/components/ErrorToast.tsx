import { useCallback, useEffect, useRef, useState } from "react";
import { errorToastService, type ErrorToastEntry } from "../services/errorToast.service";

const AUTO_DISMISS_MS = 5000;

function ToastItem({ toast, onDismiss }: { toast: ErrorToastEntry; onDismiss: (id: string) => void }) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const remainingRef = useRef<number>(AUTO_DISMISS_MS);
    const startedAtRef = useRef<number>(Date.now());
    const pausedRef = useRef<boolean>(false);
    const [paused, setPaused] = useState(false);

    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;

    const toastIdRef = useRef(toast.id);
    toastIdRef.current = toast.id;

    const startTimerRef = useRef((remaining: number) => {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        startedAtRef.current = Date.now();
        remainingRef.current = remaining;
        timerRef.current = setTimeout(() => {
            onDismissRef.current(toastIdRef.current);
        }, remaining);
    });

    useEffect(() => {
        startTimerRef.current(AUTO_DISMISS_MS);
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        };
    }, []);

    const handleMouseEnter = () => {
        if (pausedRef.current) return;
        pausedRef.current = true;
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        setPaused(true);
    };

    const handleMouseLeave = () => {
        if (!pausedRef.current) return;
        pausedRef.current = false;
        startTimerRef.current(remainingRef.current);
        setPaused(false);
    };

    const hasExtra = toast.extraFields && Object.keys(toast.extraFields).length > 0;

    return (
        <div
            role="alert"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                background: "rgba(30, 20, 20, 0.97)",
                border: "1px solid rgba(220, 38, 38, 0.45)",
                borderRadius: 8,
                boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
                overflow: "hidden",
                minWidth: 320,
                maxWidth: 520,
                pointerEvents: "all",
            }}
        >
            <div style={{ padding: "10px 12px 8px 12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        style={{ flexShrink: 0, marginTop: 2, color: "#ef4444" }}
                    >
                        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <circle cx="10" cy="14" r="0.9" fill="currentColor" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {toast.status !== undefined && (
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#ef4444",
                                        background: "rgba(239,68,68,0.12)",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                        borderRadius: 4,
                                        padding: "0 5px",
                                        lineHeight: "18px",
                                        flexShrink: 0,
                                    }}
                                >
                                    {toast.status}
                                </span>
                            )}
                            <span
                                style={{
                                    fontWeight: 700,
                                    fontSize: 13,
                                    color: "#f8d7d7",
                                    lineHeight: 1.3,
                                    wordBreak: "break-word",
                                }}
                            >
                                {toast.title}
                            </span>
                        </div>

                        {toast.detail && (() => {
                            let parsedJson: unknown = null;
                            let isJson = false;
                            
                            if (toast.detail.trim().startsWith("{") || toast.detail.trim().startsWith("[")) {
                                try {
                                    parsedJson = JSON.parse(toast.detail);
                                    isJson = true;
                                } catch {
                                    // Not valid JSON, render as plain text
                                }
                            }
                            
                            if (isJson && parsedJson) {
                                return (
                                    <pre
                                        style={{
                                            marginTop: 5,
                                            fontSize: 11,
                                            color: "rgba(248,215,215,0.82)",
                                            lineHeight: 1.5,
                                            wordBreak: "break-word",
                                            whiteSpace: "pre-wrap",
                                            fontFamily: "monospace",
                                            background: "rgba(0,0,0,0.25)",
                                            padding: "6px 8px",
                                            borderRadius: 4,
                                            border: "1px solid rgba(239,68,68,0.2)",
                                            margin: 0,
                                            maxHeight: 200,
                                            overflow: "auto",
                                        }}
                                    >
                                        {JSON.stringify(parsedJson, null, 2)}
                                    </pre>
                                );
                            }
                            
                            return (
                                <div
                                    style={{
                                        marginTop: 5,
                                        fontSize: 12,
                                        color: "rgba(248,215,215,0.82)",
                                        lineHeight: 1.45,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {toast.detail}
                                </div>
                            );
                        })()}

                        {toast.instance && (
                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: 11,
                                    color: "rgba(248,215,215,0.5)",
                                    fontFamily: "monospace",
                                    wordBreak: "break-all",
                                }}
                            >
                                {toast.instance}
                            </div>
                        )}

                        {hasExtra && (
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                                {Object.entries(toast.extraFields!).map(([k, v]) => (
                                    <div key={k} style={{ fontSize: 11, color: "rgba(248,215,215,0.6)" }}>
                                        <span style={{ fontWeight: 600 }}>{k}:</span>{" "}
                                        <span style={{ fontFamily: "monospace" }}>
                                            {typeof v === "string" ? v : JSON.stringify(v)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onDismiss(toast.id)}
                        aria-label="Dismiss"
                        title="Dismiss"
                        style={{
                            flexShrink: 0,
                            marginTop: -2,
                            border: "none",
                            background: "transparent",
                            color: "rgba(248,215,215,0.55)",
                            cursor: "pointer",
                            padding: "2px 4px",
                            lineHeight: 1,
                            fontSize: 16,
                            fontWeight: 700,
                            borderRadius: 4,
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>

            <div
                style={{
                    height: 3,
                    background: "rgba(239,68,68,0.18)",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        background: "#ef4444",
                        animation: `errorToastShrink ${AUTO_DISMISS_MS}ms linear forwards`,
                        animationPlayState: paused ? "paused" : "running",
                    }}
                />
            </div>
        </div>
    );
}

export function ErrorToast() {
    const [toasts, setToasts] = useState<ErrorToastEntry[]>([]);

    useEffect(() => {
        return errorToastService.subscribe(setToasts);
    }, []);

    const handleDismiss = useCallback((id: string) => {
        errorToastService.dismiss(id);
    }, []);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                position: "fixed",
                top: 12,
                left: 12,
                zIndex: 9000,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                pointerEvents: "none",
            }}
        >
            <style>{`@keyframes errorToastShrink { from { width: 100%; } to { width: 0%; } }`}</style>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
            ))}
        </div>
    );
}
