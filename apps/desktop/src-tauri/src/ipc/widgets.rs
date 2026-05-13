//! Commandes de gestion des widgets installés.

use serde::Serialize;
use std::path::PathBuf;
use tauri::State;

use crate::{state::AppState, vault};

#[derive(Serialize)]
pub struct WidgetSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub size_w: u16,
    pub size_h: u16,
}

#[tauri::command]
pub fn list_widgets(state: State<'_, AppState>) -> Vec<WidgetSummary> {
    state
        .widgets
        .iter()
        .map(|e| {
            let m = &e.value().manifest;
            WidgetSummary {
                id: m.id.clone(),
                name: m.name.clone(),
                version: m.version.to_string(),
                size_w: m.size.w,
                size_h: m.size.h,
            }
        })
        .collect()
}

#[tauri::command]
pub fn install_widget(state: State<'_, AppState>, path: String) -> Result<String, String> {
    vault::install_from_path(&state, &PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn uninstall_widget(state: State<'_, AppState>, id: String) -> bool {
    vault::uninstall(&state, &id)
}
