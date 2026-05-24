use tauri::State;
use vyn_sandbox::Capability;

use crate::ipc::guard;
use crate::state::AppState;
use crate::system::{self, SystemSnapshot};

#[tauri::command]
pub fn snapshot(
    state: State<'_, AppState>,
    widget_id: String,
) -> Result<SystemSnapshot, String> {
    guard::require(&state, &widget_id, Capability::System)?;
    Ok(system::snapshot())
}
