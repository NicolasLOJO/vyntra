import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
export function WidgetsSection() {
    const [widgets, setWidgets] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [monitorCount, setMonitorCount] = useState(1);
    const refresh = useCallback(() => {
        invoke("list_widgets").then(setWidgets);
    }, []);
    useEffect(() => {
        refresh();
        invoke("get_monitor_count").then(setMonitorCount);
        const unlisten = listen("vyntra://widgets-changed", refresh);
        return () => { unlisten.then((f) => f()); };
    }, [refresh]);
    const toggleVisible = async (w) => {
        await invoke("set_widget_visible", { id: w.id, visible: !w.visible });
    };
    const uninstall = async (w) => {
        if (!confirm(`Uninstall ${w.display_name ?? w.name}?`))
            return;
        await invoke("uninstall_widget", { id: w.id });
        if (expanded === w.id)
            setExpanded(null);
    };
    const onDrop = async (e) => {
        e.preventDefault();
        setError(null);
        const file = e.dataTransfer.files[0];
        if (!file || !file.name.endsWith(".vyn")) {
            setError("Drop a .vyn file");
            return;
        }
        setBusy(true);
        try {
            const buf = await file.arrayBuffer();
            await invoke("install_widget_bytes", { bytes: Array.from(new Uint8Array(buf)) });
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "vyntra-section", children: [_jsxs("header", { className: "vyntra-section-head", children: [_jsx("h2", { children: "Widgets" }), _jsx("p", { children: "Manage the widgets running on your desktop." })] }), _jsx("div", { className: "vyntra-drop-zone", onDragOver: (e) => e.preventDefault(), onDrop: onDrop, "data-busy": busy, children: busy ? "Installing…" : "Drop a .vyn file here to install" }), error && _jsx("div", { className: "vyntra-error", children: error }), _jsxs("ul", { className: "vyntra-widget-list", children: [widgets.length === 0 && _jsx("li", { className: "vyntra-empty", children: "No widgets installed yet." }), widgets.map((w) => (_jsxs("li", { className: "vyntra-widget-item", children: [_jsxs("div", { className: "vyntra-widget-row", children: [_jsxs("div", { className: "vyntra-widget-info", children: [_jsx("div", { className: "vyntra-widget-name", children: w.display_name ?? w.name }), _jsxs("div", { className: "vyntra-widget-meta", children: [_jsx("code", { children: w.id }), " \u00B7 v", w.version, " \u00B7 ", w.size_w, "\u00D7", w.size_h] }), _jsx(PermChips, { perms: w.permissions })] }), _jsxs("div", { className: "vyntra-widget-actions", children: [_jsx("button", { className: `vyntra-btn-config${expanded === w.id ? " active" : ""}`, onClick: () => setExpanded(expanded === w.id ? null : w.id), title: "Configure", children: "\u2699" }), _jsxs("label", { className: "vyntra-toggle", children: [_jsx("input", { type: "checkbox", checked: w.visible, onChange: () => toggleVisible(w) }), _jsx("span", { children: w.visible ? "Visible" : "Hidden" })] }), _jsx("button", { className: "vyntra-btn-danger", onClick: () => uninstall(w), children: "Uninstall" })] })] }), expanded === w.id && (_jsx(WidgetConfigPanel, { widget: w, monitorCount: monitorCount }))] }, w.id)))] })] }));
}
function PermChips({ perms }) {
    const active = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
    if (active.length === 0)
        return _jsx("div", { className: "vyntra-perms vyntra-perms-none", children: "no permissions" });
    return (_jsx("div", { className: "vyntra-perms", children: active.map((p) => _jsx("span", { className: "vyntra-perm-chip", children: p }, p)) }));
}
function WidgetConfigPanel({ widget, monitorCount }) {
    const [displayName, setDisplayName] = useState(widget.display_name ?? widget.name);
    const [monitor, setMonitor] = useState(0);
    const [config, setConfig] = useState({});
    useEffect(() => {
        invoke("widget_config_get_all", { widgetId: widget.id }).then(setConfig);
        invoke("load_layout")
            .then((layout) => setMonitor(layout[widget.id]?.monitor ?? 0));
    }, [widget.id]);
    const saveName = async () => {
        await invoke("rename_widget", { id: widget.id, displayName });
    };
    const saveMonitor = async (m) => {
        setMonitor(m);
        await invoke("set_widget_monitor", { id: widget.id, monitor: m });
    };
    const saveConfigField = async (key, value) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        await invoke("widget_config_set", { widgetId: widget.id, key, value });
    };
    const configEntries = Object.entries(widget.config_schema);
    return (_jsx("div", { className: "vyntra-config-panel", children: _jsxs("div", { className: "vyntra-config-grid", children: [_jsxs("div", { className: "vyntra-config-row", children: [_jsx("label", { className: "vyntra-config-label", children: "Display name" }), _jsx("input", { className: "vyntra-config-input", value: displayName, onChange: (e) => setDisplayName(e.target.value), onBlur: saveName, placeholder: widget.name })] }), monitorCount > 1 && (_jsxs("div", { className: "vyntra-config-row", children: [_jsx("label", { className: "vyntra-config-label", children: "Monitor" }), _jsx("select", { className: "vyntra-config-select", value: monitor, onChange: (e) => saveMonitor(Number(e.target.value)), children: Array.from({ length: monitorCount }, (_, i) => (_jsxs("option", { value: i, children: ["Monitor ", i === 0 ? "0 (primary)" : i] }, i))) })] })), configEntries.map(([key, field]) => (_jsx(ConfigFieldRow, { fieldKey: key, field: field, value: config[key] ?? field.default, onChange: (v) => saveConfigField(key, v) }, key))), configEntries.length === 0 && monitorCount <= 1 && (_jsx("p", { className: "vyntra-config-empty", children: "No additional settings for this widget." }))] }) }));
}
function ConfigFieldRow({ fieldKey, field, value, onChange, }) {
    return (_jsxs("div", { className: "vyntra-config-row", children: [_jsxs("label", { className: "vyntra-config-label", title: field.description ?? "", children: [field.label, field.description && _jsxs("span", { className: "vyntra-config-hint", children: [" \u2014 ", field.description] })] }), _jsx(ConfigFieldInput, { fieldKey: fieldKey, field: field, value: value, onChange: onChange })] }));
}
function ConfigFieldInput({ fieldKey: _fieldKey, field, value, onChange, }) {
    switch (field.type) {
        case "boolean":
            return (_jsx("input", { type: "checkbox", className: "vyntra-config-checkbox", checked: Boolean(value), onChange: (e) => onChange(e.target.checked) }));
        case "number":
            return (_jsxs("div", { className: "vyntra-config-number-row", children: [_jsx("input", { type: "range", className: "vyntra-config-range", min: field.min ?? 0, max: field.max ?? 100, step: 1, value: Number(value ?? field.min ?? 0), onChange: (e) => onChange(Number(e.target.value)) }), _jsx("span", { className: "vyntra-config-number-val", children: Number(value ?? field.min ?? 0) })] }));
        case "select":
            return (_jsx("select", { className: "vyntra-config-select", value: String(value ?? field.default ?? ""), onChange: (e) => onChange(e.target.value), children: (field.options ?? []).map((opt) => (_jsx("option", { value: opt, children: opt }, opt))) }));
        case "color":
            return (_jsx("input", { type: "color", className: "vyntra-config-color", value: String(value ?? field.default ?? "#ffffff"), onChange: (e) => onChange(e.target.value) }));
        case "string":
        default:
            return (_jsx("input", { type: "text", className: "vyntra-config-input", value: String(value ?? ""), onChange: (e) => onChange(e.target.value), onBlur: (e) => onChange(e.target.value), placeholder: String(field.default ?? "") }));
    }
}
