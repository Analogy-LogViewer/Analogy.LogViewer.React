import { useEffect } from "react";

import { useTheme } from "../theme/ThemeProvider";

type Props = {
    onBack: () => void;
};

export function Settings({ onBack }: Props) {
    const { mode, setMode } = useTheme();

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onBack();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onBack]);

    return (
        <div style={{ padding: 16, width: "100%", boxSizing: "border-box", color: "var(--app-text)", display: "flex", flexDirection: "column", height: "100%" }}>
            <button
                onClick={onBack}
                type="button"
                aria-label="Close"
                title="Close"
                style={{
                    position: "fixed",
                    top: 56,
                    right: 12,
                    height: 32,
                    width: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    background: "transparent",
                    borderRadius: 6,
                    padding: 0,
                    cursor: "pointer",
                    zIndex: 1100,
                    color: "var(--app-text)",
                }}
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 36 36"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    style={{ display: "block" }}
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M20.1205 18L28.606 9.51446C29.1925 8.92946 29.1925 7.97996 28.606 7.39346C28.021 6.80846 27.0715 6.80846 26.485 7.39346L17.9995 15.879L9.514 7.39346C8.9275 6.80846 7.978 6.80846 7.393 7.39346C6.8065 7.97996 6.8065 8.92946 7.393 9.51446L15.8785 18L7.393 26.4855C6.8065 27.0705 6.8065 28.02 7.393 28.6065C7.6855 28.899 8.0695 29.046 8.4535 29.046C8.8375 29.046 9.22 28.899 9.514 28.6065L17.9995 20.121L26.485 28.6065C26.7775 28.899 27.1615 29.046 27.5455 29.046C27.9295 29.046 28.3135 28.899 28.606 28.6065C29.1925 28.02 29.1925 27.0705 28.606 26.4855L20.1205 18Z"
                        fill="currentColor"
                    />
                </svg>
            </button>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    maxWidth: 520,
                }}
            >
                <div>
                    <div style={{ fontWeight: 600 }}>Theme</div>
                    <div style={{ color: "var(--app-muted-text)", fontSize: 12 }}>Switch between Dark and Light mode.</div>
                </div>
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value === "light" ? "light" : "dark")}
                    style={{
                        height: 32,
                        borderRadius: 6,
                        border: "1px solid var(--chip-border)",
                        background: "var(--control-bg)",
                        color: "var(--control-text)",
                        padding: "0 10px",
                        cursor: "pointer",
                    }}
                >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                </select>
            </div>
        </div>
    );
}