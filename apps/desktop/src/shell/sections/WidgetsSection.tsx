import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WidgetSummary, ConfigField } from "../../core/types";

export function WidgetsSection() {
  const [widgets, setWidgets] = useState<WidgetSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [monitorCount, setMonitorCount] = useState(1);

  const refresh = useCallback(() => {
    invoke<WidgetSummary[]>("list_widgets").then(setWidgets);
  }, []);

  useEffect(() => {
    refresh();
    invoke<number>("get_monitor_count").then(setMonitorCount);
    const unlisten = listen("vyntra://widgets-changed", refresh);
    return () => { unlisten.then((f) => f()); };
  }, [refresh]);

  const toggleVisible = async (w: WidgetSummary) => {
    await invoke("set_widget_visible", { id: w.id, visible: !w.visible });
  };

  const uninstall = async (w: WidgetSummary) => {
    if (!confirm(`Uninstall ${w.display_name ?? w.name}?`)) return;
    await invoke("uninstall_widget", { id: w.id });
    if (expanded === w.id) setExpanded(null);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setError(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".vyn")) { setError("Drop a .vyn file"); return; }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      await invoke("install_widget_bytes", { bytes: Array.from(new Uint8Array(buf)) });
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="vyntra-section">
      <header className="vyntra-section-head">
        <h2>Widgets</h2>
        <p>Manage the widgets running on your desktop.</p>
      </header>
      <div className="vyntra-drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} data-busy={busy}>
        {busy ? "Installing…" : "Drop a .vyn file here to install"}
      </div>
      {error && <div className="vyntra-error">{error}</div>}
      <ul className="vyntra-widget-list">
        {widgets.length === 0 && <li className="vyntra-empty">No widgets installed yet.</li>}
        {widgets.map((w) => (
          <li key={w.id} className="vyntra-widget-item">
            <div className="vyntra-widget-row">
              <div className="vyntra-widget-info">
                <div className="vyntra-widget-name">{w.display_name ?? w.name}</div>
                <div className="vyntra-widget-meta">
                  <code>{w.id}</code> · v{w.version} · {w.size_w}×{w.size_h}
                </div>
                <PermChips perms={w.permissions} />
              </div>
              <div className="vyntra-widget-actions">
                <button
                  className={`vyntra-btn-config${expanded === w.id ? " active" : ""}`}
                  onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                  title="Configure"
                >
                  ⚙
                </button>
                <label className="vyntra-toggle">
                  <input type="checkbox" checked={w.visible} onChange={() => toggleVisible(w)} />
                  <span>{w.visible ? "Visible" : "Hidden"}</span>
                </label>
                <button className="vyntra-btn-danger" onClick={() => uninstall(w)}>Uninstall</button>
              </div>
            </div>
            {expanded === w.id && (
              <WidgetConfigPanel widget={w} monitorCount={monitorCount} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PermChips({ perms }: { perms: WidgetSummary["permissions"] }) {
  const active = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
  if (active.length === 0) return <div className="vyntra-perms vyntra-perms-none">no permissions</div>;
  return (
    <div className="vyntra-perms">
      {active.map((p) => <span key={p} className="vyntra-perm-chip">{p}</span>)}
    </div>
  );
}

function WidgetConfigPanel({ widget, monitorCount }: { widget: WidgetSummary; monitorCount: number }) {
  const [displayName, setDisplayName] = useState(widget.display_name ?? widget.name);
  const [monitor, setMonitor] = useState(0);
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    invoke<Record<string, unknown>>("widget_config_get_all", { widgetId: widget.id }).then(setConfig);
    invoke<Record<string, { x: number; y: number; w: number; h: number; monitor?: number }>>("load_layout")
      .then((layout) => setMonitor(layout[widget.id]?.monitor ?? 0));
  }, [widget.id]);

  const saveName = async () => {
    await invoke("rename_widget", { id: widget.id, displayName });
  };

  const saveMonitor = async (m: number) => {
    setMonitor(m);
    await invoke("set_widget_monitor", { id: widget.id, monitor: m });
  };

  const saveConfigField = async (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    await invoke("widget_config_set", { widgetId: widget.id, key, value });
  };

  const configEntries = Object.entries(widget.config_schema);

  return (
    <div className="vyntra-config-panel">
      <div className="vyntra-config-grid">
        {/* Display name */}
        <div className="vyntra-config-row">
          <label className="vyntra-config-label">Display name</label>
          <input
            className="vyntra-config-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveName}
            placeholder={widget.name}
          />
        </div>

        {/* Monitor assignment */}
        {monitorCount > 1 && (
          <div className="vyntra-config-row">
            <label className="vyntra-config-label">Monitor</label>
            <select
              className="vyntra-config-select"
              value={monitor}
              onChange={(e) => saveMonitor(Number(e.target.value))}
            >
              {Array.from({ length: monitorCount }, (_, i) => (
                <option key={i} value={i}>
                  Monitor {i === 0 ? "0 (primary)" : i}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Widget-specific config fields */}
        {configEntries.map(([key, field]) => (
          <ConfigFieldRow
            key={key}
            fieldKey={key}
            field={field}
            value={config[key] ?? field.default}
            onChange={(v) => saveConfigField(key, v)}
          />
        ))}

        {configEntries.length === 0 && monitorCount <= 1 && (
          <p className="vyntra-config-empty">No additional settings for this widget.</p>
        )}
      </div>
    </div>
  );
}

function ConfigFieldRow({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="vyntra-config-row">
      <label className="vyntra-config-label" title={field.description ?? ""}>
        {field.label}
        {field.description && <span className="vyntra-config-hint"> — {field.description}</span>}
      </label>
      <ConfigFieldInput fieldKey={fieldKey} field={field} value={value} onChange={onChange} />
    </div>
  );
}

function ConfigFieldInput({
  fieldKey: _fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "boolean":
      return (
        <input
          type="checkbox"
          className="vyntra-config-checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <div className="vyntra-config-number-row">
          <input
            type="range"
            className="vyntra-config-range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={1}
            value={Number(value ?? field.min ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="vyntra-config-number-val">{Number(value ?? field.min ?? 0)}</span>
        </div>
      );
    case "select":
      return (
        <select
          className="vyntra-config-select"
          value={String(value ?? field.default ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "color":
      return (
        <input
          type="color"
          className="vyntra-config-color"
          value={String(value ?? field.default ?? "#ffffff")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "string":
    default:
      return (
        <input
          type="text"
          className="vyntra-config-input"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(e.target.value)}
          placeholder={String(field.default ?? "")}
        />
      );
  }
}
