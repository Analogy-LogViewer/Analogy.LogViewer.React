import { type CSSProperties } from "react";
import { useTheme } from "../theme/ThemeProvider";

export type StatusToolbarProps = {
    activePage: "main" | "settings" | "information" | "snapshots" | "debugging" | "patients" | "sessionSummaries" | "applicationLogs";
    onOpenSettings: () => void;
    onOpenInformation: () => void;
    onOpenApplicationLogs: () => void;
    applicationLogsActive: boolean;
};

export function StatusToolbar(props: StatusToolbarProps) {
    const {
        activePage,
        onOpenSettings,
        onOpenInformation,
        onOpenApplicationLogs,
        applicationLogsActive,
    } = props;
    const { mode, toggle } = useTheme();

    const iconButtonStyle: CSSProperties = {
        height: 26,
        width: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: "1px solid var(--icon-border)",
        background: "var(--icon-bg)",
        color: "var(--app-text)",
        cursor: "pointer",
        padding: 0,
        flex: "0 0 auto",
        position: "relative",
    };

    const activeIconButtonStyle: CSSProperties = {
        border: "1px solid transparent",
    };

    const getIconStyle = (isActive: boolean): CSSProperties => {
        return isActive ? { ...iconButtonStyle, ...activeIconButtonStyle } : iconButtonStyle;
    };

    return (
        <div
            style={{
                position: "fixed",
                left: 0,
                top: 0,
                width: "100%",
                height: 44,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                borderBottom: "1px solid var(--toolbar-border)",
                background: "var(--toolbar-bg)",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <style>{`@property --ring-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@keyframes statusToolbarColorSpin {
  to { --ring-angle: 360deg; }
}

.status-toolbar-icon-button:focus,
.status-toolbar-icon-button:focus-visible,
.status-toolbar-icon-button:active {
  outline: none;
  box-shadow: none;
}

.status-toolbar-icon-button.status-toolbar-icon-button--active::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 10px;
  padding: 2px;
  background: conic-gradient(from var(--ring-angle), #2563eb, #a855f7, #22d3ee, #2563eb);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  animation: statusToolbarColorSpin 2s linear infinite;
  filter: drop-shadow(0 0 8px rgba(37, 99, 235, 0.35)) drop-shadow(0 0 14px rgba(168, 85, 247, 0.25));
}`}</style>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    title={mode === "dark" ? "Light theme" : "Dark theme"}
                    style={{
                        height: 28,
                        width: 64,
                        borderRadius: 999,
                        border: "1px solid rgba(255, 255, 255, 0.22)",
                        background: mode === "dark" ? "var(--icon-bg)" : "#f59e0b",
                        padding: 0,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        position: "relative",
                        flex: "0 0 auto",
                        boxSizing: "border-box",
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 10px",
                            boxSizing: "border-box",
                            color: "rgba(255,255,255,0.95)",
                            pointerEvents: "none",
                            fontSize: 15,
                            lineHeight: "15px",
                        }}
                    >
                        <span style={{ opacity: mode === "light" ? 1 : 0, transition: "opacity 120ms ease" }}>☀</span>
                        <span style={{ opacity: mode === "dark" ? 1 : 0, transition: "opacity 120ms ease" }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: "block" }}>
                                <path
                                    d="M12.8 2.35c-2.05.6-3.55 2.5-3.55 4.74 0 2.71 2.2 4.91 4.91 4.91 1.02 0 1.97-.31 2.75-.84-.7 2.77-3.21 4.82-6.2 4.82-3.53 0-6.39-2.86-6.39-6.39 0-3.01 2.08-5.54 4.88-6.21 1.09-.26 2.23-.26 3.6-.03Z"
                                    fill="#FBBF24"
                                />
                                <path d="M6.2 5.2l.45 1.25 1.25.45-1.25.45-.45 1.25-.45-1.25L4.5 6.9l1.25-.45L6.2 5.2Z" fill="#FBBF24" />
                                <path d="M14.7 4.5l.35.95.95.35-.95.35-.35.95-.35-.95-.95-.35.95-.35.35-.95Z" fill="#FBBF24" />
                                <path d="M15.8 9.4l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4.4-1.1Z" fill="#FBBF24" />
                            </svg>
                        </span>
                    </span>
                    <span
                        aria-hidden="true"
                        style={{
                            height: 22,
                            width: 22,
                            borderRadius: 999,
                            background: "#fff",
                            border: "1px solid rgba(0,0,0,0.10)",
                            marginLeft: mode === "dark" ? 3 : 39,
                            transition: "margin-left 160ms ease",
                            boxSizing: "border-box",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                        }}
                    />
                </button>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <button
                    type="button"
                    onClick={onOpenApplicationLogs}
                    style={getIconStyle(applicationLogsActive)}
                    className={`status-toolbar-icon-button${applicationLogsActive ? " status-toolbar-icon-button--active" : ""}`}
                    title="Application Logs"
                    aria-label="Application Logs"
                    id="toolbar-application-logs-button"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ display: "block" }}
                    >
                        <path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h10v2H4v-2zm0 4h8v2H4v-2z" fill="currentColor" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={onOpenInformation}
                    style={getIconStyle(activePage === "information")}
                    className={`status-toolbar-icon-button${activePage === "information" ? " status-toolbar-icon-button--active" : ""}`}
                    title="Information"
                    aria-label="Information"
                    id="toolbar-information-button"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ display: "block" }}
                    >
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 10.5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="7.5" r="1" fill="currentColor" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={onOpenSettings}
                    style={getIconStyle(activePage === "settings")}
                    className={`status-toolbar-icon-button${activePage === "settings" ? " status-toolbar-icon-button--active" : ""}`}
                    title="Settings"
                    aria-label="Settings"
                    id="toolbar-settings-button"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ display: "block" }}
                    >
                        <path
                            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.16.09a2 2 0 0 1-1.99 0l-.16-.09a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.18a2 2 0 0 1-1 1.73l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.16-.09a2 2 0 0 1 1.99 0l.16.09a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.16-.09a2 2 0 0 1 1.99 0l.16.09a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.18a2 2 0 0 1 1-1.73l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.16.09a2 2 0 0 1-1.99 0l-.16-.09a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </button>
                </div>
            </div>
        </div>
    );
}
