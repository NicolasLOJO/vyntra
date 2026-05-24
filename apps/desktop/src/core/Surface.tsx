import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GridSurface } from "./GridSurface";
import { installDispatcher } from "../runtime/dispatcher";
import type { WidgetSummary } from "./types";

interface CssRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Surface = overlay desktop. Ne contient QUE la grille de widgets.
 * Toute la gestion (Manager, Edit mode, Quit) est dans le tray system.
 *
 * Le label de la fenêtre détermine l'index du moniteur :
 *   "vyntra-surface"   → 0 (primaire)
 *   "vyntra-surface-1" → 1, etc.
 */
export function Surface() {
  const [widgets, setWidgets] = useState<WidgetSummary[]>([]);
  const [editMode, setEditMode] = useState(false);
  const widgetsRef = useRef<WidgetSummary[]>([]);
  widgetsRef.current = widgets;

  // Onboarding : visible si premier lancement sans widgets actifs.
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Hit-test : position de la fenêtre (px physiques) — stable, récupérée une fois.
  const [winPos, setWinPos] = useState({ x: 0, y: 0 });
  const devPanelRef = useRef<HTMLDivElement>(null);
  const [widgetCssRects, setWidgetCssRects] = useState<CssRect[]>([]);

  useEffect(() => {
    invoke<{ x: number; y: number }>("get_window_outer_position")
      .then(setWinPos)
      .catch(() => {});
  }, []);

  // Quand les rects CSS changent (widgets ou layout) OU quand la pos fenêtre arrive,
  // calcule les rects physiques écran et envoie à Rust.
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const toPhys = (r: CssRect) => ({
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
    console.log("set_hit_rects", rects);
    invoke("set_hit_rects", { rects }).catch(() => {});
  }, [widgetCssRects, winPos]);

  // Determine monitor index from window label (synchronous).
  const monitorIndex = (() => {
    const label = getCurrentWindow().label; // e.g. "vyntra-surface" or "vyntra-surface-2"
    const suffix = label.replace("vyntra-surface", "");
    return suffix ? parseInt(suffix.replace("-", ""), 10) || 0 : 0;
  })();

  const refresh = useCallback(() => {
    invoke<WidgetSummary[]>("list_widgets").then(setWidgets);
  }, []);

  useEffect(() => {
    // Vérifie si c'est le premier lancement pour afficher l'onboarding.
    invoke<boolean>("is_first_launch")
      .then((first) => {
        if (first) setShowOnboarding(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();

    const unlistenEdit = listen<boolean>("vyntra://edit-mode", (e) =>
      setEditMode(e.payload),
    );
    const unlistenWidgets = listen("vyntra://widgets-changed", () => {
      refresh();
      // Masque l'onboarding dès qu'un widget devient visible.
      invoke<WidgetSummary[]>("list_widgets")
        .then((ws) => {
          if (ws.some((w) => w.visible)) setShowOnboarding(false);
        })
        .catch(() => {});
    });
    const unlistenKill = listen<string>("widget://kill", (e) => {
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

  const visibleWidgets = useMemo(
    () => widgets.filter((w) => w.visible),
    [widgets],
  );

  const handleAddStarterWidgets = useCallback(() => {
    const makeVisible = (id: string) =>
      invoke("set_widget_visible", { id, visible: true }).catch(() => {});
    Promise.all([
      makeVisible("com.vyntra.clock-modern"),
      makeVisible("com.vyntra.cpu-modern"),
    ]);
  }, []);

  // Compare before updating state to avoid infinite re-render loop:
  // notifyRects fires → setWidgetCssRects → Surface re-renders → new visibleWidgets ref →
  // myWidgets rememoizes → notifyRects reference changes → effect re-fires → repeat.
  const handleHitRectsChange = useCallback((rects: CssRect[]) => {
    setWidgetCssRects((prev) => {
      if (
        prev.length === rects.length &&
        prev.every(
          (r, i) =>
            r.x === rects[i].x &&
            r.y === rects[i].y &&
            r.w === rects[i].w &&
            r.h === rects[i].h,
        )
      )
        return prev;
      return rects;
    });
  }, []);

  return (
    <div className="vyntra-surface" data-edit={editMode}>
      <GridSurface
        widgets={visibleWidgets}
        editMode={editMode}
        monitorIndex={monitorIndex}
        onHitRectsChange={handleHitRectsChange}
      />
      {showOnboarding && (
        <div className="vyntra-onboarding-backdrop">
          <div className="vyntra-onboarding-card">
            <h1 className="vyntra-onboarding-title">Welcome to Vyntra</h1>
            <p className="vyntra-onboarding-hint">
              Right-click the tray icon → <strong>Open Manager</strong> to add
              your first widgets.
            </p>
            <button
              className="vyntra-onboarding-btn"
              onClick={handleAddStarterWidgets}
            >
              Add starter widgets
            </button>
          </div>
        </div>
      )}
      {import.meta.env.DEV && (
        <DevPanel
          ref={devPanelRef}
          widgets={widgets}
          visibleCount={visibleWidgets.length}
          editMode={editMode}
          monitorIndex={monitorIndex}
        />
      )}
    </div>
  );
}

// ─── Dev panel ────────────────────────────────────────────────────────────────

const LIFECYCLE_ACTIONS = [
  { key: "sleep", label: "sleep", title: "widget://sleep" },
  { key: "wake", label: "wake", title: "widget://wake" },
  { key: "throttle", label: "thr", title: "widget://throttle" },
  { key: "unthrottle", label: "unthr", title: "widget://unthrottle" },
  { key: "kill", label: "kill", title: "widget://kill" },
] as const;

const DevPanel = forwardRef<
  HTMLDivElement,
  {
    widgets: WidgetSummary[];
    visibleCount: number;
    editMode: boolean;
    monitorIndex: number;
  }
>(function DevPanel({ widgets, visibleCount, editMode, monitorIndex }, ref) {
  const fire = (widgetId: string, action: string) =>
    emit(`widget://${action}`, widgetId);

  const shortId = (id: string) => id.split(".").pop() ?? id;

  return (
    <div ref={ref} className="vyntra-dev-panel">
      <strong>Vyntra dev</strong>
      <div className="vyntra-dev-row">
        <span>monitor</span>
        <span>{monitorIndex}</span>
      </div>
      <div className="vyntra-dev-row">
        <span>widgets</span>
        <span>
          {visibleCount}/{widgets.length}
        </span>
      </div>
      <div className="vyntra-dev-row">
        <span>edit</span>
        <span>{editMode ? "on" : "off"}</span>
      </div>
      {widgets.length > 0 && (
        <>
          <div className="vyntra-dev-divider" />
          {widgets.map((w) => (
            <div key={w.id} className="vyntra-dev-widget-row">
              <span className="vyntra-dev-widget-id" title={w.id}>
                {shortId(w.id)}
              </span>
              <span className="vyntra-dev-actions">
                {LIFECYCLE_ACTIONS.map(({ key, label, title }) => (
                  <button
                    key={key}
                    className={`vyntra-dev-btn vyntra-dev-btn--${key}`}
                    title={title}
                    onClick={() => fire(w.id, key)}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
});
