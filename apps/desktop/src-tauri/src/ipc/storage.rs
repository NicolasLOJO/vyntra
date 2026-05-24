use serde_json::Value;
use tauri::State;
use vyn_sandbox::Capability;

use crate::ipc::guard;
use crate::state::AppState;

#[tauri::command]
pub fn storage_get(
    state: State<'_, AppState>,
    widget_id: String,
    key: String,
) -> Result<Option<Value>, String> {
    guard::require(&state, &widget_id, Capability::Storage)?;
    Ok(state.store().storage_get(&widget_id, &key))
}

#[tauri::command]
pub fn storage_set(
    state: State<'_, AppState>,
    widget_id: String,
    key: String,
    value: Value,
) -> Result<(), String> {
    guard::require(&state, &widget_id, Capability::Storage)?;
    let store = state.store();
    store.storage_set(&widget_id, key, value);
    store.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn storage_delete(
    state: State<'_, AppState>,
    widget_id: String,
    key: String,
) -> Result<bool, String> {
    guard::require(&state, &widget_id, Capability::Storage)?;
    let store = state.store();
    let deleted = store.storage_delete(&widget_id, &key);
    store.flush().map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
pub fn storage_keys(
    state: State<'_, AppState>,
    widget_id: String,
) -> Result<Vec<String>, String> {
    guard::require(&state, &widget_id, Capability::Storage)?;
    Ok(state.store().storage_keys(&widget_id))
}
