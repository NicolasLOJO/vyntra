import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useVyn } from "@vyntra/widget-shared";

interface AppEntry {
  id: string;
  name: string;
}

export default function App() {
  const vyn = useVyn();
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!vyn) return;
    try {
      const list: AppEntry[] = await vyn.launcher.apps();
      setApps(list);
      setError(null);
      // Fetch all icons in parallel then commit in one state update
      const results = await Promise.allSettled(
        list.map((app) =>
          vyn.launcher.getIcon(app.id).then((url: string | null) => ({ id: app.id, url }))
        )
      );
      const batch: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.url) batch[r.value.id] = r.value.url;
      }
      setIcons(batch);
    } catch {
      setError("Failed to load apps");
    }
  }, [vyn]);

  useEffect(() => {
    if (!vyn) return;
    loadApps();
    vyn.lifecycle.onWake(loadApps);
    vyn.lifecycle.onSleep(() => {});
  }, [vyn, loadApps]);

  const filtered = query.trim()
    ? apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    : apps;

  const launch = (id: string) => vyn?.launcher.launch(id).catch(() => {});

  return (
    <div className="h-screen w-screen relative overflow-hidden rounded-2xl flex flex-col px-3 py-3 gap-2" style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px) saturate(160%)" }}>
      {/* Very subtle blue hint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(124,168,255,0.06) 0%, transparent 50%)" }}
      />

      {/* Search bar */}
      <div className="relative z-10 flex-shrink-0">
        <Search
          size={11}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "rgba(255,255,255,0.25)" }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps…"
          className="w-full rounded-xl pl-7 pr-3 py-1.5 text-[11px] outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.75)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        />
      </div>

      {/* Grid */}
      <div
        className="relative z-10 flex-1 min-h-0 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {error ? (
          <div className="h-full flex items-center justify-center text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.22)" }}>
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[9px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.18)" }}>
            {query ? "No results" : "No apps"}
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
              gridAutoRows: "72px",
            }}
          >
            {filtered.map((app, i) => (
              <motion.button
                key={app.id}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.2), duration: 0.18 }}
                onClick={() => launch(app.id)}
                className="flex flex-col items-center gap-1 p-1.5 rounded-[14px] transition-all active:scale-95 cursor-pointer"
                style={{ border: "1px solid transparent" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {icons[app.id] ? (
                    <img src={icons[app.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {app.name[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </div>
                <span
                  className="text-[8px] font-medium text-center truncate w-full leading-tight"
                  style={{ color: "rgba(255,255,255,0.42)" }}
                >
                  {app.name}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
