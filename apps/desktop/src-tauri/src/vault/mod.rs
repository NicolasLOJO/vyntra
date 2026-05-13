//! Chargement et installation des `.vyn` depuis le disque.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime};
use vyn_format::VynArchive;

use crate::state::{AppState, LoadedWidget, WidgetStats};

pub fn install_from_path(state: &AppState, path: &Path) -> anyhow::Result<String> {
    let bytes = std::fs::read(path)?;
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
/// Utilise le path resolver de Tauri (cross-platform).
pub fn install_dir<R: Runtime>(app: &AppHandle<R>) -> anyhow::Result<PathBuf> {
    let base = app.path().app_local_data_dir()?;
    let dir = base.join("widgets");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}
