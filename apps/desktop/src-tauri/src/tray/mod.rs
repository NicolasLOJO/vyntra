//! Icône dans la barre des tâches + menu contextuel.
//!
//! Actions:
//! - Now playing  → ligne désactivée (info media en cours)
//! - Open Manager → ouvre la fenêtre `manager`.
//! - Edit mode    → toggle de l'état édition de la surface.
//! - Quit         → quitte l'application.

use parking_lot::Mutex;
use std::sync::OnceLock;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::state::AppState;
use crate::window;

// Cache de la dernière ligne media pour pouvoir reconstruire le menu sans le NowPlaying.
fn np_label() -> &'static Mutex<String> {
    static S: OnceLock<Mutex<String>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(String::new()))
}

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app, "", false)?;

    let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
        Image::new_owned(vec![0, 0, 0, 0], 1, 1)
    });

    TrayIconBuilder::with_id("vyntra-tray")
        .icon(icon)
        .tooltip("Vyntra")
        .menu(&menu)
        .on_menu_event(|app, event| handle_menu(app, event))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    let _ = window::open_manager(tray.app_handle());
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Met à jour la ligne media dans le menu tray.
/// Appelé depuis `media::watch` après chaque changement débounced.
pub fn update_now_playing<R: Runtime>(app: &AppHandle<R>, np: &crate::media::NowPlaying) {
    let label = np.title.as_ref().map_or_else(String::new, |title| {
        let icon = if np.is_playing { "▶" } else { "⏸" };
        match &np.artist {
            Some(artist) => format!("{icon} {title} — {artist}"),
            None => format!("{icon} {title}"),
        }
    });
    *np_label().lock() = label;
    rebuild_menu(app);
}

/// Reconstruit le menu avec l'état edit courant — appelé après un toggle edit.
pub fn sync_edit_state<R: Runtime>(app: &AppHandle<R>) {
    rebuild_menu(app);
}

fn rebuild_menu<R: Runtime>(app: &AppHandle<R>) {
    let label = np_label().lock().clone();
    let edit_checked = *app.state::<AppState>().edit_mode.read();
    if let Some(tray) = app.tray_by_id("vyntra-tray") {
        if let Ok(menu) = build_menu(app, &label, edit_checked) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    np_label: &str,
    edit_checked: bool,
) -> tauri::Result<Menu<R>> {
    let open = MenuItem::with_id(app, "open", "Open Manager", true, None::<&str>)?;
    let edit = CheckMenuItem::with_id(app, "edit", "Edit mode", true, edit_checked, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Vyntra", true, None::<&str>)?;

    if !np_label.is_empty() {
        let media = MenuItem::with_id(app, "media-info", np_label, false, None::<&str>)?;
        let sep0 = PredefinedMenuItem::separator(app)?;
        let items: &[&dyn IsMenuItem<R>] = &[&media, &sep0, &open, &edit, &sep, &quit];
        Menu::with_items(app, items)
    } else {
        let items: &[&dyn IsMenuItem<R>] = &[&open, &edit, &sep, &quit];
        Menu::with_items(app, items)
    }
}

fn handle_menu<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id.as_ref() {
        "open" => {
            if let Err(e) = window::open_manager(app) {
                tracing::error!(err = %e, "failed to open manager");
            }
        }
        "edit" => {
            let state = app.state::<AppState>();
            let enabled = !*state.edit_mode.read();
            *state.edit_mode.write() = enabled;
            if let Some(w) = app.get_webview_window("vyntra-surface") {
                #[cfg(not(debug_assertions))]
                {
                    let _ = w.set_ignore_cursor_events(!enabled);
                }
                let _ = w.emit("vyntra://edit-mode", enabled);
            }
            let _ = app.emit("vyntra://edit-mode", enabled);
            // Reconstruire le menu pour synchroniser la coche.
            rebuild_menu(app);
        }
        "quit" => app.exit(0),
        _ => {}
    }
}
