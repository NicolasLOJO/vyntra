//! Vyntra desktop runtime.
//!
//! Architecture:
//! - `vault`   : charge/valide les paquets `.vyn`
//! - `protocol`: handler `vyntra://` qui sert les assets
//! - `watchdog`: cycle de vie (throttle, kill switch, fullscreen detect)
//! - `system`  : monitoring (CPU/GPU/RAM/temp)
//! - `media`   : contrôles SMTC/MPRIS/NowPlaying
//! - `ipc`    : commandes Tauri filtrées par capabilities

mod ipc;
mod media;
mod protocol;
mod state;
mod system;
mod vault;
mod watchdog;

use state::AppState;
use tauri::Manager;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,vyntra=debug".into()),
        )
        .init();

    tracing::info!("Vyntra starting");

    let state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .register_asynchronous_uri_scheme_protocol("vyntra", protocol::handler)
        .invoke_handler(tauri::generate_handler![
            ipc::widgets::list_widgets,
            ipc::widgets::install_widget,
            ipc::widgets::uninstall_widget,
            ipc::system::snapshot,
            ipc::media::get_now_playing,
            ipc::ui::set_edit_mode,
        ])
        .setup(|app| {
            if let Some(w) = app.get_webview_window("vyntra-surface") {
                // En release: comportement wallpaper-like.
                // En dev: on garde la fenêtre visible/interactive pour itérer.
                #[cfg(not(debug_assertions))]
                {
                    let _ = w.set_always_on_bottom(true);
                    let _ = w.set_ignore_cursor_events(true);
                }
                #[cfg(debug_assertions)]
                {
                    let _ = w.set_always_on_top(true);
                    let _ = w.open_devtools();
                }
            }
            watchdog::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri runtime failed");
}
