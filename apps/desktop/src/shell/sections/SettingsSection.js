import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
export function SettingsSection() {
    const [settings, setSettings] = useState(null);
    const [error, setError] = useState(null);
    const [capturing, setCapturing] = useState(false);
    const captureRef = useRef(null);
    useEffect(() => {
        invoke("get_settings")
            .then(setSettings)
            .catch((e) => setError(String(e)));
    }, []);
    async function save(patch) {
        if (!settings)
            return;
        const next = { ...settings, ...patch };
        setSettings(next);
        setError(null);
        try {
            await invoke("set_settings", { settings: next });
        }
        catch (e) {
            setError(String(e));
        }
    }
    function startCapture() {
        setCapturing(true);
        captureRef.current?.focus();
    }
    function handleShortcutKey(e) {
        if (!capturing)
            return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") {
            setCapturing(false);
            return;
        }
        // Ignore bare modifier keys
        if (["Control", "Alt", "Shift", "Meta"].includes(e.key))
            return;
        const parts = [];
        if (e.ctrlKey)
            parts.push("Ctrl");
        if (e.altKey)
            parts.push("Alt");
        if (e.shiftKey)
            parts.push("Shift");
        if (e.metaKey)
            parts.push("Super");
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
        const shortcut = parts.join("+");
        setCapturing(false);
        invoke("set_edit_shortcut", { shortcut })
            .then(() => setSettings((s) => s ? { ...s, edit_mode_shortcut: shortcut } : s))
            .catch((e) => setError(String(e)));
    }
    function formatShortcut(s) {
        return s.split("+").map((k) => _jsx("kbd", { children: k }, k));
    }
    if (!settings) {
        return (_jsxs("div", { className: "vyntra-section", children: [_jsx("header", { className: "vyntra-section-head", children: _jsx("h2", { children: "Settings" }) }), error ? _jsx("div", { className: "vyntra-error", children: error }) : _jsx("p", { style: { opacity: 0.5 }, children: "Loading\u2026" })] }));
    }
    return (_jsxs("div", { className: "vyntra-section", children: [_jsxs("header", { className: "vyntra-section-head", children: [_jsx("h2", { children: "Settings" }), _jsx("p", { children: "Global preferences for Vyntra." })] }), error && _jsx("div", { className: "vyntra-error", children: error }), _jsxs("div", { className: "vyntra-settings-group", children: [_jsx("div", { className: "vyntra-settings-group-title", children: "General" }), _jsxs("label", { className: "vyntra-settings-row", children: [_jsxs("div", { className: "vyntra-settings-label", children: [_jsx("span", { children: "Launch at startup" }), _jsx("span", { className: "vyntra-settings-hint", children: "Start Vyntra automatically when you log in." })] }), _jsx("input", { type: "checkbox", className: "vyntra-toggle-input", checked: settings.autostart, onChange: (e) => save({ autostart: e.target.checked }) })] }), _jsxs("div", { className: "vyntra-settings-row", children: [_jsxs("div", { className: "vyntra-settings-label", children: [_jsx("span", { children: "Edit mode shortcut" }), _jsx("span", { className: "vyntra-settings-hint", children: "Toggle widget edit mode from anywhere." })] }), _jsx("div", { className: "vyntra-settings-shortcut", children: capturing ? (_jsx("button", { ref: captureRef, className: "vyntra-shortcut-capture", onKeyDown: handleShortcutKey, onBlur: () => setCapturing(false), autoFocus: true, children: "Press keys\u2026" })) : (_jsx("button", { className: "vyntra-shortcut-display", onClick: startCapture, children: settings.edit_mode_shortcut
                                        ? formatShortcut(settings.edit_mode_shortcut)
                                        : _jsx("span", { style: { opacity: 0.4 }, children: "Not set" }) })) })] })] }), _jsxs("div", { className: "vyntra-settings-group", children: [_jsx("div", { className: "vyntra-settings-group-title", children: "Performance" }), _jsxs("label", { className: "vyntra-settings-row", children: [_jsxs("div", { className: "vyntra-settings-label", children: [_jsx("span", { children: "Sleep on fullscreen" }), _jsx("span", { className: "vyntra-settings-hint", children: "Pause widgets when a fullscreen app is active." })] }), _jsx("input", { type: "checkbox", className: "vyntra-toggle-input", checked: settings.sleep_on_fullscreen, onChange: (e) => save({ sleep_on_fullscreen: e.target.checked }) })] }), _jsxs("div", { className: "vyntra-settings-row", children: [_jsxs("div", { className: "vyntra-settings-label", children: [_jsx("span", { children: "CPU throttle threshold" }), _jsx("span", { className: "vyntra-settings-hint", children: "Slow down widgets when CPU usage exceeds this." })] }), _jsxs("div", { className: "vyntra-settings-slider", children: [_jsx("input", { type: "range", min: 50, max: 95, step: 5, value: settings.cpu_throttle_threshold, onChange: (e) => save({ cpu_throttle_threshold: Number(e.target.value) }) }), _jsxs("span", { className: "vyntra-settings-slider-val", children: [settings.cpu_throttle_threshold, "%"] })] })] })] })] }));
}
