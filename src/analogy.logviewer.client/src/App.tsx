import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from "react-dom";
import { connectToSignalR, connection } from "./services/realtime.services";
import { StatusToolbar } from "./components/StatusToolbar";
import { Settings } from "./components/Settings";
import { Information } from "./components/Information";
import { ApplicationLogs } from "./components/ApplicationLogs";
import { ecsLogger } from "./services/ecsLogger";
import { ErrorToast } from "./components/ErrorToast";
import './App.css';

const PAGE_STORAGE_KEY = "app_last_page";
const SELECTED_PROVIDER_STORAGE_KEY = "app_selected_provider";
const PAGES = ["main", "settings", "information", "snapshots", "debugging", "patients", "sessionSummaries", "applicationLogs"] as const;
type Page = typeof PAGES[number];

type DataProvider = {
    id: string;
    title?: string | null;
    type?: string | null;
};

type DataProviderFactory = {
    factoryId: string;
    title: string;
    dataProviders: DataProvider[];
};

type SelectedProviderContext = {
    factoryTitle: string;
    providerId: string;
    providerTitle: string;
};

function parseSelectedProviderContext(value: string | null): SelectedProviderContext | null {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        const obj = parsed as Record<string, unknown>;
        const factoryTitle = typeof obj["factoryTitle"] === "string" ? obj["factoryTitle"] : "";
        const providerId = typeof obj["providerId"] === "string" ? obj["providerId"] : "";
        const providerTitle = typeof obj["providerTitle"] === "string" ? obj["providerTitle"] : "";

        if (!providerId) {
            return null;
        }

        return {
            factoryTitle,
            providerId,
            providerTitle,
        };
    } catch {
        return null;
    }
}

function getStringField(obj: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = obj[key];
        if (typeof value === "string") {
            return value;
        }
    }
    return "";
}

function normalizeProvidersResponse(payload: unknown): DataProviderFactory[] {
    if (!Array.isArray(payload)) {
        return [];
    }

    return payload.map((entry): DataProviderFactory => {
        const factoryObj = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        const rawProviders = factoryObj["dataProviders"] ?? factoryObj["DataProviders"] ?? factoryObj["item3"] ?? factoryObj["Item3"];
        const providersArray = Array.isArray(rawProviders) ? rawProviders : [];

        const dataProviders: DataProvider[] = providersArray.map((provider): DataProvider => {
            const providerObj = provider && typeof provider === "object" ? (provider as Record<string, unknown>) : {};
            return {
                id: getStringField(providerObj, ["id", "Id"]),
                title: getStringField(providerObj, ["title", "Title", "optionalTitle", "OptionalTitle"]) || null,
                type: getStringField(providerObj, ["type", "Type"]) || null,
            };
        });

        return {
            factoryId: getStringField(factoryObj, ["factoryId", "FactoryId", "item1", "Item1"]),
            title: getStringField(factoryObj, ["title", "Title", "item2", "Item2"]),
            dataProviders,
        };
    });
}

const initializeApp = async () => {
    await connectToSignalR();
};

function ExternalWindow({ title, children, onClose, windowRef }: { title: string; children: ReactNode; onClose: () => void; windowRef?: { current: Window | null } }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const childWindow = window.open("", "mediamanager-snapshots", "popup=yes,width=1200,height=800");
        if (!childWindow) {
            onClose();
            return;
        }

        if (windowRef) {
            windowRef.current = childWindow;
        }

        childWindow.document.title = title;
        childWindow.document.body.style.margin = "0";

        const theme = document.documentElement.dataset.theme;
        if (theme) {
            childWindow.document.documentElement.dataset.theme = theme;
        }

        const styles = Array.from(document.querySelectorAll("link[rel=\"stylesheet\"], style"));
        for (const style of styles) {
            childWindow.document.head.appendChild(style.cloneNode(true));
        }

        const container = childWindow.document.createElement("div");
        container.style.height = "100vh";
        container.style.width = "100vw";
        childWindow.document.body.appendChild(container);
        containerRef.current = container;
        setReady(true);

        const onBeforeUnload = () => {
            onClose();
        };
        childWindow.addEventListener("beforeunload", onBeforeUnload);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") {
                return;
            }
            onClose();
        };
        childWindow.addEventListener("keydown", onKeyDown);

        const syncTheme = () => {
            const t = document.documentElement.dataset.theme;
            if (t) {
                childWindow.document.documentElement.dataset.theme = t;
            }
        };

        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        return () => {
            observer.disconnect();
            childWindow.removeEventListener("beforeunload", onBeforeUnload);
            childWindow.removeEventListener("keydown", onKeyDown);
            if (windowRef && windowRef.current === childWindow) {
                windowRef.current = null;
            }
            if (!childWindow.closed) {
                childWindow.close();
            }
        };
    }, [onClose, title, windowRef]);

    if (!ready || !containerRef.current) {
        return null;
    }

    return createPortal(children, containerRef.current);
}

function App() {

    const [page, setPage] = useState<Page>("main");
    const [isLeftFlyPanelOpen, setIsLeftFlyPanelOpen] = useState<boolean>(false);
    const [dataProviderFactories, setDataProviderFactories] = useState<DataProviderFactory[]>([]);
    const [isLoadingProviders, setIsLoadingProviders] = useState<boolean>(false);
    const [providersError, setProvidersError] = useState<string>("");
    const [openFactoryId, setOpenFactoryId] = useState<string | null>(null);
    const [selectedProviderContext, setSelectedProviderContext] = useState<SelectedProviderContext | null>(null);
    const isRunningInWebView2 = Boolean((window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview);
    const loadProviders = useCallback(async () => {
        setIsLoadingProviders(true);
        setProvidersError("");

        try {
            const response = await fetch("/api/Logging/GetProviders", { method: "GET" });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => "");
                throw new Error(`${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ""}`);
            }

            const raw = (await response.json()) as unknown;
            const providers = normalizeProvidersResponse(raw);
            setDataProviderFactories(providers);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setProvidersError(errorMessage);
            ecsLogger.error("Failed to load data providers", error);
        } finally {
            setIsLoadingProviders(false);
        }
    }, []);

    const pathToPage = (pathname: string): Page => {
        const normalized = pathname.replace(/\/+$/, "");
        if (normalized === "" || normalized === "/") {
            return "main";
        }
        if (normalized === "/settings") {
            return "settings";
        }
        if (normalized === "/information") {
            return "information";
        }
        if (normalized === "/snapshots") {
            return "snapshots";
        }
        if (normalized === "/simulator") {
            return "debugging";
        }
        if (normalized === "/patients") {
            return "patients";
        }
        if (normalized === "/session-summaries") {
            return "sessionSummaries";
        }
        if (normalized === "/application-logs") {
            return "applicationLogs";
        }
        return "main";
    };

    const pageToPath = (nextPage: Page): string => {
        if (nextPage === "settings") return "/settings";
        if (nextPage === "information") return "/information";
        if (nextPage === "applicationLogs") return "/application-logs";
        return "/";
    };

    const navigate = (nextPage: Page) => {
        setPage(nextPage);
        const nextPath = pageToPath(nextPage);
        if (window.location.pathname !== nextPath) {
            window.history.pushState(null, "", nextPath);
        }
    };

    useEffect(() => {
        try {
            localStorage.setItem(PAGE_STORAGE_KEY, page);
        } catch {
            // ignore storage errors
        }
    }, [page]);

    useEffect(() => {
        try {
            if (!selectedProviderContext) {
                localStorage.removeItem(SELECTED_PROVIDER_STORAGE_KEY);
                return;
            }

            localStorage.setItem(SELECTED_PROVIDER_STORAGE_KEY, JSON.stringify(selectedProviderContext));
        } catch {
            // ignore storage errors
        }
    }, [selectedProviderContext]);

    useEffect(() => {
        let initialPage = pathToPage(window.location.pathname);
        let savedSelection: SelectedProviderContext | null = null;
        try {
            savedSelection = parseSelectedProviderContext(localStorage.getItem(SELECTED_PROVIDER_STORAGE_KEY));
            if (savedSelection) {
                setSelectedProviderContext(savedSelection);
            }
        } catch {
            // ignore storage errors
        }

        if (initialPage === "main" && savedSelection) {
            initialPage = "applicationLogs";
        }

        if (initialPage === "main") {
            try {
                const saved = localStorage.getItem(PAGE_STORAGE_KEY);
                if (saved && (PAGES as readonly string[]).includes(saved)) {
                    initialPage = saved as Page;
                }
            } catch {
                // ignore storage errors
            }
        }
        navigate(initialPage);

        const onPopState = () => {
            setPage(pathToPage(window.location.pathname));
        };

        window.addEventListener("popstate", onPopState);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "p") {
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", onKeyDown);

        const onWebViewMessage = (event: Event) => {
            const payload = (event as MessageEvent).data as unknown;
            if (!payload || typeof payload !== "object") {
                return;
            }

            const p = payload as { type?: unknown; memoryUsageMb?: unknown };
            if (p.type !== "hostProcessMemory") {
                return;
            }

            const mb = Number(p.memoryUsageMb);
            if (!Number.isFinite(mb) || mb < 0) {
                return;
            }
        };

        const webview = (window as unknown as { chrome?: { webview?: EventTarget } }).chrome?.webview;
        webview?.addEventListener?.("message", onWebViewMessage);

        void initializeApp();
        void loadProviders();

        return () => {
            window.removeEventListener("popstate", onPopState);
            window.removeEventListener("keydown", onKeyDown);
            (window as unknown as { chrome?: { webview?: EventTarget } }).chrome?.webview?.removeEventListener?.("message", onWebViewMessage);
        };
    }, [loadProviders]);

    const content = (() => {
        if (page === "main") {
            return (
                <div style={{ padding: 16 }}>
                    <h2 style={{ margin: "0 0 12px 0" }}>Data Providers</h2>
                    {isLoadingProviders && <div>Loading providers...</div>}
                    {!isLoadingProviders && providersError && (
                        <div style={{ color: "var(--danger, #dc2626)", marginBottom: 12 }}>
                            Failed to load providers: {providersError}
                        </div>
                    )}
                    {!isLoadingProviders && !providersError && dataProviderFactories.length === 0 && (
                        <div>No data providers were returned by the server.</div>
                    )}
                    {!isLoadingProviders && !providersError && dataProviderFactories.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                            {dataProviderFactories.map((factory) => (
                                <section
                                    key={factory.factoryId}
                                    style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)", position: "relative" }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setOpenFactoryId((current) => current === factory.factoryId ? null : factory.factoryId)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            border: "1px solid var(--border)",
                                            borderRadius: 8,
                                            background: "var(--surface-1)",
                                            color: "var(--app-text)",
                                            padding: "12px 10px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            fontSize: 14,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span>{factory.title}</span>
                                        <span style={{ fontSize: 12, color: "var(--app-muted-text)" }}>
                                            {factory.dataProviders.length} provider{factory.dataProviders.length === 1 ? "" : "s"}
                                        </span>
                                    </button>

                                    {openFactoryId === factory.factoryId && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: 12,
                                                right: 12,
                                                top: 62,
                                                zIndex: 20,
                                                border: "1px solid var(--border)",
                                                borderRadius: 8,
                                                background: "var(--surface-2)",
                                                boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                                                padding: 8,
                                                maxHeight: 240,
                                                overflowY: "auto",
                                            }}
                                        >
                                            {factory.dataProviders.map((provider) => (
                                                <button
                                                    key={`${factory.factoryId}-${provider.id}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProviderContext({
                                                            factoryTitle: factory.title,
                                                            providerId: provider.id,
                                                            providerTitle: provider.title?.trim() || provider.id,
                                                        });
                                                        setOpenFactoryId(null);
                                                        navigate("applicationLogs");
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        textAlign: "left",
                                                        border: "none",
                                                        borderRadius: 6,
                                                        padding: "8px 10px",
                                                        background: "transparent",
                                                        color: "var(--app-text)",
                                                        cursor: "pointer",
                                                        fontSize: 13,
                                                    }}
                                                >
                                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                                        <span>{provider.title?.trim() || provider.id}</span>
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                padding: "2px 6px",
                                                                borderRadius: 999,
                                                                background: provider.type === "Realtime" ? "#0f766e" : provider.type === "Offline" ? "#1d4ed8" : "#6b7280",
                                                                color: "#fff",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {provider.type || "Unknown"}
                                                        </span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (page === "settings") {
            return <Settings onBack={() => navigate("main")} />;
        }

        if (page === "information") {
            return <Information onBack={() => navigate("main")} />;
        }

        if (page === "applicationLogs") {
            return (
                <ApplicationLogs
                    onBack={() => navigate("main")}
                    selectedFactoryTitle={selectedProviderContext?.factoryTitle ?? ""}
                    selectedProviderId={selectedProviderContext?.providerId ?? ""}
                    selectedProviderTitle={selectedProviderContext?.providerTitle ?? ""}
                />
            );
        }

        return null;
    })();

    return (
        <>
            {page === "main" && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        height: "100vh",
                        zIndex: 2500,
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            width: 280,
                            height: "100%",
                            background: "var(--surface-1)",
                            color: "var(--app-text)",
                            borderRight: "1px solid var(--border)",
                            boxShadow: "6px 0 16px rgba(0,0,0,0.22)",
                            transform: isLeftFlyPanelOpen ? "translateX(0)" : "translateX(-100%)",
                            transition: "transform 240ms ease",
                            pointerEvents: "auto",
                            boxSizing: "border-box",
                            paddingTop: 56,
                        }}
                    >
                        <div style={{ padding: 12 }} />
                    </div>

                    <button
                        type="button"
                        aria-label={isLeftFlyPanelOpen ? "Close panel" : "Open panel"}
                        onClick={() => setIsLeftFlyPanelOpen((v) => !v)}
                        style={{
                            position: "fixed",
                            top: "50%",
                            transform: "translateY(-50%)",
                            left: isLeftFlyPanelOpen ? 280 - 22 : 12,
                            width: 44,
                            height: 44,
                            borderRadius: 999,
                            border: "none",
                            background: "#4A90E2",
                            color: "#FFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                            transition: "left 240ms ease",
                            pointerEvents: "auto",
                            padding: 0,
                        }}
                    >
                        {isLeftFlyPanelOpen ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        ) : (
                            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.9995 11C11.9995 10.4477 12.4472 10 12.9995 10C13.5518 10 13.9995 10.4477 13.9995 11V13C13.9995 13.5523 13.5518 14 12.9995 14L12.992 14L1.00595 14L1 14C0.447715 14 2.87071e-07 13.6083 3.71565e-07 13.125L2.49118e-06 1.00226L0 1L2.49196e-06 0.997744L2.51343e-06 0.875016C2.59711e-06 0.396386 0.439201 0.0075118 0.984198 0.000122831L1 7.62962e-07L12.9967 3.81421e-06L12.9995 0C13.5518 9.65647e-08 13.9995 0.447715 13.9995 1V3C13.9995 3.55229 13.5518 4 12.9995 4C12.4472 4 11.9995 3.55228 11.9995 3V2L2 2L2 12L11.9995 12V11Z" fill="currentColor"/>
                                <path d="M16.0019 11.0002L20.0019 7.00018L16.0019 3.00018V6.00018L8.00195 6.00019C7.44966 6.00019 7.00195 6.4479 7.00195 7.00019C7.00195 7.55247 7.44966 8.00019 8.00195 8.00019L16.0019 8.00018V11.0002Z" fill="currentColor"/>
                            </svg>
                        )}
                    </button>
                </div>
            )}

            <div
                style={{
                    position: "fixed",
                    top: 56,
                    right: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    zIndex: 2000,
                    pointerEvents: "none",
                    maxWidth: 360,
                }}
            >
            </div>

            <StatusToolbar
                activePage={page}
                onOpenSettings={() => navigate("settings")}
                onOpenInformation={() => navigate("information")}
                onOpenApplicationLogs={() => navigate("applicationLogs")}
                applicationLogsActive={page === "applicationLogs"}
            />

            <div style={{ paddingTop: 44, boxSizing: "border-box", height: "100vh" }}>{content}</div>
            <ErrorToast />
        </>
    );
}

export default App;