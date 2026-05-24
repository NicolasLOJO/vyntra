import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback, useMemo, forwardRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GridSurface } from "./GridSurface";
import { installDispatcher } from "../runtime/dispatcher";
/**
 * Surface = overlay desktop. Ne contient QUE la grille de widgets.
 * Toute la gestion (Manager, Edit mode, Quit) est dans le tray system.
 *
 * Le label de la fenêtre détermine l'index du moniteur :
 *   "vyntra-surface"   → 0 (primaire)
 *   "vyntra-surface-1" → 1, etc.
 */
export function Surface() {
    const [widgets, setWidgets] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const widgetsRef = useRef([]);
    widgetsRef.current = widgets;
    // Onboarding : visible si premier lancement sans widgets actifs.
    const [showOnboarding, setShowOnboarding] = useState(false);
    // Hit-test : position de la fenêtre (px physiques) — stable, récupérée une fois.
    const [winPos, setWinPos] = useState({ x: 0, y: 0 });
    const devPanelRef = useRef(null);
    const [widgetCssRects, setWidgetCssRects] = useState([]);
    useEffect(() => {
        invoke("get_window_outer_position")
            .then(setWinPos)
            .catch(() => { });
    }, []);
    // Quand les rects CSS changent (widgets ou layout) OU quand la pos fenêtre arrive,
    // calcule les rects physiques écran et envoie à Rust.
    useEffect(() => {
        const dpr = window.devicePixelRatio || 1;
        const toPhys = (r) => ({
            x: Math.round(winPos.x + r.x * dpr),
            y: Math.round(winPos.y + r.y * dpr),
            w: Math.round(r.w * dpr),
            h: Math.round(r.h * dpr),
        });
        const rects = widgetCssRects.map(toPhys);
        // En dev : inclure le DevPanel pour qu'il reste cliquable.
        if (import.meta.env.DEV && devPanelRef.current) {
            const r = devPanelRef.current.getBoundingClientRect();
            rects.push(toPhys({ x: r.left, y: r.top, w: r.width, h: r.height }));
        }
        invoke("set_hit_rects", { rects }).catch(() => { });
    }, [widgetCssRects, winPos]);
    // Determine monitor index from window label (synchronous).
    const monitorIndex = (() => {
        const label = getCurrentWindow().label; // e.g. "vyntra-surface" or "vyntra-surface-2"
        const suffix = label.replace("vyntra-surface", "");
        return suffix ? parseInt(suffix.replace("-", ""), 10) || 0 : 0;
    })();
    const refresh = useCallback(() => {
        invoke("list_widgets").then(setWidgets);
    }, []);
    useEffect(() => {
        // Vérifie si c'est le premier lancement pour afficher l'onboarding.
        invoke("is_first_launch").then((first) => {
            if (first)
                setShowOnboarding(true);
        }).catch(() => { });
    }, []);
    useEffect(() => {
        refresh();
        const unlistenEdit = listen("vyntra://edit-mode", (e) => setEditMode(e.payload));
        const unlistenWidgets = listen("vyntra://widgets-changed", () => {
            refresh();
            // Masque l'onboarding dès qu'un widget devient visible.
            invoke("list_widgets").then((ws) => {
                if (ws.some((w) => w.visible))
                    setShowOnboarding(false);
            }).catch(() => { });
        });
        const unlistenKill = listen("widget://kill", (e) => {
            setWidgets((prev) => prev.filter((w) => w.id !== e.payload));
        });
        const stopDispatcher = installDispatcher(() => widgetsRef.current);
        return () => {
            unlistenEdit.then((f) => f());
            unlistenWidgets.then((f) => f());
            unlistenKill.then((f) => f());
            stopDispatcher();
        };
    }, [refresh]);
    const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);
    const handleAddStarterWidgets = useCallback(() => {
        const makeVisible = (id) => invoke("set_widget_visible", { id, visible: true }).catch(() => { });
        Promise.all([
            makeVisible("com.vyntra.clock-modern"),
            makeVisible("com.vyntra.cpu-modern"),
        ]);
    }, []);
    // Compare before updating state to avoid infinite re-render loop:
    // notifyRects fires → setWidgetCssRects → Surface re-renders → new visibleWidgets ref →
    // myWidgets rememoizes → notifyRects reference changes → effect re-fires → repeat.
    const handleHitRectsChange = useCallback((rects) => {
        setWidgetCssRects((prev) => {
            if (prev.length === rects.length &&
                prev.every((r, i) => r.x === rects[i].x &&
                    r.y === rects[i].y &&
                    r.w === rects[i].w &&
                    r.h === rects[i].h))
                return prev;
            return rects;
        });
    }, []);
    return (_jsxs("div", { className: "vyntra-surface", "data-edit": editMode, children: [_jsx(GridSurface, { widgets: visibleWidgets, editMode: editMode, monitorIndex: monitorIndex, onHitRectsChange: handleHitRectsChange }), showOnboarding && (_jsx("div", { className: "vyntra-onboarding-backdrop", children: _jsxs("div", { className: "vyntra-onboarding-card", children: [_jsx("h1", { className: "vyntra-onboarding-title", children: "Welcome to Vyntra" }), _jsxs("p", { className: "vyntra-onboarding-hint", children: ["Right-click the tray icon \u2192 ", _jsx("strong", { children: "Open Manager" }), " to add your first widgets."] }), _jsx("button", { className: "vyntra-onboarding-btn", onClick: handleAddStarterWidgets, children: "Add starter widgets" })] }) })), import.meta.env.DEV && (_jsx(DevPanel, { ref: devPanelRef, widgets: widgets, visibleCount: visibleWidgets.length, editMode: editMode, monitorIndex: monitorIndex }))] }));
}
// ─── Dev panel ────────────────────────────────────────────────────────────────
const LIFECYCLE_ACTIONS = [
    { key: "sleep", label: "sleep", title: "widget://sleep" },
    { key: "wake", label: "wake", title: "widget://wake" },
    { key: "throttle", label: "thr", title: "widget://throttle" },
    { key: "unthrottle", label: "unthr", title: "widget://unthrottle" },
    { key: "kill", label: "kill", title: "widget://kill" },
];
const DevPanel = forwardRef(function DevPanel({ widgets, visibleCount, editMode, monitorIndex }, ref) {
    const fire = (widgetId, action) => emit(`widget://${action}`, widgetId);
    const shortId = (id) => id.split(".").pop() ?? id;
    return (_jsxs("div", { ref: ref, className: "vyntra-dev-panel", children: [_jsx("strong", { children: "Vyntra dev" }), _jsxs("div", { className: "vyntra-dev-row", children: [_jsx("span", { children: "monitor" }), _jsx("span", { children: monitorIndex })] }), _jsxs("div", { className: "vyntra-dev-row", children: [_jsx("span", { children: "widgets" }), _jsxs("span", { children: [visibleCount, "/", widgets.length] })] }), _jsxs("div", { className: "vyntra-dev-row", children: [_jsx("span", { children: "edit" }), _jsx("span", { children: editMode ? "on" : "off" })] }), widgets.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "vyntra-dev-divider" }), widgets.map((w) => (_jsxs("div", { className: "vyntra-dev-widget-row", children: [_jsx("span", { className: "vyntra-dev-widget-id", title: w.id, children: shortId(w.id) }), _jsx("span", { className: "vyntra-dev-actions", children: LIFECYCLE_ACTIONS.map(({ key, label, title }) => (_jsx("button", { className: `vyntra-dev-btn vyntra-dev-btn--${key}`, title: title, onClick: () => fire(w.id, key), children: label }, key))) })] }, w.id)))] }))] }));
});
