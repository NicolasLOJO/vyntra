//! État partagé entre les commandes IPC, le watchdog et le protocol handler.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use vyn_manifest::Manifest;

use crate::persistence::Store;

/// Rect en pixels physiques (coordonnées écran absolues) pour le hit-test click-through.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

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

#[derive(Default, Clone, Copy, Debug, PartialEq)]
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
    /// `None` tant que `setup()` n'a pas chargé le store. Garantit qu'on
    /// échoue plutôt que de perdre des données silencieusement.
    pub store: Arc<parking_lot::RwLock<Option<Store>>>,
    /// Rects interactifs par label de fenêtre surface, en px physiques écran.
    /// Mis à jour par `set_hit_rects` depuis le front après chaque changement de layout.
    pub hit_rects: Arc<parking_lot::RwLock<HashMap<String, Vec<HitRect>>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            widgets: Arc::new(DashMap::new()),
            edit_mode: Arc::new(parking_lot::RwLock::new(false)),
            store: Arc::new(parking_lot::RwLock::new(None)),
            hit_rects: Arc::new(parking_lot::RwLock::new(HashMap::new())),
        }
    }

    /// Helper: récupère le store, panique si non initialisé (bug interne).
    pub fn store(&self) -> Store {
        self.store
            .read()
            .as_ref()
            .expect("Store not initialized — bug in setup()")
            .clone()
    }
}
