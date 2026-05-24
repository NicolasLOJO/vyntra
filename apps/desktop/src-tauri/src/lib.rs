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
mod launcher;
mod media;
mod persistence;
mod protocol;
mod state;
mod system;
mod tray;
mod vault;
mod watchdog;
mod window;

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

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    // Updater désactivé en debug — config incomplète jusqu'au serveur de MAJ prod.
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .manage(state.clone())
        .register_asynchronous_uri_scheme_protocol("vyntra", protocol::handler)
        .invoke_handler(tauri::generate_handler![
            ipc::widgets::list_widgets,
            ipc::widgets::install_widget,
            ipc::widgets::install_widget_bytes,
            ipc::widgets::uninstall_widget,
            ipc::widgets::set_widget_visible,
            ipc::widgets::rename_widget,
            ipc::widgets::set_widget_monitor,
            ipc::system::snapshot,
            ipc::media::get_now_playing,
            ipc::media::media_play,
            ipc::media::media_pause,
            ipc::media::media_next,
            ipc::media::media_previous,
            ipc::ui::set_edit_mode,
            ipc::ui::get_monitor_count,
            ipc::layout::load_layout,
            ipc::layout::save_layout,
            ipc::storage::storage_get,
            ipc::storage::storage_set,
            ipc::storage::storage_delete,
            ipc::storage::storage_keys,
            ipc::config::widget_config_get_all,
            ipc::config::widget_config_set,
            ipc::settings::get_settings,
            ipc::settings::set_settings,
            ipc::shortcuts::set_edit_shortcut,
            ipc::launcher::launcher_apps,
            ipc::launcher::launcher_get_icon,
            ipc::launcher::launcher_launch,
            ipc::update::check_update,
            ipc::update::install_update,
            ipc::ui::set_hit_rects,
            ipc::ui::get_window_outer_position,
            ipc::ui::is_first_launch,
        ])
        .setup(move |app| {
            // Charge la persistance avant tout — les widgets en dépendent.
            let store = persistence::Store::load(app.handle())?;
            *state.store.write() = Some(store);

            vault::bootstrap_bundled(&state);

            // Raccourci clavier edit-mode (depuis les settings persistés).
            let shortcut = state.store().get_settings().edit_mode_shortcut.clone();
            ipc::shortcuts::register_edit_shortcut(app.handle(), &shortcut);

            // Tray icon (point d'entrée unique pour Manager / Edit / Quit).
            tray::setup(app.handle())?;

            if let Some(w) = app.get_webview_window("vyntra-surface") {
                // Click-through par défaut ; le thread hit-test gère les zones interactives.
                let _ = w.set_ignore_cursor_events(true);
                // Toujours au fond — WS_EX_NOACTIVATE + HWND_BOTTOM (debug et release).
                #[cfg(target_os = "windows")]
                window::pin_surface_to_bottom(&w);
                #[cfg(debug_assertions)]
                let _ = w.open_devtools();
            }

            // Surfaces supplémentaires pour les moniteurs secondaires.
            window::spawn_surfaces(app.handle());

            // Rend toutes les surfaces secondaires click-through au démarrage.
            for (label, win) in app.webview_windows() {
                if label.starts_with("vyntra-surface-") {
                    let _ = win.set_ignore_cursor_events(true);
                }
            }

            // Thread de hit-test : bascule click-through selon position du curseur (Windows).
            #[cfg(target_os = "windows")]
            window::spawn_hit_test(app.handle().clone(), state.clone());

            watchdog::spawn(app.handle().clone());
            media::watch(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri runtime failed");
}
