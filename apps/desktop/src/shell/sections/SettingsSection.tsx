import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppSettings {
  autostart: boolean;
  sleep_on_fullscreen: boolean;
  cpu_throttle_threshold: number;
  edit_mode_shortcut: string;
}

export function SettingsSection() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then(setSettings)
      .catch((e) => setError(String(e)));
  }, []);

  async function save(patch: Partial<AppSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    try {
      await invoke("set_settings", { settings: next });
    } catch (e) {
      setError(String(e));
    }
  }

  function startCapture() {
    setCapturing(true);
    captureRef.current?.focus();
  }

  function handleShortcutKey(e: React.KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setCapturing(false);
      return;
    }
    // Ignore bare modifier keys
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey)  parts.push("Ctrl");
    if (e.altKey)   parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey)  parts.push("Super");
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

    const shortcut = parts.join("+");
    setCapturing(false);

    invoke("set_edit_shortcut", { shortcut })
      .then(() => setSettings((s) => s ? { ...s, edit_mode_shortcut: shortcut } : s))
      .catch((e) => setError(String(e)));
  }

  function formatShortcut(s: string) {
    return s.split("+").map((k) => <kbd key={k}>{k}</kbd>);
  }

  if (!settings) {
    return (
      <div className="vyntra-section">
        <header className="vyntra-section-head"><h2>Settings</h2></header>
        {error ? <div className="vyntra-error">{error}</div> : <p style={{ opacity: 0.5 }}>Loading…</p>}
      </div>
    );
  }

  return (
    <div className="vyntra-section">
      <header className="vyntra-section-head">
        <h2>Settings</h2>
        <p>Global preferences for Vyntra.</p>
      </header>

      {error && <div className="vyntra-error">{error}</div>}

      <div className="vyntra-settings-group">
        <div className="vyntra-settings-group-title">General</div>

        <label className="vyntra-settings-row">
          <div className="vyntra-settings-label">
            <span>Launch at startup</span>
            <span className="vyntra-settings-hint">Start Vyntra automatically when you log in.</span>
          </div>
          <input
            type="checkbox"
            className="vyntra-toggle-input"
            checked={settings.autostart}
            onChange={(e) => save({ autostart: e.target.checked })}
          />
        </label>

        <div className="vyntra-settings-row">
          <div className="vyntra-settings-label">
            <span>Edit mode shortcut</span>
            <span className="vyntra-settings-hint">Toggle widget edit mode from anywhere.</span>
          </div>
          <div className="vyntra-settings-shortcut">
            {capturing ? (
              <button
                ref={captureRef}
                className="vyntra-shortcut-capture"
                onKeyDown={handleShortcutKey}
                onBlur={() => setCapturing(false)}
                autoFocus
              >
                Press keys…
              </button>
            ) : (
              <button className="vyntra-shortcut-display" onClick={startCapture}>
                {settings.edit_mode_shortcut
                  ? formatShortcut(settings.edit_mode_shortcut)
                  : <span style={{ opacity: 0.4 }}>Not set</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="vyntra-settings-group">
        <div className="vyntra-settings-group-title">Performance</div>

        <label className="vyntra-settings-row">
          <div className="vyntra-settings-label">
            <span>Sleep on fullscreen</span>
            <span className="vyntra-settings-hint">Pause widgets when a fullscreen app is active.</span>
          </div>
          <input
            type="checkbox"
            className="vyntra-toggle-input"
            checked={settings.sleep_on_fullscreen}
            onChange={(e) => save({ sleep_on_fullscreen: e.target.checked })}
          />
        </label>

        <div className="vyntra-settings-row">
          <div className="vyntra-settings-label">
            <span>CPU throttle threshold</span>
            <span className="vyntra-settings-hint">Slow down widgets when CPU usage exceeds this.</span>
          </div>
          <div className="vyntra-settings-slider">
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={settings.cpu_throttle_threshold}
              onChange={(e) => save({ cpu_throttle_threshold: Number(e.target.value) })}
            />
            <span className="vyntra-settings-slider-val">{settings.cpu_throttle_threshold}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
