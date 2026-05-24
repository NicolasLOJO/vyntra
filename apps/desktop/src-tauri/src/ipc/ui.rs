use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::state::{AppState, HitRect};

#[tauri::command]
pub fn set_edit_mode<R: Runtime>(
    state: State<'_, AppState>,
    app: AppHandle<R>,
    enabled: bool,
) -> Result<(), String> {
    *state.edit_mode.write() = enabled;

    if let Some(w) = app.get_webview_window("vyntra-surface") {
        let _ = w.emit("vyntra://edit-mode", enabled);
    }

    // Notifie aussi le manager s'il est ouvert (pour synchro toggle UI).
    let _ = app.emit("vyntra://edit-mode", enabled);

    Ok(())
}

#[tauri::command]
pub fn get_monitor_count<R: Runtime>(app: AppHandle<R>) -> usize {
    app.get_webview_window("vyntra-surface")
        .and_then(|w| w.available_monitors().ok())
        .map_or(1, |m| m.len().max(1))
}

/// Enregistre les rects interactifs pour la surface appelante (px physiques, coordonnées écran).
/// Appelé par le front après chaque changement de layout.
#[tauri::command]
pub fn set_hit_rects<R: Runtime>(
    window: tauri::WebviewWindow<R>,
    state: State<'_, AppState>,
    rects: Vec<HitRect>,
) {
    state.hit_rects.write().insert(window.label().to_string(), rects);
}

#[derive(Serialize)]
pub struct WindowPos {
    pub x: i32,
    pub y: i32,
}

/// Retourne la position physique (px écran) du coin supérieur gauche de la zone client
/// (inner = là où le WebView commence à dessiner, sans les bordures invisibles DWM).
#[tauri::command]
pub fn get_window_outer_position<R: Runtime>(
    window: tauri::WebviewWindow<R>,
) -> Result<WindowPos, String> {
    window
        .inner_position()
        .map(|p| WindowPos { x: p.x, y: p.y })
        .map_err(|e| e.to_string())
}

/// Retourne `true` si c'est le premier lancement :
/// aucune entrée de layout ET aucun widget avec `visible: true` dans widget_state.
#[tauri::command]
pub fn is_first_launch(state: State<'_, AppState>) -> bool {
    let store = state.store();
    let layout = store.get_layout();
    if !layout.is_empty() {
        return false;
    }
    let widget_states = store.all_widget_states();
    let has_visible = widget_states.values().any(|ws| ws.visible);
    !has_visible
}
