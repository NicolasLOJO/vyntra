import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { GridBackground } from "react-grid-layout/extras";
import GridLayout, {
  useContainerWidth,
  LayoutItem,
  Layout,
} from "react-grid-layout";
import {
  noOverlapCompactor,
  containerBounds,
  minMaxSize,
} from "react-grid-layout/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { WidgetHost } from "../runtime/WidgetHost";
import type { WidgetSummary } from "./types";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface LayoutEntry {
  x: number;
  y: number;
  w: number;
  h: number;
  monitor?: number;
}

interface CssRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  widgets: WidgetSummary[];
  editMode: boolean;
  monitorIndex: number;
  onHitRectsChange: (rects: CssRect[]) => void;
}

const ROW_HEIGHT = 60;
const COL_WIDTH = 60;
const MARGIN = 8;

export function GridSurface({
  widgets,
  editMode,
  monitorIndex,
  onHitRectsChange,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [persisted, setPersisted] = useState<Record<string, LayoutEntry>>({});
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // window.innerHeight is constant for a fullscreen surface window.
  const maxRows = useMemo(
    () => Math.floor(window.innerHeight / ROW_HEIGHT),
    [],
  );

  useEffect(() => {
    const load = () => {
      invoke<Record<string, LayoutEntry>>("load_layout").then((p) => {
        setPersisted(p);
        setLoaded(true);
      });
    };
    load();
    const unlisten = listen("vyntra://layout-changed", load);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Only show widgets assigned to this monitor (unassigned defaults to monitor 0).
  const myWidgets = useMemo(
    () =>
      widgets.filter((w) => {
        const entry = persisted[w.id];
        return (entry?.monitor ?? 0) === monitorIndex;
      }),
    [widgets, persisted, monitorIndex],
  );

  const colNbr = Math.ceil(width / COL_WIDTH);

  const layout = useMemo<LayoutItem[]>(
    () =>
      myWidgets.map((w, i) => {
        const saved = persisted[w.id];
        return {
          i: w.id,
          x: saved?.x ?? (i * w.size_w) % 24,
          y: saved?.y ?? 0,
          w: saved?.w ?? w.size_w,
          h: saved?.h ?? w.size_h,
        };
      }),
    [myWidgets, persisted],
  );

  // Collect CSS rects of interactive widgets and notify the parent.
  const notifyRects = useCallback(() => {
    const rafId = requestAnimationFrame(() => {
      const cssRects = myWidgets
        .filter((w) => w.interactive !== false)
        .flatMap((w) => {
          const el = cellRefs.current.get(w.id);
          if (!el) return [];
          const r = el.getBoundingClientRect();
          return [{ x: r.left, y: r.top, w: r.width, h: r.height }];
        });
      onHitRectsChange(cssRects);
    });
    return rafId;
  }, [myWidgets, onHitRectsChange]);

  // Re-notify when layout or widgets change, but only once grid is mounted (cells in DOM).
  useEffect(() => {
    if (!mounted) return;
    const rafId = notifyRects();
    return () => cancelAnimationFrame(rafId);
  }, [notifyRects, persisted, mounted]);

  const onLayoutChange = (next: Layout) => {
    if (!loaded) return;
    const obj: Record<string, LayoutEntry> = { ...persisted };
    for (const item of next) {
      obj[item.i] = {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        monitor: monitorIndex,
      };
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      invoke("save_layout", { layout: obj }).catch(console.error);
    }, 400);
  };

  return (
    <div
      ref={containerRef}
      style={{ minHeight: "100vh", position: "relative" }}
    >
      {mounted && (
        <>
          {editMode && (
            <GridBackground
              width={width}
              cols={colNbr}
              rowHeight={ROW_HEIGHT - MARGIN}
              margin={[MARGIN, MARGIN]}
              color="#3131314d"
              rows={maxRows}
              height={maxRows * ROW_HEIGHT}
            />
          )}
          <GridLayout
            width={width}
            compactor={noOverlapCompactor}
            constraints={[containerBounds, minMaxSize]}
            className="vyntra-grid"
            layout={layout}
            gridConfig={{
              cols: colNbr,
              rowHeight: ROW_HEIGHT - MARGIN,
              margin: [MARGIN, MARGIN],
              maxRows,
            }}
            dragConfig={{
              enabled: editMode,
            }}
            resizeConfig={{
              enabled: editMode,
              handles: ["e", "n", "ne", "nw", "s", "se", "sw", "w"],
            }}
            onLayoutChange={onLayoutChange}
          >
            {myWidgets.map((w) => (
              <div key={w.id}>
                <div
                  className="vyntra-cell"
                  style={{ width: "100%", height: "100%" }}
                  ref={(el) => {
                    if (el) cellRefs.current.set(w.id, el);
                    else cellRefs.current.delete(w.id);
                  }}
                >
                  <WidgetHost widget={w} />
                </div>
              </div>
            ))}
          </GridLayout>
        </>
      )}
    </div>
  );
}
