//! Helper de vérification de capability avant exécution d'une commande IPC.
//!
//! Toute commande sensible (système, media, storage, …) doit appeler
//! `require()` avec l'id du widget appelant ET la capacité requise.

use vyn_sandbox::Capability;

use crate::state::AppState;

/// Vérifie que le widget existe ET qu'il a déclaré la capacité.
/// Retourne `Err(String)` (sérialisable côté front) en cas d'échec.
pub fn require(
    state: &AppState,
    widget_id: &str,
    cap: Capability,
) -> Result<(), String> {
    let widget = state
        .widgets
        .get(widget_id)
        .ok_or_else(|| format!("unknown widget: {widget_id}"))?;
    vyn_sandbox::check(&widget.manifest, cap).map_err(|e| e.to_string())
}
