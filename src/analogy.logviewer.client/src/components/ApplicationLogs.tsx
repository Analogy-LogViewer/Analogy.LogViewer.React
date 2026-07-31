import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ANALOGY_LOG_LEVEL, type AnalogyLogLevel, type AnalogyLogMessage } from "../types/analogyLogMessage";
import { connection, joinProviderGroup, leaveProviderGroup } from "../services/realtime.services";
import { ecsLogger } from "../services/ecsLogger";

const DEFAULT_LOG_PATH = "C:\\MVD2\\Logs\\ECS\\";
const FILE_PATH_STORAGE_KEY = "appLogs_filePath";

type Props = {
    onBack: () => void;
    selectedFactoryTitle: string;
    selectedProviderId: string;
    selectedProviderTitle: string;
    selectedProviderType: string;
};

type SortKey = "date" | "processId" | "text" | "level" | "module" | "source" | "user" | "threadId" | "machineName" | "rawText" | "lineNumber";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; width: number; mono?: boolean }[] = [
    { key: "date",        label: "Date",          width: 172 },
    { key: "processId",   label: "Process ID",    width: 80  },
    { key: "text",        label: "Text",          width: 340, mono: true },
    { key: "level",       label: "Level",         width: 76  },
    { key: "module",      label: "Process/Module",width: 130, mono: true },
    { key: "source",      label: "Source",        width: 110, mono: true },
    { key: "user",        label: "User",          width: 70  },
    { key: "threadId",    label: "Thread ID",     width: 80  },
    { key: "machineName", label: "Machine Name",  width: 120 },
    { key: "rawText",     label: "Raw Text",      width: 140, mono: true },
    { key: "lineNumber",  label: "Line Num",      width: 72  },
];

function getLevelLabel(level: unknown): string {
    if (typeof level === "string") return level;
    if (typeof level === "number") return ANALOGY_LOG_LEVEL[level as AnalogyLogLevel] ?? String(level);
    return String(level);
}

function getLevelColor(level: unknown): string {
    const label = getLevelLabel(level).toLowerCase();
    if (label === "error") return "var(--danger, #dc2626)";
    if (label === "critical") return "#7c3aed";
    if (label === "warning") return "var(--warning, #d97706)";
    if (label === "information") return "inherit";
    return "inherit";
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        if (!Number.isFinite(d.getTime())) return iso;
        const ms = String(d.getMilliseconds()).padStart(3, "0");
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour12: false })}.${ms}`;
    } catch {
        return iso;
    }
}

function Highlight({ text, query }: { text: string; query: string }) {
    if (!query || !text) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <mark style={{ background: "#ca8a04", color: "#fff", borderRadius: 2, padding: "0 1px" }}>
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    );
}

function JsonNode({ data, depth = 0, keyName }: { data: unknown; depth?: number; keyName?: string }) {
    const [open, setOpen] = useState(depth < 3);
    const isArr = Array.isArray(data);
    const isObj = !isArr && data !== null && typeof data === "object";

    if (!isArr && !isObj) {
        let color = "inherit";
        let text = String(data);
        if (data === null) { color = "#9ca3af"; text = "null"; }
        else if (typeof data === "string") { color = "#ca8a04"; text = `"${data}"`; }
        else if (typeof data === "number") { color = "#16a34a"; }
        else if (typeof data === "boolean") { color = "#7c3aed"; }
        return (
            <div style={{ paddingLeft: depth * 14, lineHeight: "19px", fontSize: 12 }}>
                {keyName !== undefined && <span style={{ color: "#4b7cf3" }}>{keyName}: </span>}
                <span style={{ color }}>{text}</span>
            </div>
        );
    }

    const entries: [string, unknown][] = isArr
        ? (data as unknown[]).map((v, i) => [String(i), v])
        : Object.entries(data as Record<string, unknown>);

    return (
        <div style={{ paddingLeft: depth * 14 }}>
            <div
                style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", lineHeight: "19px", fontSize: 12, userSelect: "none" }}
                onClick={() => setOpen(o => !o)}
            >
                <span style={{ color: "#6b7280", fontSize: 9, width: 10, flexShrink: 0 }}>{open ? "▼" : "▶"}</span>
                {keyName !== undefined && <span style={{ color: "#4b7cf3" }}>{keyName}</span>}
                {!open && <span style={{ color: "#9ca3af" }}>&nbsp;{isArr ? `[${entries.length}]` : `{${entries.length}}`}</span>}
            </div>
            {open && entries.map(([k, v]) => (
                <JsonNode key={k} data={v} depth={depth + 1} keyName={isArr ? undefined : k} />
            ))}
        </div>
    );
}

type DetailTab = "formatted" | "messageText" | "additional" | "rawText";

type LogDetailModalProps = {
    msg: AnalogyLogMessage;
    index: number;
    total: number;
    logFilePath: string;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
};

function LogDetailModal({ msg, index, total, logFilePath, onClose, onPrev, onNext }: LogDetailModalProps) {
    const [tab, setTab] = useState<DetailTab>("formatted");

    useEffect(() => {
        const handle = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") onPrev();
            else if (e.key === "ArrowRight") onNext();
            else if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handle);
        return () => document.removeEventListener("keydown", handle);
    }, [onPrev, onNext, onClose]);

    const levelLabel = getLevelLabel(msg.level);
    const rawText = msg.rawText ?? "";
    const isJsonByType = msg.rawTextType === 4 || msg.rawTextType === "JSON";

    let parsedJson: unknown = null;
    if (rawText) {
        try { parsedJson = JSON.parse(rawText); } catch { /* not JSON */ }
    }
    const showJson = parsedJson !== null && (isJsonByType || rawText.trimStart().startsWith("{") || rawText.trimStart().startsWith("["));

    const metaFields: [string, string | number | null | undefined][] = [
        ["Machine Name",         msg.machineName],
        ["Log file / Data source", logFilePath],
        ["Date",                 formatTime(msg.date ?? "")],
        ["Source",               msg.source],
        ["Process /Module",      msg.module],
        ["Process Id",           msg.processId || ""],
        ["Thread Id",            msg.threadId || ""],
        ["Log Level",            levelLabel],
        ["Method",               msg.methodName],
        ["Source Code FileName", msg.fileName],
        ["Line Number",          msg.lineNumber || ""],
        ["User",                 msg.user],
    ];

    const labelCell: CSSProperties = {
        padding: "3px 8px", borderRight: "1px solid var(--border, #e5e7eb)",
        borderBottom: "1px solid var(--border, #e5e7eb)", background: "var(--surface-1, #f3f4f6)",
        fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
    };
    const valueCell: CSSProperties = {
        padding: "3px 8px", borderBottom: "1px solid var(--border, #e5e7eb)",
        fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    };
    const tabBtn = (t: DetailTab, label: string) => (
        <button key={t} type="button" onClick={() => setTab(t)} style={{
            padding: "4px 10px", fontSize: 12, border: "none",
            borderRight: "1px solid var(--border, #e5e7eb)",
            background: tab === t ? "var(--surface-2, #fff)" : "transparent",
            color: "var(--app-text)", cursor: "pointer", fontWeight: tab === t ? 600 : 400,
            borderBottom: tab === t ? "2px solid var(--surface-2, #fff)" : "2px solid transparent",
        }}>{label}</button>
    );

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: "var(--surface-2, #fff)", border: "1px solid var(--border)",
                borderRadius: 6, width: "min(1100px, 96vw)", height: "min(680px, 92vh)",
                display: "flex", flexDirection: "column", color: "var(--app-text)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)", overflow: "hidden",
            }}>
                {/* Title bar */}
                <div style={{ padding: "5px 12px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", background: "var(--surface-1)" }}>
                    <span>Details (press left / right arrows to change messages)</span>
                    <div style={{ flex: 1 }} />
                    <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "var(--app-text)", padding: "0 4px" }}>✕</button>
                </div>

                {/* Index row */}
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <div style={{ ...labelCell, borderBottom: "none" }}>Index</div>
                    <div style={{ padding: "3px 8px" }}>{index + 1} of {total}</div>
                    <div style={{ display: "flex", gap: 2, padding: "2px 6px", alignItems: "center" }}>
                        <button type="button" onClick={onPrev} disabled={index === 0} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 3, cursor: index === 0 ? "default" : "pointer", padding: "1px 8px", fontSize: 11, opacity: index === 0 ? 0.4 : 1 }}>◀</button>
                        <button type="button" onClick={onNext} disabled={index === total - 1} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 3, cursor: index === total - 1 ? "default" : "pointer", padding: "1px 8px", fontSize: 11, opacity: index === total - 1 ? 0.4 : 1 }}>▶</button>
                    </div>
                </div>

                {/* Message ID */}
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <div style={{ ...labelCell, borderBottom: "none" }}>Message ID:</div>
                    <div style={{ padding: "3px 8px", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.id}</div>
                </div>

                {/* Body */}
                <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
                    {/* Left panel */}
                    <div style={{ flex: "0 0 64%", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
                        {/* Tabs */}
                        {(() => {
                            const addlCount = msg.additionalInformation ? Object.keys(msg.additionalInformation).length : 0;
                            const addlLabel = addlCount > 0 ? `Message's Additional Information (${addlCount})` : "Message's Additional Information";
                            return (
                                <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface-1)", flexShrink: 0 }}>
                                    {tabBtn("formatted", "Formatted Text")}
                                    {tabBtn("messageText", "Message Text")}
                                    {tabBtn("additional", addlLabel)}
                                    {tabBtn("rawText", "Raw Text")}
                                </div>
                            );
                        })()}
                        {/* Tab content */}
                        <div style={{ flex: "0 0 160px", padding: 8, overflowY: "auto", borderBottom: "1px solid var(--border)", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: tab === "rawText" ? "monospace" : undefined }}>
                            {(tab === "formatted" || tab === "messageText") && (msg.text ?? "")}
                            {tab === "additional" && (
                                msg.additionalInformation && Object.keys(msg.additionalInformation).length > 0
                                    ? (
                                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: 12, alignItems: "start" }}>
                                            {Object.entries(msg.additionalInformation).map(([k, v]) => (
                                                <>
                                                    <span key={`${k}-k`} style={{ fontWeight: 600, whiteSpace: "nowrap", color: "#4b7cf3" }}>{k}:</span>
                                                    <span key={`${k}-v`} style={{ wordBreak: "break-all" }}>{v}</span>
                                                </>
                                            ))}
                                        </div>
                                    )
                                    : <span style={{ color: "var(--app-muted-text)" }}>No additional information</span>
                            )}
                            {tab === "rawText" && rawText}
                        </div>
                        {/* Metadata */}
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {metaFields.map(([label, value]) => (
                                <div key={label} style={{ display: "grid", gridTemplateColumns: "160px 1fr" }}>
                                    <div style={labelCell}>{label}:</div>
                                    <div style={valueCell}>{value ?? ""}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right panel – JSON tree */}
                    <div style={{ flex: "0 0 36%", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                            <button type="button" onClick={() => { if (rawText) void navigator.clipboard.writeText(rawText); }}
                                style={{ fontSize: 12, padding: "2px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-1)", cursor: "pointer", color: "var(--app-text)" }}>
                                Copy Message
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: 8 }}>
                            {showJson
                                ? <JsonNode data={parsedJson} />
                                : rawText
                                    ? <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rawText}</pre>
                                    : <span style={{ color: "var(--app-muted-text)", fontSize: 12 }}>No raw text</span>}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", background: "var(--surface-1)", flexShrink: 0 }}>
                    <button type="button" onClick={onClose} style={{ padding: "3px 18px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-2, #fff)", cursor: "pointer", color: "var(--app-text)" }}>Close</button>
                </div>
            </div>
        </div>
    );
}


function sortLogs(logs: AnalogyLogMessage[], key: SortKey, dir: SortDir): AnalogyLogMessage[] {
    return [...logs].sort((a, b) => {
        let av: string | number = "";
        let bv: string | number = "";
        if (key === "date")        { av = a.date ?? ""; bv = b.date ?? ""; }
        else if (key === "processId")   { av = a.processId ?? 0; bv = b.processId ?? 0; }
        else if (key === "text")        { av = (a.text ?? "").toLowerCase(); bv = (b.text ?? "").toLowerCase(); }
        else if (key === "level")       { av = a.level ?? 0; bv = b.level ?? 0; }
        else if (key === "module")      { av = (a.module ?? "").toLowerCase(); bv = (b.module ?? "").toLowerCase(); }
        else if (key === "source")      { av = (a.source ?? "").toLowerCase(); bv = (b.source ?? "").toLowerCase(); }
        else if (key === "user")        { av = (a.user ?? "").toLowerCase(); bv = (b.user ?? "").toLowerCase(); }
        else if (key === "threadId")    { av = a.threadId ?? 0; bv = b.threadId ?? 0; }
        else if (key === "machineName") { av = (a.machineName ?? "").toLowerCase(); bv = (b.machineName ?? "").toLowerCase(); }
        else if (key === "rawText")     { av = (a.rawText ?? "").toLowerCase(); bv = (b.rawText ?? "").toLowerCase(); }
        else if (key === "lineNumber")  { av = a.lineNumber ?? 0; bv = b.lineNumber ?? 0; }
        if (av < bv) return dir === "asc" ? -1 : 1;
        if (av > bv) return dir === "asc" ? 1 : -1;
        return 0;
    });
}

function parseTerms(text: string): { terms: string[]; mode: "and" | "or" } {
    const t = text.trim();
    if (!t) return { terms: [], mode: "and" };
    if (t.includes("|")) return { terms: t.split("|").map(s => s.trim().toLowerCase()).filter(Boolean), mode: "or" };
    return { terms: t.split(/[&+]/).map(s => s.trim().toLowerCase()).filter(Boolean), mode: "and" };
}

function parseSourceList(text: string): { include: string[]; exclude: string[] } {
    const inc: string[] = [], exc: string[] = [];
    for (const p of text.split(",").map(s => s.trim()).filter(Boolean)) {
        if (p.startsWith("-")) exc.push(p.slice(1).toLowerCase());
        else inc.push(p.toLowerCase());
    }
    return { include: inc, exclude: exc };
}

const cellStyle: CSSProperties = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    padding: "0 6px",
    fontSize: 12,
    lineHeight: "22px",
    borderRight: "1px solid var(--border, #e5e7eb)",
    boxSizing: "border-box",
};

interface LogTab {
    id: string;
    label: string;
    filePath: string;
    providerId: string;
    providerTitle: string;
    factoryTitle: string;
    logs: AnalogyLogMessage[];
    loadedAt: string;
    error: string;
}

export function ApplicationLogs({ onBack, selectedFactoryTitle, selectedProviderId, selectedProviderTitle, selectedProviderType }: Props) {
    const [filePath, setFilePath] = useState(() => {
        try {
            return localStorage.getItem(FILE_PATH_STORAGE_KEY) ?? DEFAULT_LOG_PATH;
        } catch {
            return DEFAULT_LOG_PATH;
        }
    });
    const [tabs, setTabs] = useState<LogTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const tabCounterRef = useRef(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string>("");
    const [clearOldTabs, setClearOldTabs] = useState(true);
    const isRealtimeProvider = selectedProviderType.toLowerCase() === "realtime";

    const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
    const logs = activeTab?.logs ?? [];

    const [inclEnabled, setInclEnabled] = useState(false);
    const [inclText, setInclText] = useState("");
    const [exclEnabled, setExclEnabled] = useState(false);
    const [exclText, setExclText] = useState("");
    const [sourcesEnabled, setSourcesEnabled] = useState(false);
    const [sourcesText, setSourcesText] = useState("");
    const [modulesEnabled, setModulesEnabled] = useState(false);
    const [modulesText, setModulesText] = useState("");
    const [searchEverywhere, setSearchEverywhere] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [colWidths, setColWidths] = useState<Record<SortKey, number>>(() => {
        try {
            const saved = localStorage.getItem("appLogs_colWidths");
            if (saved) {
                const parsed = JSON.parse(saved) as Partial<Record<SortKey, number>>;
                return Object.fromEntries(COLUMNS.map(c => [c.key, parsed[c.key] ?? c.width])) as Record<SortKey, number>;
            }
        } catch { /* ignore */ }
        return Object.fromEntries(COLUMNS.map(c => [c.key, c.width])) as Record<SortKey, number>;
    });
    const colRefs = useRef<Array<HTMLTableColElement | null>>(COLUMNS.map(() => null));
    const resizeDraggedRef = useRef(false);
    useEffect(() => {
        try { localStorage.setItem("appLogs_colWidths", JSON.stringify(colWidths)); } catch { /* ignore */ }
    }, [colWidths]);
    const [detailIdx, setDetailIdx] = useState<number | null>(null);
    const [levelFilter, setLevelFilter] = useState<"trace" | "errorCritical" | "warning" | "debug" | "verbose" | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [showMsgDetailsPanel, setShowMsgDetailsPanel] = useState(false);
    const [inlineJsonViewer, setInlineJsonViewer] = useState(false);
    const [isFullView, setIsFullView] = useState(false);
    const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(FILE_PATH_STORAGE_KEY, filePath);
        } catch {
            // ignore storage errors
        }
    }, [filePath]);

    const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const lastSep = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
        const dir = lastSep >= 0 ? filePath.slice(0, lastSep + 1) : DEFAULT_LOG_PATH;
        const newPath = dir + file.name;
        setFilePath(newPath);
        void loadLogs(newPath);
        e.target.value = "";
    };

    const removeTab = (id: string) => {
        setTabs(prev => {
            const next = prev.filter(t => t.id !== id);
            if (activeTabId === id)
                setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
            return next;
        });
    };

    useEffect(() => {
        if (!isRealtimeProvider || !selectedProviderId) {
            return;
        }

        const realtimeTabId = `realtime-${selectedProviderId}`;
        setTabs([
            {
                id: realtimeTabId,
                label: `Realtime stream (${selectedProviderTitle || selectedProviderId})`,
                filePath: "",
                providerId: selectedProviderId,
                providerTitle: selectedProviderTitle,
                factoryTitle: selectedFactoryTitle,
                logs: [],
                loadedAt: new Date().toISOString(),
                error: "",
            },
        ]);
        setActiveTabId(realtimeTabId);
        setSelectedIdx(null);
        setLoadError("");

        let disposed = false;
        const onProviderLogMessage = (message: AnalogyLogMessage) => {
            if (disposed) {
                return;
            }

            setTabs(prev => prev.map(t =>
                t.id === realtimeTabId
                    ? { ...t, logs: [...t.logs, message], loadedAt: new Date().toISOString(), error: "" }
                    : t,
            ));
        };

        const startRealtimeStream = async () => {
            setLoading(true);
            try {
                ecsLogger.info(`Starting realtime stream for provider ${selectedProviderId}`);
                const params = new URLSearchParams({ dataProviderId: selectedProviderId });
                const res = await fetch(`/api/Logging/StartRealtimeStream?${params.toString()}`, { method: "POST" });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    setLoadError(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
                    return;
                }

                connection.on("ProviderLogMessage", onProviderLogMessage);
                try {
                    await joinProviderGroup(selectedProviderId);
                } catch (joinError) {
                    ecsLogger.error("Failed to join provider SignalR group", joinError);
                    setLoadError(joinError instanceof Error ? joinError.message : String(joinError));
                }
            } catch (e) {
                setLoadError(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        };

        void startRealtimeStream();

        return () => {
            disposed = true;
            connection.off("ProviderLogMessage", onProviderLogMessage);
            void leaveProviderGroup(selectedProviderId);
            const params = new URLSearchParams({ dataProviderId: selectedProviderId });
            void fetch(`/api/Logging/StopRealtimeStream?${params.toString()}`, { method: "POST" });
        };
    }, [isRealtimeProvider, selectedProviderId, selectedProviderTitle, selectedFactoryTitle]);

    const loadLogs = async (pathOverride?: string) => {
        if (isRealtimeProvider) {
            setLoadError("Selected provider is realtime. File loading is disabled.");
            return;
        }

        const path = (pathOverride ?? filePath).trim();
        if (!path) {
            setLoadError("Enter a file path first.");
            return;
        }
        if (!selectedProviderId) {
            setLoadError("Select a data provider from the main page first.");
            return;
        }
        setLoadError("");
        setLoading(true);
        if (clearOldTabs) {
            setTabs([]);
            setActiveTabId(null);
        }
        tabCounterRef.current += 1;
        const newId = `tab-${tabCounterRef.current}-${Date.now()}`;
        const newTab: LogTab = {
            id: newId,
            label: `Offline log #${tabCounterRef.current} (${selectedProviderTitle || selectedProviderId})`,
            filePath: path,
            providerId: selectedProviderId,
            providerTitle: selectedProviderTitle,
            factoryTitle: selectedFactoryTitle,
            logs: [],
            loadedAt: "",
            error: "",
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newId);
        setSelectedIdx(null);
        try {
            const params = new URLSearchParams({ filePath: path, dataProviderId: selectedProviderId });
            const res = await fetch(`/api/Logging/GetLog?${params.toString()}`, { method: "GET" });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                const msg = `${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`;
                setTabs(prev => prev.map(t => t.id === newId ? { ...t, error: msg } : t));
            } else {
                const data = (await res.json()) as AnalogyLogMessage[];
                setTabs(prev => prev.map(t => t.id === newId ? { ...t, logs: data, loadedAt: new Date().toISOString() } : t));
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setTabs(prev => prev.map(t => t.id === newId ? { ...t, error: msg } : t));
        } finally {
            setLoading(false);
        }
    };

    const handleHeaderClick = (key: SortKey) => {
        if (resizeDraggedRef.current) return;
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const startResize = (e: React.MouseEvent, key: SortKey, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        resizeDraggedRef.current = false;
        const startX = e.clientX;
        const startWidth = colWidths[key];
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        const onMouseMove = (ev: MouseEvent) => {
            resizeDraggedRef.current = true;
            const newWidth = Math.max(40, startWidth + ev.clientX - startX);
            const col = colRefs.current[colIndex];
            if (col) col.style.width = `${newWidth}px`;
        };
        const onMouseUp = (ev: MouseEvent) => {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            const newWidth = Math.max(40, startWidth + ev.clientX - startX);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            setColWidths(prev => ({ ...prev, [key]: newWidth }));
            setTimeout(() => { resizeDraggedRef.current = false; }, 0);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    const handleClearLog = () => {
        if (!activeTabId) return;
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, logs: [] } : t));
        setSelectedIdx(null);
    };

    const reloadActiveTab = async () => {
        if (!activeTab) return;
        if (isRealtimeProvider) return;
        setLoading(true);
        const tabId = activeTab.id;
        const tabPath = activeTab.filePath;
        const providerId = activeTab.providerId;
        try {
            const params = new URLSearchParams({ filePath: tabPath, dataProviderId: providerId });
            const res = await fetch(`/api/Logging/GetLog?${params.toString()}`, { method: "GET" });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                const msg = `${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`;
                setTabs(prev => prev.map(t => t.id === tabId ? { ...t, error: msg } : t));
            } else {
                const data = (await res.json()) as AnalogyLogMessage[];
                setTabs(prev => prev.map(t => t.id === tabId ? { ...t, logs: data, loadedAt: new Date().toISOString(), error: "" } : t));
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, error: msg } : t));
        } finally {
            setLoading(false);
        }
    };

    const handleGoToActiveMessage = () => {
        if (selectedIdx !== null) rowVirtualizer.scrollToIndex(selectedIdx, { align: "center" });
    };

    const handleGridKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        if (sorted.length === 0) return;
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        setSelectedIdx(prev => {
            const next = prev === null
                ? (dir === 1 ? 0 : sorted.length - 1)
                : Math.max(0, Math.min(sorted.length - 1, prev + dir));
            rowVirtualizer.scrollToIndex(next, { align: "auto" });
            return next;
        });
    };

    const filtered = logs.filter(msg => {
        if (inclEnabled && inclText.trim()) {
            const { terms, mode } = parseTerms(inclText);
            if (terms.length > 0) {
                const fields = searchEverywhere
                    ? [msg.text, msg.source, msg.module, msg.category, msg.methodName, msg.fileName, msg.machineName, msg.user, msg.rawText, getLevelLabel(msg.level)]
                    : [msg.text];
                const haystack = fields.filter(Boolean).join(" ").toLowerCase();
                const ok = mode === "or" ? terms.some(t => haystack.includes(t)) : terms.every(t => haystack.includes(t));
                if (!ok) return false;
            }
        }
        if (exclEnabled && exclText.trim()) {
            const { terms, mode } = parseTerms(exclText);
            if (terms.length > 0) {
                const haystack = [msg.text, msg.source, msg.module, msg.category, msg.methodName, msg.fileName, msg.machineName, msg.user, msg.rawText]
                    .filter(Boolean).join(" ").toLowerCase();
                const ok = mode === "or" ? terms.some(t => haystack.includes(t)) : terms.every(t => haystack.includes(t));
                if (ok) return false;
            }
        }
        if (sourcesEnabled && sourcesText.trim()) {
            const { include, exclude } = parseSourceList(sourcesText);
            const src = (msg.source ?? "").toLowerCase();
            if (exclude.some(e => src.includes(e))) return false;
            if (include.length > 0 && !include.some(i => src.includes(i))) return false;
        }
        if (modulesEnabled && modulesText.trim()) {
            const { include, exclude } = parseSourceList(modulesText);
            const mod = (msg.module ?? "").toLowerCase();
            if (exclude.some(e => mod.includes(e))) return false;
            if (include.length > 0 && !include.some(i => mod.includes(i))) return false;
        }
        if (levelFilter !== null) {
            const label = getLevelLabel(msg.level).toLowerCase();
            if (levelFilter === "trace" && label !== "trace") return false;
            if (levelFilter === "errorCritical" && label !== "error" && label !== "critical") return false;
            if (levelFilter === "warning" && label !== "warning") return false;
            if (levelFilter === "debug" && label !== "debug") return false;
            if (levelFilter === "verbose" && label !== "verbose") return false;
        }
        return true;
    });
    const sorted = sortLogs(filtered, sortKey, sortDir);

    const handleSaveLog = (format: "json" | "csv") => {
        if (!activeTab || sorted.length === 0) return;
        setSaveDropdownOpen(false);
        let content: string;
        let mime: string;
        let ext: string;
        if (format === "json") {
            content = JSON.stringify(sorted, null, 2);
            mime = "application/json";
            ext = "json";
        } else {
            const headers = COLUMNS.map(c => c.label).join(",");
            const rows = sorted.map(msg => COLUMNS.map(c => {
                let val = "";
                if (c.key === "date") val = formatTime(msg.date ?? "");
                else if (c.key === "processId") val = String(msg.processId ?? "");
                else if (c.key === "text") val = msg.text ?? "";
                else if (c.key === "level") val = getLevelLabel(msg.level);
                else if (c.key === "module") val = msg.module ?? "";
                else if (c.key === "source") val = msg.source ?? "";
                else if (c.key === "user") val = msg.user ?? "";
                else if (c.key === "threadId") val = String(msg.threadId ?? "");
                else if (c.key === "machineName") val = msg.machineName ?? "";
                else if (c.key === "rawText") val = msg.rawText ?? "";
                else if (c.key === "lineNumber") val = String(msg.lineNumber ?? "");
                return `"${val.replace(/"/g, '""')}"`;
            }).join(","));
            content = [headers, ...rows].join("\n");
            mime = "text/csv";
            ext = "csv";
        }
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeName = (activeTab.label ?? "log").replace(/[/\\?%*:|"<>]/g, "_");
        a.download = `${safeName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const totalWidth = COLUMNS.reduce((s, c) => s + colWidths[c.key], 0);

    const rowVirtualizer = useVirtualizer({
        count: sorted.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 22,
        overscan: 15,
    });

    const pageStyle: CSSProperties = {
        padding: 16,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        color: "var(--app-text)",
        overflow: "hidden",
    };

    const btnStyle: CSSProperties = {
        height: 30,
        padding: "0 12px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--app-text)",
        cursor: "pointer",
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
    };

    const thStyle: CSSProperties = {
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: "var(--surface-1, #f3f4f6)",
        borderRight: "1px solid var(--border, #e5e7eb)",
        borderBottom: "2px solid var(--border, #e5e7eb)",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: "26px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        textAlign: "left",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "0",
    };

    return (
        <div style={pageStyle}>
            {/* Header bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button type="button" style={btnStyle} onClick={onBack}>← Back</button>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Application Logs</span>
                {selectedProviderId && (
                    <span style={{ color: "var(--app-muted-text)", fontSize: 12 }}>
                        {selectedFactoryTitle} / {selectedProviderTitle || selectedProviderId} ({selectedProviderType})
                    </span>
                )}
                {activeTab && !loading && !activeTab.error && (
                    <span style={{ color: "var(--app-muted-text)", fontSize: 12 }}>
                        {filtered.length !== logs.length
                            ? `${filtered.length} / ${logs.length} entries`
                            : `${logs.length} entr${logs.length !== 1 ? "ies" : "y"}`}
                    </span>
                )}
                <div style={{ flex: 1 }} />
            </div>

            {/* File load panel */}
            {!isFullView && !isRealtimeProvider && (<div style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 8px",
                background: "var(--surface-1)",
                flexShrink: 0,
            }}>
                <input
                        ref={fileInputRef}
                        type="file"
                        accept=".log"
                        style={{ display: "none" }}
                        onChange={handleFilePicked}
                    />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
                    <input
                        style={{
                            height: 26,
                            border: "1px solid var(--chip-border)",
                            borderRadius: 4,
                            padding: "0 8px",
                            width: "100%",
                            boxSizing: "border-box",
                            color: "var(--control-text)",
                            background: "var(--control-bg)",
                            fontSize: 12,
                            fontFamily: "monospace",
                        }}
                        value={filePath}
                        onChange={e => setFilePath(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") void loadLogs(); }}
                        placeholder="C:\MVD2\Logs\ECS\MediaManager_*.log"
                        spellCheck={false}
                    />
                    <button
                        type="button"
                        title="Browse for log file"
                        aria-label="Browse for log file"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            height: 26,
                            width: 28,
                            padding: 0,
                            borderRadius: 4,
                            border: "1px solid var(--chip-border)",
                            background: "var(--control-bg)",
                            color: "var(--control-text)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadLogs()}
                        disabled={loading || !selectedProviderId}
                        style={{
                            height: 26,
                            padding: "0 14px",
                            borderRadius: 4,
                            border: "1px solid var(--chip-border)",
                            background: "var(--control-bg)",
                            color: "var(--control-text)",
                            cursor: loading ? "default" : "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            opacity: loading || !selectedProviderId ? 0.7 : 1,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            flexShrink: 0,
                        }}
                        aria-label="Load log file"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {loading ? "Loading…" : "Load"}
                    </button>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 5, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--app-muted-text)" }}>
                        Provider: {selectedProviderTitle || selectedProviderId || "Not selected"}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", userSelect: "none", marginLeft: "auto" }}>
                        <input type="checkbox" checked={clearOldTabs} onChange={e => setClearOldTabs(e.target.checked)}
                            style={{ margin: 0, cursor: "pointer" }} />
                        Clear old tabs on load
                    </label>
                </div>
                {(loadError) && (
                    <div style={{ marginTop: 4, fontSize: 11 }}>
                        <span style={{ color: "var(--danger, #dc2626)" }}>{loadError}</span>
                    </div>
                )}
            </div>)}

            {/* Filter panel */}
            {!isFullView && (() => {
                const fi = (enabled: boolean): CSSProperties => ({
                    height: 22, border: "1px solid var(--chip-border)", borderRadius: 3,
                    padding: "0 6px", width: "100%", boxSizing: "border-box" as const,
                    color: "var(--control-text)", background: enabled ? "var(--control-bg)" : "var(--surface-1)",
                    fontSize: 11, opacity: enabled ? 1 : 0.65,
                });
                const clearBtn = (onClick: () => void, disabled: boolean) => (
                    <button type="button" onClick={onClick} disabled={disabled} title="Clear" style={{
                        width: 22, height: 22, padding: 0, border: "1px solid var(--chip-border)",
                        borderRadius: 3, background: "var(--control-bg)", color: "var(--control-text)",
                        cursor: disabled ? "default" : "pointer", fontSize: 11, flexShrink: 0,
                        opacity: disabled ? 0.4 : 1,
                    }}>✕</button>
                );
                const chk = (checked: boolean, onChange: (v: boolean) => void) => (
                    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
                        style={{ margin: 0, cursor: "pointer", flexShrink: 0 }} />
                );
                const lblStyle = (enabled: boolean): CSSProperties => ({
                    display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                    fontSize: 12, fontWeight: enabled ? 600 : 400, userSelect: "none",
                });
                return (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "stretch" }}>
                    <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", background: "var(--surface-1)", display: "flex", flexDirection: "column", gap: 3 }}>
                        {/* Include Text */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <label style={lblStyle(inclEnabled)}>
                                {chk(inclEnabled, setInclEnabled)}
                                Include Text:
                            </label>
                            <input value={inclText} onChange={e => setInclText(e.target.value)}
                                onFocus={() => setInclEnabled(true)} style={fi(inclEnabled)}
                                placeholder="Use & or + for AND operations. Use | for OR operations" />
                            <label style={{ ...lblStyle(inclEnabled), fontSize: 11 }}>
                                {chk(searchEverywhere, setSearchEverywhere)}
                                Search Everywhere
                            </label>
                            {clearBtn(() => setInclText(""), !inclText)}
                        </div>
                        {/* Exclude Text */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <label style={lblStyle(exclEnabled)}>
                                {chk(exclEnabled, setExclEnabled)}
                                Exclude Text:
                            </label>
                            <input value={exclText} onChange={e => setExclText(e.target.value)}
                                onFocus={() => setExclEnabled(true)} style={fi(exclEnabled)}
                                placeholder="Use & or + for AND operations. Use | for OR operations" />
                            {clearBtn(() => setExclText(""), !exclText)}
                        </div>
                        {/* Sources */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <label style={lblStyle(sourcesEnabled)}>
                                {chk(sourcesEnabled, setSourcesEnabled)}
                                Sources (Include/Exclude):
                            </label>
                            <input value={sourcesText} onChange={e => setSourcesText(e.target.value)}
                                onFocus={() => setSourcesEnabled(true)} style={fi(sourcesEnabled)}
                                placeholder=", to separate. Exclude with prefix - e.g: IncludeA, IncludeB, -ExcludeC" />
                            {clearBtn(() => setSourcesText(""), !sourcesText)}
                        </div>
                        {/* Processes/Modules */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <label style={lblStyle(modulesEnabled)}>
                                {chk(modulesEnabled, setModulesEnabled)}
                                Processes/Modules (Include/Exclude):
                            </label>
                            <input value={modulesText} onChange={e => setModulesText(e.target.value)}
                                onFocus={() => setModulesEnabled(true)} style={fi(modulesEnabled)}
                                placeholder=", to separate. Exclude with prefix - e.g: include, -ExcludeD" />
                            {clearBtn(() => setModulesText(""), !modulesText)}
                        </div>
                    </div>
                    {/* Level filter */}
                    <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "4px 10px", background: "var(--surface-1)", display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
                        {([
                            { key: "trace",         label: "Trace",          color: "#6b7280" },
                            { key: "errorCritical", label: "Error + Critical", color: "#dc2626" },
                            { key: "warning",       label: "Warning",         color: "#d97706" },
                            { key: "debug",         label: "Debug",           color: "#2563eb" },
                            { key: "verbose",       label: "Verbose",         color: "#9ca3af" },
                        ] as const).map(opt => (
                            <div key={opt.key}
                                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
                                onClick={() => setLevelFilter(lf => lf === opt.key ? null : opt.key)}
                            >
                                <span style={{
                                    width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
                                    border: `2px solid ${opt.color}`,
                                    background: levelFilter === opt.key ? opt.color : "transparent",
                                }} />
                                <span style={{ fontSize: 12, whiteSpace: "nowrap", color: levelFilter === opt.key ? opt.color : "var(--app-text)" }}>
                                    {opt.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    </div>
                );
            })()}

            {/* Tab bar */}
            {tabs.length > 0 && (
                <div style={{ display: "flex", flexShrink: 0, gap: 2, overflowX: "auto", alignItems: "flex-end" }}>
                    {tabs.map(tab => {
                        const isActive = tab.id === activeTabId;
                        return (
                            <div key={tab.id}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "4px 8px 4px 12px",
                                    cursor: "pointer",
                                    border: "1px solid var(--border)",
                                    borderRadius: "4px 4px 0 0",
                                    borderBottom: isActive ? "1px solid var(--surface-2, var(--surface-1))" : "1px solid var(--border)",
                                    background: isActive ? "var(--surface-2, #fff)" : "var(--surface-1)",
                                    fontSize: 12,
                                    whiteSpace: "nowrap",
                                    fontWeight: isActive ? 600 : 400,
                                    color: tab.error ? "var(--danger, #dc2626)" : "var(--app-text)",
                                    userSelect: "none",
                                    marginBottom: isActive ? -1 : 0,
                                }}
                                onClick={() => setActiveTabId(tab.id)}
                            >
                                <span>{tab.label}</span>
                                {tab.loadedAt && !tab.error && (
                                    <span style={{ color: "var(--app-muted-text)", fontSize: 11, fontWeight: 400 }}>
                                        — {formatTime(tab.loadedAt)}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); removeTab(tab.id); }}
                                    title="Close tab"
                                    style={{
                                        width: 16, height: 16, padding: 0, border: "none",
                                        background: "transparent", cursor: "pointer", fontSize: 13,
                                        color: "var(--app-muted-text)", display: "flex",
                                        alignItems: "center", justifyContent: "center", borderRadius: 2,
                                        flexShrink: 0,
                                    }}
                                >×</button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Toolbar */}
            {tabs.length > 0 && (() => {
                const tbBtn: CSSProperties = {
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "0 7px", height: 24, fontSize: 12,
                    border: "1px solid transparent", borderRadius: 3,
                    background: "transparent", color: "var(--app-text)",
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                };
                const sep = (
                    <div style={{ width: 1, alignSelf: "stretch", background: "var(--border, #e5e7eb)", margin: "2px 5px" }} />
                );
                const chkBox = (checked: boolean) => (
                    <span style={{
                        width: 11, height: 11, border: "1px solid var(--border, #d1d5db)",
                        borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: checked ? "var(--accent, #2563eb)" : "var(--control-bg, #fff)", flexShrink: 0,
                    }}>
                        {checked && <span style={{ color: "#fff", fontSize: 9, lineHeight: "1" }}>✓</span>}
                    </span>
                );
                return (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 0, flexShrink: 0,
                        background: "var(--surface-1)", border: "1px solid var(--border)",
                        borderRadius: 4, padding: "2px 4px", height: 30, boxSizing: "border-box",
                    }}>
                        <div style={{ width: 2, alignSelf: "stretch", borderLeft: "2px solid var(--border, #d1d5db)", marginRight: 4 }} />
                        <button type="button" disabled={!activeTab || logs.length === 0} onClick={handleClearLog} title="Clear the current tab's log entries"
                            style={{ ...tbBtn, color: (activeTab && logs.length > 0) ? "#dc2626" : undefined, opacity: (!activeTab || logs.length === 0) ? 0.45 : 1 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Clear Log
                        </button>
                        <button type="button" disabled={!activeTab || loading} onClick={() => void reloadActiveTab()} title="Reload the current tab's log file"
                            style={{ ...tbBtn, color: (activeTab && !loading && !isRealtimeProvider) ? "#16a34a" : undefined, opacity: (!activeTab || loading || isRealtimeProvider) ? 0.45 : 1 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            Reload Files
                        </button>
                        {sep}
                        <button type="button" onClick={() => setShowMsgDetailsPanel(v => !v)} title="Toggle message details panel"
                            style={{ ...tbBtn, background: showMsgDetailsPanel ? "var(--accent, #2563eb)" : "transparent", color: showMsgDetailsPanel ? "#fff" : "var(--app-text)" }}>
                            {chkBox(showMsgDetailsPanel)}
                            Message Details
                        </button>
                        <button type="button" onClick={() => setInlineJsonViewer(v => !v)} title="Toggle inline JSON viewer in details panel"
                            style={{ ...tbBtn, background: inlineJsonViewer ? "var(--accent, #2563eb)" : "transparent", color: inlineJsonViewer ? "#fff" : "var(--app-text)" }}>
                            {chkBox(inlineJsonViewer)}
                            Inline Json Viewer
                        </button>
                        {sep}
                        <button type="button" disabled={selectedIdx === null} onClick={handleGoToActiveMessage} title="Scroll to the selected message"
                            style={{ ...tbBtn, opacity: selectedIdx === null ? 0.45 : 1 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            Go To Active Message
                        </button>
                        {sep}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <button type="button" disabled={!activeTab || sorted.length === 0} onClick={() => setSaveDropdownOpen(v => !v)} title="Save the current log"
                                style={{ ...tbBtn, opacity: (!activeTab || sorted.length === 0) ? 0.45 : 1 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
                                Save Log
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>
                            </button>
                            {saveDropdownOpen && (
                                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "var(--surface-2, #fff)", border: "1px solid var(--border)", borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", minWidth: 130 }}>
                                    <button type="button" onClick={() => handleSaveLog("json")} style={{ display: "block", width: "100%", padding: "6px 12px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "var(--app-text)" }}>Save as JSON</button>
                                    <button type="button" onClick={() => handleSaveLog("csv")} style={{ display: "block", width: "100%", padding: "6px 12px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "var(--app-text)" }}>Save as CSV</button>
                                </div>
                            )}
                        </div>
                        {sep}
                        <button type="button" onClick={() => setIsFullView(v => !v)} title={isFullView ? "Show all controls" : "Maximize log view"}
                            style={{ ...tbBtn, background: isFullView ? "var(--accent, #2563eb)" : "transparent", color: isFullView ? "#fff" : "var(--app-text)" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {isFullView
                                    ? <><polyline points="4,14 10,14 10,20"/><polyline points="20,10 14,10 14,4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></>
                                    : <><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
                                }
                            </svg>
                            Full
                        </button>
                    </div>
                );
            })()}

            {/* Grid + JSON side panel */}
            <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 4 }}>
            <div ref={scrollRef} tabIndex={0} onKeyDown={handleGridKeyDown} style={{ flex: 1, overflow: "auto", border: "1px solid var(--border)", borderRadius: 4, position: "relative", outline: "none" }}>
                {loading ? (
                    <div style={{ padding: 16, color: "var(--app-muted-text)", fontSize: 13 }}>Loading…</div>
                ) : !activeTab ? (
                    <div style={{ padding: 16, color: "var(--app-muted-text)", fontSize: 13 }}>{isRealtimeProvider ? "Waiting for realtime stream..." : "Load a log file to view entries."}</div>
                ) : activeTab.error ? (
                    <div style={{ padding: 16, color: "var(--danger, #dc2626)", fontSize: 13 }}>{activeTab.error}</div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: 16, color: "var(--app-muted-text)", fontSize: 13 }}>{isRealtimeProvider ? "No realtime messages received yet." : "No entries in this log file."}</div>
                ) : sorted.length === 0 ? (
                    <div style={{ padding: 16, color: "var(--app-muted-text)", fontSize: 13 }}>No entries match the current filters.</div>
                ) : (
                    <table style={{
                        width: totalWidth,
                        minWidth: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                        fontSize: 12,
                    }}>
                        <colgroup>
                            {COLUMNS.map((col, colIndex) => (
                                <col key={col.key} ref={el => { colRefs.current[colIndex] = el; }} style={{ width: colWidths[col.key] }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                {COLUMNS.map((col, colIndex) => (
                                    <th
                                        key={col.key}
                                        style={thStyle}
                                        onClick={() => handleHeaderClick(col.key)}
                                        title={col.label}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", height: "26px", paddingLeft: 6 }}>
                                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</span>
                                                {sortKey === col.key && (
                                                    <span style={{ flexShrink: 0, fontSize: 10, color: "var(--app-muted-text)" }}>
                                                        {sortDir === "asc" ? "▲" : "▼"}
                                                    </span>
                                                )}
                                            </span>
                                            <div
                                                style={{ width: 5, alignSelf: "stretch", cursor: "col-resize", flexShrink: 0, borderLeft: "2px solid transparent" }}
                                                onMouseDown={(e) => startResize(e, col.key, colIndex)}
                                            />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const virtualItems = rowVirtualizer.getVirtualItems();
                                const topPad = virtualItems[0]?.start ?? 0;
                                const lastItem = virtualItems[virtualItems.length - 1];
                                const bottomPad = lastItem ? rowVirtualizer.getTotalSize() - lastItem.end : 0;
                                const q = inclEnabled ? inclText : "";
                                return (
                                    <>
                                        {topPad > 0 && (
                                            <tr><td colSpan={COLUMNS.length} style={{ height: topPad, padding: 0 }} /></tr>
                                        )}
                                        {virtualItems.map(virtualRow => {
                                            const idx = virtualRow.index;
                                            const msg = sorted[idx];
                                            const levelLabel = getLevelLabel(msg.level);
                                            const isSelected = selectedIdx === idx;
                                            const rowBg = isSelected
                                                ? "var(--accent, #2563eb)"
                                                : idx % 2 === 0 ? "var(--surface-2, #fff)" : "var(--surface-1, #f9fafb)";
                                            return (
                                                <tr
                                                    key={`${msg.id}-${idx}`}
                                                    style={{ height: 22, background: rowBg, cursor: "default", color: isSelected ? "#fff" : getLevelColor(msg.level) }}
                                                    onClick={() => { setSelectedIdx(isSelected ? null : idx); scrollRef.current?.focus(); }}
                                                    onDoubleClick={() => setDetailIdx(idx)}
                                                >
                                                    <td style={cellStyle} title={formatTime(msg.date ?? "")}>{formatTime(msg.date ?? "")}</td>
                                                    <td style={cellStyle} title={String(msg.processId ?? "")}>{msg.processId || ""}</td>
                                                    <td style={{ ...cellStyle, fontFamily: "monospace" }} title={msg.text ?? ""}><Highlight text={msg.text ?? ""} query={q} /></td>
                                                    <td style={cellStyle} title={levelLabel}>{levelLabel}</td>
                                                    <td style={{ ...cellStyle, fontFamily: "monospace" }} title={msg.module ?? ""}><Highlight text={msg.module ?? ""} query={q} /></td>
                                                    <td style={{ ...cellStyle, fontFamily: "monospace" }} title={msg.source ?? ""}><Highlight text={msg.source ?? ""} query={q} /></td>
                                                    <td style={cellStyle} title={msg.user ?? ""}><Highlight text={msg.user ?? ""} query={q} /></td>
                                                    <td style={cellStyle} title={String(msg.threadId ?? "")}>{msg.threadId || ""}</td>
                                                    <td style={cellStyle} title={msg.machineName ?? ""}><Highlight text={msg.machineName ?? ""} query={q} /></td>
                                                    <td style={{ ...cellStyle, fontFamily: "monospace" }} title={msg.rawText ?? ""}><Highlight text={msg.rawText ?? ""} query={q} /></td>
                                                    <td style={cellStyle} title={String(msg.lineNumber ?? "")}>{msg.lineNumber || ""}</td>
                                                </tr>
                                            );
                                        })}
                                        {bottomPad > 0 && (
                                            <tr><td colSpan={COLUMNS.length} style={{ height: bottomPad, padding: 0 }} /></tr>
                                        )}
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>
                )}
            </div>
            {inlineJsonViewer && (() => {
                const msg = selectedIdx !== null ? sorted[selectedIdx] : null;
                const rawText = msg?.rawText ?? "";
                let parsedJson: unknown = null;
                if (rawText) { try { parsedJson = JSON.parse(rawText); } catch { /* not JSON */ } }
                return (
                    <div style={{ flex: "0 0 300px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        <div style={{ padding: "3px 8px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600, background: "var(--surface-2, #fff)", flexShrink: 0, color: "var(--app-text)", display: "flex", alignItems: "center" }}>
                            <span style={{ flex: 1 }}>Raw JSON</span>
                            <button type="button" onClick={() => { if (rawText) void navigator.clipboard.writeText(rawText); }}
                                disabled={!rawText}
                                style={{ fontSize: 11, padding: "1px 8px", border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface-1)", cursor: rawText ? "pointer" : "default", color: "var(--app-text)", opacity: rawText ? 1 : 0.4 }}>
                                Copy Message
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: 6 }}>
                            {!msg
                                ? <span style={{ color: "var(--app-muted-text)", fontSize: 12 }}>Select a row to view its JSON</span>
                                : parsedJson !== null
                                    ? <JsonNode data={parsedJson} />
                                    : rawText
                                        ? <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rawText}</pre>
                                        : <span style={{ color: "var(--app-muted-text)", fontSize: 12 }}>No raw text</span>
                            }
                        </div>
                    </div>
                );
            })()}
            </div>
            {showMsgDetailsPanel && selectedIdx !== null && sorted[selectedIdx] && (() => {
                const msg = sorted[selectedIdx];
                return (
                    <div style={{ height: 140, border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-1)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
                        <div style={{ padding: "2px 8px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2, #fff)", flexShrink: 0 }}>
                            <span>Message Details</span>
                            <span style={{ color: "var(--app-muted-text)", fontWeight: 400 }}>#{selectedIdx + 1} of {sorted.length}</span>
                            <div style={{ flex: 1 }} />
                            <button type="button" onClick={() => setDetailIdx(selectedIdx)} style={{ fontSize: 11, padding: "1px 8px", border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface-1)", cursor: "pointer", color: "var(--app-text)" }}>Full Details</button>
                        </div>
                        <div style={{ flex: 1, padding: "4px 8px", fontSize: 12, overflowY: "auto", wordBreak: "break-word" }}>
                            {msg.text ?? ""}
                        </div>
                    </div>
                );
            })()}
            {detailIdx !== null && sorted[detailIdx] && (
                <LogDetailModal
                    msg={sorted[detailIdx]}
                    index={detailIdx}
                    total={sorted.length}
                    logFilePath={filePath}
                    onClose={() => setDetailIdx(null)}
                    onPrev={() => setDetailIdx(i => i !== null ? Math.max(0, i - 1) : 0)}
                    onNext={() => setDetailIdx(i => i !== null ? Math.min(sorted.length - 1, i + 1) : 0)}
                />
            )}
        </div>
    );
}
