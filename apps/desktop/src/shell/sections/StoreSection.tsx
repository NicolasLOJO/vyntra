import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WidgetSummary } from "../../core/types";

const CATALOG_URL: string =
  (import.meta.env.VITE_CATALOG_URL as string | undefined) ?? "/catalog.json";
const CATALOG_FALLBACK_URL = "/catalog.json";

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  size: { w: number; h: number };
  permissions: string[];
  tags: string[];
  interactive?: boolean;
  free?: boolean;
  bundled?: boolean;
  download_url: string | null;
}

interface Catalog {
  version: number;
  widgets: CatalogEntry[];
}

const PERM_COLORS: Record<string, string> = {
  system:     "#a78bfa",
  media:      "#34d399",
  launcher:   "#60a5fa",
  storage:    "#fbbf24",
  ui_effects: "#f472b6",
  network:    "#fb923c",
};

export function StoreSection() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refreshInstalled = useCallback(() => {
    invoke<WidgetSummary[]>("list_widgets").then((ws) =>
      setInstalled(new Set(ws.map((w) => w.id)))
    );
  }, []);

  useEffect(() => {
    refreshInstalled();
    const unsub = listen("vyntra://widgets-changed", refreshInstalled);

    const loadCatalog = async () => {
      try {
        const r = await fetch(CATALOG_URL);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const c = (await r.json()) as Catalog;
        setCatalog(c.widgets);
      } catch (_remoteErr) {
        if (CATALOG_URL !== CATALOG_FALLBACK_URL) {
          // Remote URL failed — silently fall back to the local bundled catalog.
          console.warn("[Store] Remote catalog unreachable, falling back to local catalog.json");
          try {
            const r = await fetch(CATALOG_FALLBACK_URL);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const c = (await r.json()) as Catalog;
            setCatalog(c.widgets);
            return;
          } catch (_localErr) {
            // local fallback also failed — show error below
          }
        }
        setLoadError("Could not load the catalog. Check your connection.");
      }
    };
    void loadCatalog();

    return () => { unsub.then((f) => f()); };
  }, [refreshInstalled]);

  const install = async (entry: CatalogEntry) => {
    if (!entry.download_url) return;
    setInstalling(entry.id);
    setInstallError(null);
    try {
      const res = await fetch(entry.download_url);
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      await invoke("install_widget_bytes", { bytes: Array.from(new Uint8Array(buf)) });
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setInstalling(null);
    }
  };

  const filtered = catalog
    ? catalog.filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : [];

  return (
    <div className="vyntra-section">
      <header className="vyntra-section-head">
        <h2>Store</h2>
        <p>Browse and install widgets.</p>
      </header>

      <input
        className="vyntra-store-search"
        type="search"
        placeholder="Search widgets…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loadError && <div className="vyntra-error">{loadError}</div>}
      {installError && (
        <div className="vyntra-error" style={{ cursor: "pointer" }} onClick={() => setInstallError(null)}>
          {installError} ✕
        </div>
      )}

      {catalog === null && !loadError && (
        <div className="vyntra-empty">Loading catalog…</div>
      )}

      {catalog !== null && filtered.length === 0 && (
        <div className="vyntra-empty">No widgets match "{search}".</div>
      )}

      {filtered.length > 0 && (
        <div className="vyntra-store-grid">
          {filtered.map((entry) => (
            <StoreCard
              key={entry.id}
              entry={entry}
              isInstalled={installed.has(entry.id)}
              isInstalling={installing === entry.id}
              onInstall={() => install(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreCard({
  entry,
  isInstalled,
  isInstalling,
  onInstall,
}: {
  entry: CatalogEntry;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}) {
  const initials = entry.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const accentColor = entry.permissions[0]
    ? PERM_COLORS[entry.permissions[0]] ?? "#5b8cff"
    : "#5b8cff";

  return (
    <div className="vyntra-store-card">
      <div className="vyntra-store-card-top">
        <div
          className="vyntra-store-avatar"
          style={{ background: `${accentColor}22`, color: accentColor }}
        >
          {initials}
        </div>
        <div className="vyntra-store-card-meta">
          <div className="vyntra-store-card-name">{entry.name}</div>
          <div className="vyntra-store-card-sub">
            by {entry.author} · v{entry.version} · {entry.size.w}×{entry.size.h}
          </div>
        </div>
      </div>

      <p className="vyntra-store-card-desc">{entry.description}</p>

      <div className="vyntra-store-card-footer">
        <div className="vyntra-store-tags">
          {entry.permissions.map((p) => (
            <span
              key={p}
              className="vyntra-perm-chip"
              style={{ background: `${PERM_COLORS[p] ?? "#5b8cff"}22`, color: PERM_COLORS[p] ?? "#a8c4ff" }}
            >
              {p}
            </span>
          ))}
          {entry.permissions.length === 0 && (
            <span className="vyntra-perms-none">no permissions</span>
          )}
          {entry.interactive !== false ? (
            <span className="vyntra-store-badge-interactive">interactive</span>
          ) : (
            <span className="vyntra-store-badge-display">display only</span>
          )}
        </div>

        <div className="vyntra-store-card-actions">
          {entry.bundled && (
            <span className="vyntra-store-badge-builtin">Built-in</span>
          )}
          {isInstalled ? (
            <span className="vyntra-store-badge-installed">Installed</span>
          ) : (
            <button
              className="vyntra-btn-primary"
              onClick={onInstall}
              disabled={!entry.download_url || isInstalling}
              title={!entry.download_url ? "Not yet available for download" : undefined}
            >
              {isInstalling ? "Installing…" : "Install"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
