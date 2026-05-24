import { invoke } from "@tauri-apps/api/core";
import { resolveWidgetId } from "./registry";
const METHODS = {
    "system.snapshot": { command: "snapshot", capability: "system" },
    "media.nowPlaying": { command: "get_now_playing", capability: "media" },
    "media.play": { command: "media_play", capability: "media" },
    "media.pause": { command: "media_pause", capability: "media" },
    "media.next": { command: "media_next", capability: "media" },
    "media.previous": { command: "media_previous", capability: "media" },
    "launcher.apps": { command: "launcher_apps", capability: "launcher" },
    "launcher.getIcon": {
        command: "launcher_get_icon",
        capability: "launcher",
        mapArgs: (p) => ({ id: p.id }),
    },
    "launcher.launch": {
        command: "launcher_launch",
        capability: "launcher",
        mapArgs: (p) => ({ id: p.id }),
    },
    "storage.get": {
        command: "storage_get",
        capability: "storage",
        mapArgs: (p) => ({ key: p.key }),
    },
    "storage.set": {
        command: "storage_set",
        capability: "storage",
        mapArgs: (p) => ({
            key: p.key,
            value: p.value,
        }),
    },
    "storage.delete": {
        command: "storage_delete",
        capability: "storage",
        mapArgs: (p) => ({ key: p.key }),
    },
    "storage.keys": { command: "storage_keys", capability: "storage" },
    "config.getAll": { command: "widget_config_get_all", capability: null, injectWidgetId: true },
    "config.set": {
        command: "widget_config_set",
        capability: null,
        injectWidgetId: true,
        mapArgs: (p) => ({
            key: p.key,
            value: p.value,
        }),
    },
};
function isVynCall(msg) {
    return (!!msg &&
        typeof msg === "object" &&
        msg.type === "vyn:call");
}
/** Capability requise ⇄ flag dans WidgetSummary.permissions. */
function hasCapability(widget, cap) {
    return Boolean(widget.permissions?.[cap]);
}
export function installDispatcher(getWidgets) {
    const handler = async (event) => {
        const msg = event.data;
        if (!isVynCall(msg))
            return;
        const source = event.source;
        if (!source)
            return;
        // Résolution de l'identité depuis le registry — le msg.widgetId n'est
        // pas utilisé pour éviter l'usurpation inter-widget.
        const widgetId = resolveWidgetId(source);
        if (!widgetId)
            return;
        const reply = (payload) => source.postMessage({ type: "vyn:response", id: msg.id, ...payload }, "*");
        const spec = METHODS[msg.method];
        if (!spec) {
            reply({ ok: false, error: `unknown method: ${msg.method}` });
            return;
        }
        const widget = getWidgets().find((w) => w.id === widgetId);
        if (!widget) {
            reply({ ok: false, error: `unknown widget: ${widgetId}` });
            return;
        }
        // Pré-check côté front (le backend re-vérifie de toute façon).
        if (spec.capability && !hasCapability(widget, spec.capability)) {
            reply({
                ok: false,
                error: `widget '${widget.id}' lacks permission '${spec.capability}'`,
            });
            return;
        }
        try {
            const baseArgs = spec.mapArgs ? spec.mapArgs(msg.params) : {};
            const args = (spec.capability || spec.injectWidgetId)
                ? { ...baseArgs, widgetId: widget.id }
                : baseArgs;
            const result = await invoke(spec.command, args);
            reply({ ok: true, result });
        }
        catch (e) {
            reply({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
}
