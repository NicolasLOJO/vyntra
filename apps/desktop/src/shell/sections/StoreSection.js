import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
const CATALOG_URL = import.meta.env.VITE_CATALOG_URL ?? "/catalog.json";
const CATALOG_FALLBACK_URL = "/catalog.json";
const PERM_COLORS = {
    system: "#a78bfa",
    media: "#34d399",
    launcher: "#60a5fa",
    storage: "#fbbf24",
    ui_effects: "#f472b6",
    network: "#fb923c",
};
export function StoreSection() {
    const [catalog, setCatalog] = useState(null);
    const [installed, setInstalled] = useState(new Set());
    const [loadError, setLoadError] = useState(null);
    const [installing, setInstalling] = useState(null);
    const [installError, setInstallError] = useState(null);
    const [search, setSearch] = useState("");
    const refreshInstalled = useCallback(() => {
        invoke("list_widgets").then((ws) => setInstalled(new Set(ws.map((w) => w.id))));
    }, []);
    useEffect(() => {
        refreshInstalled();
        const unsub = listen("vyntra://widgets-changed", refreshInstalled);
        const loadCatalog = async () => {
            try {
                const r = await fetch(CATALOG_URL);
                if (!r.ok)
                    throw new Error(`HTTP ${r.status}`);
                const c = (await r.json());
                setCatalog(c.widgets);
            }
            catch (_remoteErr) {
                if (CATALOG_URL !== CATALOG_FALLBACK_URL) {
                    // Remote URL failed — silently fall back to the local bundled catalog.
                    console.warn("[Store] Remote catalog unreachable, falling back to local catalog.json");
                    try {
                        const r = await fetch(CATALOG_FALLBACK_URL);
                        if (!r.ok)
                            throw new Error(`HTTP ${r.status}`);
                        const c = (await r.json());
                        setCatalog(c.widgets);
                        return;
                    }
                    catch (_localErr) {
                        // local fallback also failed — show error below
                    }
                }
                setLoadError("Could not load the catalog. Check your connection.");
            }
        };
        void loadCatalog();
        return () => { unsub.then((f) => f()); };
    }, [refreshInstalled]);
    const install = async (entry) => {
        if (!entry.download_url)
            return;
        setInstalling(entry.id);
        setInstallError(null);
        try {
            const res = await fetch(entry.download_url);
            if (!res.ok)
                throw new Error(`Download failed: HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            await invoke("install_widget_bytes", { bytes: Array.from(new Uint8Array(buf)) });
        }
        catch (e) {
            setInstallError(String(e));
        }
        finally {
            setInstalling(null);
        }
    };
    const filtered = catalog
        ? catalog.filter((e) => {
            if (!search.trim())
                return true;
            const q = search.toLowerCase();
            return (e.name.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q) ||
                e.author.toLowerCase().includes(q) ||
                e.tags.some((t) => t.toLowerCase().includes(q)));
        })
        : [];
    return (_jsxs("div", { className: "vyntra-section", children: [_jsxs("header", { className: "vyntra-section-head", children: [_jsx("h2", { children: "Store" }), _jsx("p", { children: "Browse and install widgets." })] }), _jsx("input", { className: "vyntra-store-search", type: "search", placeholder: "Search widgets\u2026", value: search, onChange: (e) => setSearch(e.target.value) }), loadError && _jsx("div", { className: "vyntra-error", children: loadError }), installError && (_jsxs("div", { className: "vyntra-error", style: { cursor: "pointer" }, onClick: () => setInstallError(null), children: [installError, " \u2715"] })), catalog === null && !loadError && (_jsx("div", { className: "vyntra-empty", children: "Loading catalog\u2026" })), catalog !== null && filtered.length === 0 && (_jsxs("div", { className: "vyntra-empty", children: ["No widgets match \"", search, "\"."] })), filtered.length > 0 && (_jsx("div", { className: "vyntra-store-grid", children: filtered.map((entry) => (_jsx(StoreCard, { entry: entry, isInstalled: installed.has(entry.id), isInstalling: installing === entry.id, onInstall: () => install(entry) }, entry.id))) }))] }));
}
function StoreCard({ entry, isInstalled, isInstalling, onInstall, }) {
    const initials = entry.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
    const accentColor = entry.permissions[0]
        ? PERM_COLORS[entry.permissions[0]] ?? "#5b8cff"
        : "#5b8cff";
    return (_jsxs("div", { className: "vyntra-store-card", children: [_jsxs("div", { className: "vyntra-store-card-top", children: [_jsx("div", { className: "vyntra-store-avatar", style: { background: `${accentColor}22`, color: accentColor }, children: initials }), _jsxs("div", { className: "vyntra-store-card-meta", children: [_jsx("div", { className: "vyntra-store-card-name", children: entry.name }), _jsxs("div", { className: "vyntra-store-card-sub", children: ["by ", entry.author, " \u00B7 v", entry.version, " \u00B7 ", entry.size.w, "\u00D7", entry.size.h] })] })] }), _jsx("p", { className: "vyntra-store-card-desc", children: entry.description }), _jsxs("div", { className: "vyntra-store-card-footer", children: [_jsxs("div", { className: "vyntra-store-tags", children: [entry.permissions.map((p) => (_jsx("span", { className: "vyntra-perm-chip", style: { background: `${PERM_COLORS[p] ?? "#5b8cff"}22`, color: PERM_COLORS[p] ?? "#a8c4ff" }, children: p }, p))), entry.permissions.length === 0 && (_jsx("span", { className: "vyntra-perms-none", children: "no permissions" })), entry.interactive !== false ? (_jsx("span", { className: "vyntra-store-badge-interactive", children: "interactive" })) : (_jsx("span", { className: "vyntra-store-badge-display", children: "display only" }))] }), _jsxs("div", { className: "vyntra-store-card-actions", children: [entry.bundled && (_jsx("span", { className: "vyntra-store-badge-builtin", children: "Built-in" })), isInstalled ? (_jsx("span", { className: "vyntra-store-badge-installed", children: "Installed" })) : (_jsx("button", { className: "vyntra-btn-primary", onClick: onInstall, disabled: !entry.download_url || isInstalling, title: !entry.download_url ? "Not yet available for download" : undefined, children: isInstalling ? "Installing…" : "Install" }))] })] })] }));
}
