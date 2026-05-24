use std::collections::HashMap;
use tauri::State;

use crate::persistence::LayoutEntry;
use crate::state::AppState;

#[tauri::command]
pub fn load_layout(state: State<'_, AppState>) -> HashMap<String, LayoutEntry> {
    state.store().get_layout()
}

#[tauri::command]
pub fn save_layout(
    state: State<'_, AppState>,
    layout: HashMap<String, LayoutEntry>,
) -> Result<(), String> {
    let store = state.store();
    store.set_layout(layout);
    store.flush().map_err(|e| e.to_string())
}
