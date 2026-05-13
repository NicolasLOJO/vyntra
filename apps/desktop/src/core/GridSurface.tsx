import GridLayout, { type Layout } from "react-grid-layout";
import { WidgetHost } from "../runtime/WidgetHost";
import type { WidgetSummary } from "./types";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface Props {
  widgets: WidgetSummary[];
  editMode: boolean;
}

/**
 * Grille magnétique. Unités de grille indépendantes de la résolution.
 * Le snap se fait sur cols=24 (paysage) avec rowHeight calculé pour 16:9.
 */
export function GridSurface({ widgets, editMode }: Props) {
  const layout: Layout[] = widgets.map((w, i) => ({
    i: w.id,
    x: (i * w.size_w) % 24,
    y: 0,
    w: w.size_w,
    h: w.size_h,
  }));

  return (
    <GridLayout
      className="vyntra-grid"
      layout={layout}
      cols={24}
      rowHeight={60}
      width={window.innerWidth}
      isDraggable={editMode}
      isResizable={editMode}
      compactType={null}
      preventCollision
      margin={[12, 12]}
    >
      {widgets.map((w) => (
        <div key={w.id} className="vyntra-cell">
          <WidgetHost widget={w} />
        </div>
      ))}
    </GridLayout>
  );
}
