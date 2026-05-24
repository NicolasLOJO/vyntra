use crate::ipc::guard;
use crate::launcher::AppEntry;
use crate::state::AppState;
use tauri::State;
use vyn_sandbox::Capability;

#[tauri::command]
pub fn launcher_apps(state: State<'_, AppState>, widget_id: String) -> Result<Vec<AppEntry>, String> {
    guard::require(&state, &widget_id, Capability::Launcher)?;
    Ok(crate::launcher::list_apps())
}

#[tauri::command]
pub fn launcher_get_icon(
    state: State<'_, AppState>,
    widget_id: String,
    id: String,
) -> Result<Option<String>, String> {
    guard::require(&state, &widget_id, Capability::Launcher)?;
    Ok(crate::launcher::get_icon(&id))
}

#[tauri::command]
pub fn launcher_launch(
    state: State<'_, AppState>,
    widget_id: String,
    id: String,
) -> Result<(), String> {
    guard::require(&state, &widget_id, Capability::Launcher)?;
    crate::launcher::launch(&id).map_err(|e| e.to_string())
}
