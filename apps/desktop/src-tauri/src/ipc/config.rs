use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::state::AppState;

#[derive(Clone, Serialize, Deserialize)]
struct ConfigChanged {
    widget_id: String,
    key: String,
    value: Value,
}

/// Called by the Manager and by the widget SDK (via dispatcher).
/// No capability check — a widget always has access to its own config.
#[tauri::command]
pub fn widget_config_get_all(
    state: State<'_, AppState>,
    widget_id: String,
) -> HashMap<String, Value> {
    state.store().get_widget_config(&widget_id)
}

#[tauri::command]
pub fn widget_config_set<R: Runtime>(
    state: State<'_, AppState>,
    app: AppHandle<R>,
    widget_id: String,
    key: String,
    value: Value,
) -> Result<(), String> {
    let store = state.store();
    store.set_widget_config_field(&widget_id, key.clone(), value.clone());
    store.flush().map_err(|e| e.to_string())?;
    let _ = app.emit("vyntra://config-changed", ConfigChanged { widget_id, key, value });
    Ok(())
}
