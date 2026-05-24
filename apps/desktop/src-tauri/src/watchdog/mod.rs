//! Surveillance du cycle de vie des widgets.
//!
//! Responsabilités:
//! - détection fullscreen → sleep/wake
//! - CPU système élevé → throttle/unthrottle
//! - kill switch si dépassement des seuils par widget
//!
//! Émet des events Tauri consommés par le runtime front :
//!   `widget://sleep`, `widget://wake`, `widget://throttle`, `widget://unthrottle`, `widget://kill`

use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::state::{AppState, ThrottleState};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const MAX_CPU_PCT: f32 = 35.0;
const MAX_RAM_MB: u64 = 80;

#[derive(Default, Clone, Copy)]
struct WatchdogState {
    fullscreen: bool,
    high_cpu: bool,
}

pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>().inner().clone();
        let mut ticker = tokio::time::interval(POLL_INTERVAL);
        let mut prev = WatchdogState::default();
        loop {
            ticker.tick().await;
            prev = tick(&app, &state, prev).await;
        }
    });
}

async fn tick<R: Runtime>(app: &AppHandle<R>, state: &AppState, prev: WatchdogState) -> WatchdogState {
    let settings = state.store().get_settings();
    let throttle_threshold = settings.cpu_throttle_threshold as f32;

    let fullscreen = detect_fullscreen() && settings.sleep_on_fullscreen;
    let sys_cpu = crate::system::cpu_pct();
    let high_cpu = sys_cpu > throttle_threshold;

    if fullscreen && !prev.fullscreen {
        tracing::debug!("fullscreen detected — sleeping widgets, disabling shortcuts");
        let sc = state.store().get_settings().edit_mode_shortcut;
        if !sc.is_empty() {
            let _ = app.global_shortcut().unregister(sc.as_str());
        }
    } else if !fullscreen && prev.fullscreen {
        tracing::debug!("fullscreen ended — waking widgets, re-enabling shortcuts");
        let sc = state.store().get_settings().edit_mode_shortcut;
        crate::ipc::shortcuts::register_edit_shortcut(app, &sc);
    }
    if high_cpu && !prev.high_cpu && !fullscreen {
        tracing::debug!(cpu = sys_cpu, threshold = throttle_threshold, "high CPU — throttling widgets");
    } else if !high_cpu && prev.high_cpu {
        tracing::debug!("CPU normal — unthrottling widgets");
    }

    for mut entry in state.widgets.iter_mut() {
        let id = entry.key().clone();
        let stats = &mut entry.value_mut().stats;

        if fullscreen {
            if stats.throttle != ThrottleState::Asleep {
                stats.throttle = ThrottleState::Asleep;
                let _ = app.emit("widget://sleep", &id);
            }
            continue;
        }

        // Sortie de fullscreen : réveiller quel que soit l'état précédent.
        if prev.fullscreen {
            stats.throttle = ThrottleState::Active;
            let _ = app.emit("widget://wake", &id);
            continue;
        }

        // Throttle CPU système.
        if high_cpu && stats.throttle == ThrottleState::Active {
            stats.throttle = ThrottleState::Throttled;
            let _ = app.emit("widget://throttle", &id);
            continue;
        }
        if !high_cpu && stats.throttle == ThrottleState::Throttled {
            stats.throttle = ThrottleState::Active;
            let _ = app.emit("widget://unthrottle", &id);
            continue;
        }

        // Kill switch (basé sur les stats par widget — non encore peuplées,
        // mais l'infrastructure est en place pour quand on pourra mesurer).
        if stats.cpu_pct > MAX_CPU_PCT || stats.ram_bytes / 1_000_000 > MAX_RAM_MB {
            tracing::warn!(widget = %id, cpu = stats.cpu_pct, "kill switch triggered");
            let _ = app.emit("widget://kill", &id);
        }
    }

    WatchdogState { fullscreen, high_cpu }
}

/// Détecte si une application tourne en plein écran (jeu D3D, vidéo, présentation).
#[cfg(target_os = "windows")]
fn detect_fullscreen() -> bool {
    use windows_sys::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE,
        QUNS_RUNNING_D3D_FULL_SCREEN,
    };

    let mut quns = 0i32;
    // S_OK == 0
    if unsafe { SHQueryUserNotificationState(&mut quns) } != 0 {
        return false;
    }
    quns == QUNS_RUNNING_D3D_FULL_SCREEN || quns == QUNS_BUSY || quns == QUNS_PRESENTATION_MODE
}

#[cfg(not(target_os = "windows"))]
fn detect_fullscreen() -> bool {
    false
}
