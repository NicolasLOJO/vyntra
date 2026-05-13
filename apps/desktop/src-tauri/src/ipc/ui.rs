use tauri::{Emitter, Runtime, State, WebviewWindow};

use crate::state::AppState;

#[tauri::command]
pub fn set_edit_mode<R: Runtime>(
    state: State<'_, AppState>,
    window: WebviewWindow<R>,
    enabled: bool,
) -> Result<(), String> {
    *state.edit_mode.write() = enabled;

    // En mode normal: la fenêtre est click-through.
    // En mode édition: on capture les events souris pour drag & resize.
    window
        .set_ignore_cursor_events(!enabled)
        .map_err(|e| e.to_string())?;

    let _ = window.emit("vyntra://edit-mode", enabled);
    Ok(())
}
