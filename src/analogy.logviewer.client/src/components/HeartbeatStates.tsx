import { useMemo, type CSSProperties } from "react";
import { DaVinciState } from "../types/daVinciState";

function formatEnumName(name: string) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim();
}

type Props = {
    states: Array<DaVinciState | string>;
    connectionAllowed: boolean;
};

export function HeartbeatStateToggles({ states, connectionAllowed }: Props) {
    const stateNamesSet = useMemo(() => {
        const names = (states ?? [])
            .map((s) => {
                if (typeof s === "number") {
                    return DaVinciState[s] ?? String(s);
                }
                return s;
            })
            .filter((s): s is string => typeof s === "string" && s.length > 0);

        return new Set<string>(names);
    }, [states]);

    const enumValues = Object.values(DaVinciState)
        .filter((v): v is number => typeof v === "number")
        .sort((a, b) => a - b);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>Connection allowed:</span>
                    <span
                        style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            lineHeight: "16px",
                            color: "#ffffff",
                            backgroundColor: connectionAllowed ? "var(--success)" : "var(--danger)",
                        }}
                    >
                        {connectionAllowed ? "Allowed" : "Blocked"}
                    </span>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {enumValues.map((value) => {
                    const name = DaVinciState[value];
                    const checked = stateNamesSet.has(name);
                    const displayName = formatEnumName(name);

                    const trackStyle: CSSProperties = {
                        position: "relative",
                        width: 350,
                        height: 20,
                        borderRadius: 999,
                        background: checked
                            ? "linear-gradient(270deg, #1a3fa3 0%, #2152cf 45%, #2f6bff 100%)"
                            : "var(--surface-3)",
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                        display: "flex",
                        alignItems: "center",
                        padding: 4,
                        justifyContent: checked ? "flex-end" : "flex-start",
                        transition: "background 140ms ease, justify-content 140ms ease",
                        flex: "0 0 auto",
                    };

                    const thumbStyle: CSSProperties = {
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        backgroundColor: "var(--surface-2)",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    };

                    const iconColor = checked ? "#16a34a" : "#dc2626";
                    const textColor = checked ? "#ffffff" : "var(--app-text)";

                    return (
                        <label key={value} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span role="switch" aria-checked={checked} aria-label={name} style={trackStyle}>
                                <span
                                    style={{
                                        position: "absolute",
                                        left: "50%",
                                        top: "50%",
                                        transform: "translate(-50%, -50%)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: textColor,
                                        whiteSpace: "nowrap",
                                        pointerEvents: "none",
                                        userSelect: "none",
                                    }}
                                >
                                    {displayName}
                                </span>
                                <span style={thumbStyle}>
                                    {checked ? (
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <path
                                                d="M16.667 5.833L8.333 14.167 3.333 9.167"
                                                stroke={iconColor}
                                                strokeWidth="2.4"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <path
                                                d="M6 6l8 8M14 6l-8 8"
                                                stroke={iconColor}
                                                strokeWidth="2.4"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
