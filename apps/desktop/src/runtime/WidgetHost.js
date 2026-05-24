import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { buildBridgeScript } from "./bridge";
import { registerWidget, unregisterWidget } from "./registry";
/**
 * URL du protocole custom selon la plateforme.
 * - Windows: WebView2 expose le custom protocol via `http://<scheme>.localhost/`
 * - macOS/Linux: l'URI `<scheme>://` est utilisable telle quelle.
 */
function widgetUrl(widgetId, asset) {
    const isWindows = navigator.userAgent.includes("Windows");
    return isWindows
        ? `http://vyntra.localhost/${widgetId}/${asset}`
        : `vyntra://${widgetId}/${asset}`;
}
export function WidgetHost({ widget }) {
    const ref = useRef(null);
    useEffect(() => {
        const iframe = ref.current;
        if (!iframe)
            return;
        const onLoad = () => {
            const win = iframe.contentWindow;
            console.log("iframe loaded", win);
            if (!win)
                return;
            registerWidget(win, widget.id);
            win.postMessage({ type: "vyn:init", widgetId: widget.id, bridge: buildBridgeScript() }, "*");
        };
        iframe.addEventListener("load", onLoad);
        return () => {
            iframe.removeEventListener("load", onLoad);
            if (iframe.contentWindow)
                unregisterWidget(iframe.contentWindow);
        };
    }, [widget.id]);
    // Forward watchdog lifecycle events to the widget iframe.
    useEffect(() => {
        const forward = (event) => {
            ref.current?.contentWindow?.postMessage({ type: "vyn:event", event }, "*");
        };
        const forwardIf = (event) => (e) => {
            if (e.payload === widget.id)
                forward(event);
        };
        // media://change : payload global (NowPlaying), pas de filtre par widget id.
        const forwardGlobal = (event) => (e) => {
            ref.current?.contentWindow?.postMessage({ type: "vyn:event", event, payload: e.payload }, "*");
        };
        const forwardConfig = (e) => {
            if (e.payload.widget_id !== widget.id)
                return;
            ref.current?.contentWindow?.postMessage({ type: "vyn:event", event: "config.change", payload: { key: e.payload.key, value: e.payload.value } }, "*");
        };
        const unsubs = [
            listen("widget://sleep", forwardIf("lifecycle.sleep")),
            listen("widget://wake", forwardIf("lifecycle.wake")),
            listen("widget://throttle", forwardIf("lifecycle.throttle")),
            listen("widget://unthrottle", forwardIf("lifecycle.unthrottle")),
            listen("media://change", forwardGlobal("media.change")),
            listen("vyntra://config-changed", forwardConfig),
        ];
        return () => { unsubs.forEach((p) => p.then((f) => f())); };
    }, [widget.id]);
    return (_jsx("iframe", { ref: ref, title: widget.name, src: widgetUrl(widget.id, "host.html"), sandbox: "allow-scripts allow-same-origin allow-top-navigation-to-custom-protocols", className: "vyntra-widget-frame" }));
}
