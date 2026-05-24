//! Chargement et installation des `.vyn` depuis le disque.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime};
use vyn_format::VynArchive;

use crate::state::{AppState, LoadedWidget, WidgetStats};

pub fn install_from_path(state: &AppState, path: &Path) -> anyhow::Result<String> {
    let bytes = std::fs::read(path)?;
    install_from_bytes(state, bytes)
}

pub fn install_from_bytes(state: &AppState, bytes: Vec<u8>) -> anyhow::Result<String> {
    let archive = VynArchive::from_bytes(bytes.clone())?;
    let manifest = archive.manifest().clone();
    let id = manifest.id.clone();

    tracing::info!(widget_id = %id, "installing widget");

    state.widgets.insert(
        id.clone(),
        LoadedWidget {
            manifest,
            archive_bytes: Arc::new(bytes),
            stats: WidgetStats::default(),
        },
    );

    Ok(id)
}

pub fn uninstall(state: &AppState, id: &str) -> bool {
    state.widgets.remove(id).is_some()
}

/// Dossier où Vyntra stocke les `.vyn` installés.
#[allow(dead_code)]
pub fn install_dir<R: Runtime>(app: &AppHandle<R>) -> anyhow::Result<PathBuf> {
    let base = app.path().app_local_data_dir()?;
    let dir = base.join("widgets");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Auto-install des widgets embarqués dans le binaire (dev + examples).
/// Les bytes sont inclus à la compilation via `include_bytes!`.
pub fn bootstrap_bundled(state: &AppState) {
    for (name, bytes) in bundled_widgets() {
        match install_from_bytes(state, bytes.to_vec()) {
            Ok(id) => tracing::info!(widget = %name, %id, "bundled widget loaded"),
            Err(e) => tracing::warn!(widget = %name, err = %e, "failed to load bundled"),
        }
    }
}

/// Liste compilée des widgets bundlés.
/// Le build CI/dev s'attend à trouver les `.vyn` dans `widgets-bundled/`.
fn bundled_widgets() -> Vec<(&'static str, &'static [u8])> {
    let mut v: Vec<(&'static str, &'static [u8])> = Vec::new();

    #[cfg(feature = "bundled-examples")]
    {
        v.push(("clock",           include_bytes!("../../widgets-bundled/clock.vyn")));
        v.push(("clock-modern",    include_bytes!("../../widgets-bundled/clock-modern.vyn")));
        v.push(("cpu",             include_bytes!("../../widgets-bundled/cpu.vyn")));
        v.push(("cpu-modern",      include_bytes!("../../widgets-bundled/cpu-modern.vyn")));
        v.push(("notes",           include_bytes!("../../widgets-bundled/notes.vyn")));
        v.push(("notes-modern",    include_bytes!("../../widgets-bundled/notes-modern.vyn")));
        v.push(("media",           include_bytes!("../../widgets-bundled/media.vyn")));
        v.push(("media-modern",    include_bytes!("../../widgets-bundled/media-modern.vyn")));
        v.push(("launcher",        include_bytes!("../../widgets-bundled/launcher.vyn")));
        v.push(("launcher-modern", include_bytes!("../../widgets-bundled/launcher-modern.vyn")));
        v.push(("pomodoro",        include_bytes!("../../widgets-bundled/pomodoro.vyn")));
        v.push(("pomodoro-modern", include_bytes!("../../widgets-bundled/pomodoro-modern.vyn")));
    }

    v
}
