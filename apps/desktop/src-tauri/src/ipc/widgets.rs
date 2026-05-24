//! Commandes de gestion des widgets installés.

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{Emitter, State};
use vyn_manifest::{ConfigField, Permissions};

use crate::{state::AppState, vault};

#[derive(Serialize)]
pub struct WidgetSummary {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub version: String,
    pub size_w: u16,
    pub size_h: u16,
    pub permissions: Permissions,
    pub visible: bool,
    pub config_schema: HashMap<String, ConfigField>,
    pub interactive: bool,
}

#[tauri::command]
pub fn list_widgets(state: State<'_, AppState>) -> Vec<WidgetSummary> {
    let store = state.store();
    state
        .widgets
        .iter()
        .map(|e| {
            let m = &e.value().manifest;
            let ws = store.get_widget_state(&m.id);
            WidgetSummary {
                id: m.id.clone(),
                name: m.name.clone(),
                display_name: ws.display_name,
                version: m.version.to_string(),
                size_w: m.size.w,
                size_h: m.size.h,
                permissions: m.permissions.clone(),
                visible: ws.visible,
                config_schema: m.config.clone(),
                interactive: m.interactive,
            }
        })
        .collect()
}

#[tauri::command]
pub fn install_widget(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    let id = vault::install_from_path(&state, &PathBuf::from(path)).map_err(|e| e.to_string())?;
    let _ = app.emit("vyntra://widgets-changed", ());
    Ok(id)
}

#[tauri::command]
pub fn install_widget_bytes(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let id = vault::install_from_bytes(&state, bytes).map_err(|e| e.to_string())?;
    let _ = app.emit("vyntra://widgets-changed", ());
    Ok(id)
}

#[tauri::command]
pub fn uninstall_widget(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    id: String,
) -> bool {
    let ok = vault::uninstall(&state, &id);
    if ok {
        let _ = app.emit("vyntra://widgets-changed", ());
    }
    ok
}

#[tauri::command]
pub fn set_widget_visible(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    id: String,
    visible: bool,
) -> Result<(), String> {
    let store = state.store();
    store.set_widget_visible(&id, visible);
    store.flush().map_err(|e| e.to_string())?;
    let _ = app.emit("vyntra://widgets-changed", ());
    Ok(())
}

#[tauri::command]
pub fn rename_widget(
    state: State<'_, AppState>,
    id: String,
    display_name: String,
) -> Result<(), String> {
    let store = state.store();
    let name = if display_name.trim().is_empty() { None } else { Some(display_name) };
    store.set_widget_display_name(&id, name);
    store.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_widget_monitor(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    id: String,
    monitor: u8,
) -> Result<(), String> {
    use crate::persistence::LayoutEntry;

    let store = state.store();
    let mut layout = store.get_layout();
    let entry = layout.entry(id.clone()).or_insert_with(|| {
        let size = state.widgets.get(&id)
            .map(|w| (w.manifest.size.w as u32, w.manifest.size.h as u32))
            .unwrap_or((4, 2));
        LayoutEntry { x: 0, y: 0, w: size.0, h: size.1, monitor: 0 }
    });
    entry.monitor = monitor;
    store.set_layout(layout);
    store.flush().map_err(|e| e.to_string())?;
    let _ = app.emit("vyntra://layout-changed", ());
    Ok(())
}
