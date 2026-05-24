use tauri::State;
use vyn_sandbox::Capability;

use crate::ipc::guard;
use crate::media::{self, NowPlaying};
use crate::state::AppState;

#[tauri::command]
pub fn get_now_playing(
    state: State<'_, AppState>,
    widget_id: String,
) -> Result<NowPlaying, String> {
    guard::require(&state, &widget_id, Capability::Media)?;
    Ok(media::now_playing())
}

#[tauri::command]
pub fn media_play(state: State<'_, AppState>, widget_id: String) -> Result<(), String> {
    guard::require(&state, &widget_id, Capability::Media)?;
    media::play();
    Ok(())
}

#[tauri::command]
pub fn media_pause(state: State<'_, AppState>, widget_id: String) -> Result<(), String> {
    guard::require(&state, &widget_id, Capability::Media)?;
    media::pause();
    Ok(())
}

#[tauri::command]
pub fn media_next(state: State<'_, AppState>, widget_id: String) -> Result<(), String> {
    guard::require(&state, &widget_id, Capability::Media)?;
    media::next();
    Ok(())
}

#[tauri::command]
pub fn media_previous(state: State<'_, AppState>, widget_id: String) -> Result<(), String> {
    guard::require(&state, &widget_id, Capability::Media)?;
    media::previous();
    Ok(())
}
