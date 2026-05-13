//! État partagé entre les commandes IPC, le watchdog et le protocol handler.

use dashmap::DashMap;
use std::sync::Arc;
use vyn_manifest::Manifest;

/// Un widget installé et résident en mémoire.
pub struct LoadedWidget {
    pub manifest: Manifest,
    /// Bytes du `.vyn` mappés en mémoire (lazy: à terme on streamera depuis disque).
    pub archive_bytes: Arc<Vec<u8>>,
    pub stats: WidgetStats,
}

#[derive(Default)]
pub struct WidgetStats {
    pub cpu_pct: f32,
    pub ram_bytes: u64,
    /// État du throttling appliqué par le watchdog.
    pub throttle: ThrottleState,
}

#[derive(Default, Clone, Copy, Debug)]
pub enum ThrottleState {
    #[default]
    Active,
    /// Réduit à ~1 FPS.
    Throttled,
    /// Endormi (fullscreen détecté).
    Asleep,
}

#[derive(Clone)]
pub struct AppState {
    /// Indexé par `manifest.id`.
    pub widgets: Arc<DashMap<String, LoadedWidget>>,
    pub edit_mode: Arc<parking_lot::RwLock<bool>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            widgets: Arc::new(DashMap::new()),
            edit_mode: Arc::new(parking_lot::RwLock::new(false)),
        }
    }
}
