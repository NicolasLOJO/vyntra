use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

fn edit_handler<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let mode = {
        let mut w = state.edit_mode.write();
        *w = !*w;
        *w
    };
    let _ = app.emit("vyntra://edit-mode", mode);
    crate::tray::sync_edit_state(app);
}

/// Enregistre le raccourci edit-mode au démarrage depuis les settings.
pub fn register_edit_shortcut<R: Runtime>(app: &AppHandle<R>, shortcut: &str) {
    if shortcut.is_empty() {
        return;
    }
    let _ = app.global_shortcut().on_shortcut(shortcut, |app, _sc, ev| {
        if ev.state() == ShortcutState::Pressed {
            edit_handler(app);
        }
    });
}

#[tauri::command]
pub fn set_edit_shortcut<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    shortcut: String,
) -> Result<(), String> {
    let old = state.store().get_settings().edit_mode_shortcut.clone();
    if !old.is_empty() {
        let _ = app.global_shortcut().unregister(old.as_str());
    }

    if !shortcut.is_empty() {
        app.global_shortcut()
            .on_shortcut(shortcut.as_str(), |app, _sc, ev| {
                if ev.state() == ShortcutState::Pressed {
                    edit_handler(app);
                }
            })
            .map_err(|e| format!("invalid shortcut: {e}"))?;
    }

    let mut settings = state.store().get_settings();
    settings.edit_mode_shortcut = shortcut;
    state.store().set_settings(settings);
    state.store().flush().map_err(|e| e.to_string())
}
