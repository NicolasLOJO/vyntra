import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { GridSurface } from "./GridSurface";
import { EditModeToggle } from "../ui/EditModeToggle";
import type { WidgetSummary } from "./types";

/**
 * Conteneur racine. Une seule WebView, occupe tout le bureau.
 * Click-through par défaut; on capture les events en mode édition.
 */
export function Surface() {
  const [widgets, setWidgets] = useState<WidgetSummary[]>([]);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    invoke<WidgetSummary[]>("list_widgets").then(setWidgets);

    const unlisten = listen<boolean>("vyntra://edit-mode", (e) => {
      setEditMode(e.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const toggleEdit = async () => {
    await invoke("set_edit_mode", { enabled: !editMode });
  };

  return (
    <div className="vyntra-surface" data-edit={editMode}>
      <GridSurface widgets={widgets} editMode={editMode} />
      <EditModeToggle active={editMode} onToggle={toggleEdit} />
      {import.meta.env.DEV && (
        <div className="vyntra-dev-panel">
          <strong>Vyntra dev</strong>
          <div>widgets: {widgets.length}</div>
          <div>edit: {editMode ? "on" : "off"}</div>
        </div>
      )}
    </div>
  );
}
