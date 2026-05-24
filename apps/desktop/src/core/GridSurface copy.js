import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState, useRef } from "react";
import GridLayout, { useContainerWidth, } from "react-grid-layout";
import { invoke } from "@tauri-apps/api/core";
import { WidgetHost } from "../runtime/WidgetHost";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
export function GridSurface({ widgets, editMode }) {
    const { width, containerRef, mounted } = useContainerWidth();
    const [persisted, setPersisted] = useState({});
    const [loaded, setLoaded] = useState(false);
    const saveTimer = useRef(null);
    // Charge la position persistée au mount.
    useEffect(() => {
        invoke("load_layout").then((p) => {
            setPersisted(p);
            setLoaded(true);
        });
    }, []);
    // Auto-placement pour les nouveaux widgets sans position persistée.
    const layout = widgets.map((w, i) => {
        const saved = persisted[w.id];
        return {
            i: w.id,
            x: saved?.x ?? (i * w.size_w) % 24,
            y: saved?.y ?? 0,
            w: saved?.w ?? w.size_w,
            h: saved?.h ?? w.size_h,
        };
    });
    const onLayoutChange = (next) => {
        // Ne pas sauvegarder avant d'avoir chargé (sinon on écrase avec les defaults).
        if (!loaded)
            return;
        const obj = {};
        for (const item of next) {
            obj[item.i] = { x: item.x, y: item.y, w: item.w, h: item.h };
        }
        // Debounce 400ms — évite un write disque par pixel de drag.
        if (saveTimer.current)
            window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            invoke("save_layout", { layout: obj }).catch(console.error);
        }, 400);
    };
    return (_jsx("div", { ref: containerRef, children: mounted && (_jsx(GridLayout, { width: width, className: "vyntra-grid", layout: layout, gridConfig: {
                cols: 24,
                rowHeight: 60,
                margin: [12, 12],
            }, dragConfig: {
                enabled: editMode,
            }, resizeConfig: {
                enabled: editMode,
                handles: ["e", "n", "ne", "nw", "s", "se", "sw", "w"],
            }, onLayoutChange: onLayoutChange, children: widgets.map((w) => (_jsx("div", { className: "vyntra-cell", children: _jsx(WidgetHost, { widget: w }) }, w.id))) })) }));
}
