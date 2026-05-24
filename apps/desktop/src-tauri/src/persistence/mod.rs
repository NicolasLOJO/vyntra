//! Persistance disque: layout (positions widgets) + storage K/V par widget.
//!
//! Format: JSON dans `app_local_data_dir/state.json`.
//! Atomique: écrit en .tmp puis rename.
//!
//! Pour des volumes plus importants, migrer vers SQLite avec
//! `tauri-plugin-sql` ou `rusqlite`. Pour le MVP, JSON suffit.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub autostart: bool,
    #[serde(default = "default_true")]
    pub sleep_on_fullscreen: bool,
    #[serde(default = "default_cpu_threshold")]
    pub cpu_throttle_threshold: u8,
    #[serde(default = "default_shortcut")]
    pub edit_mode_shortcut: String,
}

fn default_true() -> bool { true }
fn default_cpu_threshold() -> u8 { 80 }
fn default_shortcut() -> String { "Alt+Shift+E".to_string() }

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            autostart: false,
            sleep_on_fullscreen: true,
            cpu_throttle_threshold: 80,
            edit_mode_shortcut: default_shortcut(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct State {
    /// Position et taille d'un widget dans la grille.
    #[serde(default)]
    pub layout: HashMap<String, LayoutEntry>,
    /// Storage K/V par widget. Clé externe = widget id.
    #[serde(default)]
    pub storage: HashMap<String, HashMap<String, Value>>,
    /// État runtime par widget (visible, enabled, ...).
    #[serde(default)]
    pub widget_state: HashMap<String, WidgetState>,
    #[serde(default)]
    pub settings: AppSettings,
    /// Configuration utilisateur par widget (valeurs des champs déclarés dans le manifest).
    #[serde(default)]
    pub widget_config: HashMap<String, HashMap<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetState {
    pub visible: bool,
    #[serde(default)]
    pub display_name: Option<String>,
}

impl Default for WidgetState {
    fn default() -> Self {
        Self { visible: true, display_name: None }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LayoutEntry {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
    /// Index of the monitor this widget lives on (0 = primary).
    #[serde(default)]
    pub monitor: u8,
}

/// Wrapper thread-safe + chemin disque.
#[derive(Clone)]
pub struct Store {
    inner: Arc<RwLock<State>>,
    path: Arc<PathBuf>,
}

impl Store {
    pub fn load<R: Runtime>(app: &AppHandle<R>) -> anyhow::Result<Self> {
        let dir = app.path().app_local_data_dir()?;
        println!("data dir: {}", dir.display());
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("state.json");

        let state: State = match std::fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_else(|e| {
                tracing::warn!(err = %e, "corrupt state.json, starting fresh");
                State::default()
            }),
            Err(_) => State::default(),
        };

        Ok(Self {
            inner: Arc::new(RwLock::new(state)),
            path: Arc::new(path),
        })
    }

    /// Écrit l'état sur disque. Atomique: tmp + rename.
    pub fn flush(&self) -> anyhow::Result<()> {
        let bytes = {
            let s = self.inner.read();
            serde_json::to_vec_pretty(&*s)?
        };
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, bytes)?;
        std::fs::rename(&tmp, self.path.as_path())?;
        Ok(())
    }

    // ---- Layout ----

    pub fn get_layout(&self) -> HashMap<String, LayoutEntry> {
        self.inner.read().layout.clone()
    }

    pub fn set_layout(&self, layout: HashMap<String, LayoutEntry>) {
        self.inner.write().layout = layout;
    }

    // ---- Storage par widget ----

    pub fn storage_get(&self, widget: &str, key: &str) -> Option<Value> {
        self.inner.read().storage.get(widget)?.get(key).cloned()
    }

    pub fn storage_set(&self, widget: &str, key: String, value: Value) {
        self.inner
            .write()
            .storage
            .entry(widget.to_string())
            .or_default()
            .insert(key, value);
    }

    pub fn storage_delete(&self, widget: &str, key: &str) -> bool {
        let mut s = self.inner.write();
        match s.storage.get_mut(widget) {
            Some(m) => m.remove(key).is_some(),
            None => false,
        }
    }

    pub fn storage_keys(&self, widget: &str) -> Vec<String> {
        self.inner
            .read()
            .storage
            .get(widget)
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default()
    }

    // ---- État runtime des widgets ----

    pub fn get_widget_state(&self, widget: &str) -> WidgetState {
        self.inner
            .read()
            .widget_state
            .get(widget)
            .cloned()
            .unwrap_or_default()
    }

    pub fn all_widget_states(&self) -> HashMap<String, WidgetState> {
        self.inner.read().widget_state.clone()
    }

    // ---- Settings ----

    pub fn get_settings(&self) -> AppSettings {
        self.inner.read().settings.clone()
    }

    pub fn set_settings(&self, settings: AppSettings) {
        self.inner.write().settings = settings;
    }

    pub fn set_widget_visible(&self, widget: &str, visible: bool) {
        let mut s = self.inner.write();
        let entry = s
            .widget_state
            .entry(widget.to_string())
            .or_default();
        entry.visible = visible;
    }

    pub fn set_widget_display_name(&self, widget: &str, name: Option<String>) {
        let mut s = self.inner.write();
        let entry = s.widget_state.entry(widget.to_string()).or_default();
        entry.display_name = name;
    }

    pub fn get_widget_config(&self, widget: &str) -> HashMap<String, Value> {
        self.inner.read().widget_config.get(widget).cloned().unwrap_or_default()
    }

    pub fn set_widget_config_field(&self, widget: &str, key: String, value: Value) {
        self.inner.write()
            .widget_config
            .entry(widget.to_string())
            .or_default()
            .insert(key, value);
    }
}
