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

    const [page, setPage] = useState<"main" | "settings" | "information" | "snapshots" | "debugging" | "patients" | "sessionSummaries" | "applicationLogs">("main");
    const [isLeftFlyPanelOpen, setIsLeftFlyPanelOpen] = useState<boolean>(false);
    const isRunningInWebView2 = Boolean((window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview);
    const pathToPage = (pathname: string): typeof page => {
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

    const pageToPath = (nextPage: typeof page): string => {
        if (nextPage === "settings") return "/settings";
        if (nextPage === "information") return "/information";
        if (nextPage === "applicationLogs") return "/application-logs";
        return "/";
    };

    const navigate = (nextPage: typeof page) => {
        setPage(nextPage);
        const nextPath = pageToPath(nextPage);
        if (window.location.pathname !== nextPath) {
            window.history.pushState(null, "", nextPath);
        }
    };

    useEffect(() => {
        navigate(pathToPage(window.location.pathname));

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

        initializeApp()

        return () => {
            window.removeEventListener("popstate", onPopState);
            window.removeEventListener("keydown", onKeyDown);
            (window as unknown as { chrome?: { webview?: EventTarget } }).chrome?.webview?.removeEventListener?.("message", onWebViewMessage);
        };
    }, []);

    const content = (() => {
        if (page === "settings") {
            return <Settings onBack={() => navigate("main")} />;
        }

        if (page === "information") {
            return <Information onBack={() => navigate("main")} />;
        }

        if (page === "applicationLogs") {
            return <ApplicationLogs onBack={() => navigate("main")} />;
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