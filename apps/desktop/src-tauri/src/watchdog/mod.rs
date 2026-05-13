//! Surveillance du cycle de vie des widgets.
//!
//! Responsabilités:
//! - poll des ressources (CPU/RAM) par widget
//! - kill switch si dépassement de seuil
//! - throttle / sleep quand fullscreen détecté
//!
//! Émet des events Tauri (`widget://throttle`, `widget://sleep`) consommés
//! par le runtime front pour ajuster le rafraîchissement.

use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::state::AppState;

const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Seuils par widget (à rendre configurables).
const MAX_CPU_PCT: f32 = 35.0;
const MAX_RAM_MB: u64 = 80;

pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>().inner().clone();
        let mut ticker = tokio::time::interval(POLL_INTERVAL);
        loop {
            ticker.tick().await;
            tick(&app, &state).await;
        }
    });
}

async fn tick<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    let fullscreen = detect_fullscreen();

    for mut entry in state.widgets.iter_mut() {
        let id = entry.key().clone();
        let stats = &mut entry.value_mut().stats;

        if fullscreen {
            stats.throttle = crate::state::ThrottleState::Asleep;
            let _ = app.emit("widget://sleep", &id);
            continue;
        }

        // Kill switch
        if stats.cpu_pct > MAX_CPU_PCT || stats.ram_bytes / 1_000_000 > MAX_RAM_MB {
            tracing::warn!(widget = %id, cpu = stats.cpu_pct, "kill switch triggered");
            let _ = app.emit("widget://kill", &id);
            continue;
        }
    }
}

/// Détecte si une app est en plein écran (Game/Video).
/// TODO Windows: SHQueryUserNotificationState (QUNS_RUNNING_D3D_FULL_SCREEN / QUNS_BUSY).
fn detect_fullscreen() -> bool {
    false
}
