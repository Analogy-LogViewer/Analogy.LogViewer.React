import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const storageKey = "mediamanager.theme";

function normalizeMode(value: unknown): ThemeMode {
    return value === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setModeState] = useState<ThemeMode>(() => {
        try {
            return normalizeMode(window.localStorage.getItem(storageKey));
        } catch {
            return "dark";
        }
    });

    const setMode = (next: ThemeMode) => {
        setModeState(next);
        try {
            window.localStorage.setItem(storageKey, next);
        } catch {
            // ignore
        }
    };

    const toggle = () => setMode(mode === "dark" ? "light" : "dark");

    useEffect(() => {
        document.documentElement.dataset.theme = mode;
    }, [mode]);

    const value = useMemo<ThemeContextValue>(() => ({ mode, setMode, toggle }), [mode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return ctx;
}
