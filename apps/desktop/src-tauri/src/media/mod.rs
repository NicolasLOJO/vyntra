//! Contrôles media multi-plateforme.
//!
//! - Windows: SMTC via GlobalSystemMediaTransportControlsSessionManager
//! - Linux/macOS: stubs (TODO mpris / MPNowPlayingInfoCenter)
//!
//! `watch()` s'abonne aux events WinRT sur un thread dédié et émet
//! `media://change` (payload: NowPlaying) à chaque changement.
//! `now_playing()` est le fallback pull utilisé par l'IPC `get_now_playing`.

use serde::Serialize;
use tauri::{AppHandle, Runtime};

#[derive(Serialize, Clone, Default)]
pub struct NowPlaying {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    /// Source app (AUMID sur Windows, e.g. "Spotify.exe").
    pub app: Option<String>,
    pub is_playing: bool,
    /// Position courante en ms.
    pub position_ms: Option<u64>,
    /// Durée totale en ms.
    pub duration_ms: Option<u64>,
    pub artwork_url: Option<String>,
}

/// Pull : appelé par l'IPC `get_now_playing`.
pub fn now_playing() -> NowPlaying {
    platform::now_playing()
}

/// Push : s'abonne aux events SMTC et émet `media://change` sur chaque changement.
pub fn watch<R: Runtime>(app: AppHandle<R>) {
    platform::watch(app);
}

pub fn play()     { platform::control(Cmd::Play) }
pub fn pause()    { platform::control(Cmd::Pause) }
pub fn next()     { platform::control(Cmd::Next) }
pub fn previous() { platform::control(Cmd::Previous) }

pub enum Cmd { Play, Pause, Next, Previous }

// ─── Windows ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use super::NowPlaying;
    use tauri::{AppHandle, Emitter, Runtime};
    use windows::{
        Foundation::TypedEventHandler,
        Media::Control::{
            GlobalSystemMediaTransportControlsSessionManager,
            GlobalSystemMediaTransportControlsSessionPlaybackStatus,
        },
    };

    // ── Pull ──────────────────────────────────────────────────────────────────

    pub fn now_playing() -> NowPlaying {
        inner().unwrap_or_default()
    }

    fn inner() -> windows::core::Result<NowPlaying> {
        let manager =
            GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.get()?;
        let session = match manager.GetCurrentSession() {
            Ok(s) => s,
            Err(_) => return Ok(NowPlaying::default()),
        };
        session_to_np(&session)
    }

    fn session_to_np(
        session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
    ) -> windows::core::Result<NowPlaying> {
        let props    = session.TryGetMediaPropertiesAsync()?.get()?;
        let playback = session.GetPlaybackInfo()?;
        let timeline = session.GetTimelineProperties()?;

        let is_playing = matches!(
            playback.PlaybackStatus(),
            Ok(s) if s == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
        );

        let position_ms = timeline.Position().ok()
            .map(|t| (t.Duration / 10_000) as u64)
            .filter(|&p| p > 0);

        let duration_ms = timeline.EndTime().ok()
            .zip(timeline.StartTime().ok())
            .map(|(end, start)| ((end.Duration - start.Duration) / 10_000) as u64)
            .filter(|&d| d > 0);

        Ok(NowPlaying {
            title:       hstr(props.Title()),
            artist:      hstr(props.Artist()),
            album:       hstr(props.AlbumTitle()),
            app:         hstr(session.SourceAppUserModelId()),
            is_playing,
            position_ms,
            duration_ms,
            artwork_url: {
                let title_str = props.Title().map(|s| s.to_string()).unwrap_or_default();
                get_artwork_cached(&title_str, &props)
            },
        })
    }

    /// Cache artwork par titre pour éviter de ré-encoder le JPEG à chaque tick.
    fn get_artwork_cached(title: &str, props: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties) -> Option<String> {
        use parking_lot::Mutex;
        use std::sync::OnceLock;

        static CACHE: OnceLock<Mutex<(String, Option<String>)>> = OnceLock::new();
        let cache = CACHE.get_or_init(|| Mutex::new((String::new(), None)));

        {
            let lock = cache.lock();
            if lock.0 == title {
                return lock.1.clone();
            }
        }

        let result = get_artwork(props);
        let mut lock = cache.lock();
        *lock = (title.to_owned(), result.clone());
        result
    }

    fn get_artwork(
        props: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties,
    ) -> Option<String> {
        use base64::Engine as _;
        use windows::core::Interface;
        use windows::Storage::Streams::{Buffer, DataReader, IInputStream, InputStreamOptions};

        let thumbnail_ref = props.Thumbnail().ok()?;
        let stream = thumbnail_ref.OpenReadAsync().ok()?.get().ok()?;

        let size = stream.Size().ok()? as u32;
        if size == 0 || size > 4 * 1024 * 1024 {
            return None;
        }

        let buf = Buffer::Create(size).ok()?;
        // IRandomAccessStreamWithContentType implémente IInputStream — cast explicite.
        let input: IInputStream = stream.cast().ok()?;
        let filled = input
            .ReadAsync(&buf, size, InputStreamOptions::None)
            .ok()?
            .get()
            .ok()?;

        let reader = DataReader::FromBuffer(&filled).ok()?;
        let byte_count = filled.Length().ok()? as usize;
        let mut bytes = vec![0u8; byte_count];
        reader.ReadBytes(&mut bytes).ok()?;

        let mime = if bytes.starts_with(b"\xff\xd8\xff") {
            "image/jpeg"
        } else if bytes.starts_with(b"\x89PNG") {
            "image/png"
        } else {
            "image/jpeg"
        };

        Some(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(&bytes)
        ))
    }

    fn hstr(r: windows::core::Result<windows::core::HSTRING>) -> Option<String> {
        r.ok().map(|s| s.to_string()).filter(|s| !s.is_empty())
    }

    // ── Contrôles ─────────────────────────────────────────────────────────────

    pub fn control(cmd: super::Cmd) {
        let _ = control_inner(cmd);
    }

    fn control_inner(cmd: super::Cmd) -> windows::core::Result<()> {
        let manager =
            GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.get()?;
        let session = manager.GetCurrentSession()?;
        match cmd {
            super::Cmd::Play     => { session.TryPlayAsync()?.get()?; }
            super::Cmd::Pause    => { session.TryPauseAsync()?.get()?; }
            super::Cmd::Next     => { session.TrySkipNextAsync()?.get()?; }
            super::Cmd::Previous => { session.TrySkipPreviousAsync()?.get()?; }
        }
        Ok(())
    }

    // ── Push ──────────────────────────────────────────────────────────────────

    pub fn watch<R: Runtime>(app: AppHandle<R>) {
        let (tx, mut rx) = tokio::sync::watch::channel(());

        // Thread dédié : initialise COM/WinRT et s'abonne aux events SMTC.
        // Les callbacks ne font que signaler — le fetch réel se passe côté tokio.
        std::thread::spawn(move || {
            if let Err(e) = setup_events(tx) {
                tracing::warn!("SMTC watch failed: {e}");
            }
        });

        // Tâche tokio : reçoit les signaux et émet media://change.
        // Debounce 400ms + déduplication par clé pour éviter les boucles sur
        // PlaybackInfoChanged (position) qui peut tirer plusieurs fois par seconde.
        tauri::async_runtime::spawn(async move {
            let np = now_playing();
            let mut prev_key = change_key(&np);
            crate::tray::update_now_playing(&app, &np);
            let _ = app.emit("media://change", np);

            while rx.changed().await.is_ok() {
                // Vider les signaux en attente avant de faire le fetch
                while rx.has_changed().unwrap_or(false) {
                    let _ = rx.changed().await;
                }
                tokio::time::sleep(std::time::Duration::from_millis(400)).await;
                // Vider de nouveau après le sleep (évite les cascades)
                while rx.has_changed().unwrap_or(false) {
                    let _ = rx.changed().await;
                }

                let np = now_playing();
                let key = change_key(&np);
                if key == prev_key { continue; }
                prev_key = key;
                crate::tray::update_now_playing(&app, &np);
                let _ = app.emit("media://change", np);
            }
        });
    }

    /// Clé de déduplication : changement de track ou d'état play/pause.
    /// On ignore les changements de position seuls (gérés côté front par le ticker).
    fn change_key(np: &super::NowPlaying) -> String {
        format!(
            "{}/{}/{}/{}",
            np.title.as_deref().unwrap_or(""),
            np.artist.as_deref().unwrap_or(""),
            np.app.as_deref().unwrap_or(""),
            np.is_playing,
        )
    }

    fn setup_events(tx: tokio::sync::watch::Sender<()>) -> windows::core::Result<()> {
        let manager =
            GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.get()?;

        // Session change (user passe d'une app à une autre)
        let tx1 = tx.clone();
        let mgr2 = manager.clone();
        let tx_resub = tx.clone();
        let _ = manager.CurrentSessionChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx1.send(());
            // Re-souscrire aux events de la nouvelle session courante
            let _ = subscribe_session(&mgr2, &tx_resub);
            Ok(())
        }))?;

        // Sessions added/removed (apps qui démarrent/s'arrêtent)
        let tx2 = tx.clone();
        let _ = manager.SessionsChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx2.send(());
            Ok(())
        }))?;

        // Session courante au démarrage
        let _ = subscribe_session(&manager, &tx);

        // Garder le thread en vie pour maintenir les registrations WinRT.
        loop { std::thread::park(); }
    }

    /// Souscrit aux events de la session courante (media props + playback state).
    /// Les anciennes souscriptions restent actives mais restent inoffensives :
    /// elles signalent le même canal et now_playing() lit toujours la session courante.
    fn subscribe_session(
        manager: &GlobalSystemMediaTransportControlsSessionManager,
        tx: &tokio::sync::watch::Sender<()>,
    ) -> windows::core::Result<()> {
        let session = match manager.GetCurrentSession() {
            Ok(s) => s,
            Err(_) => return Ok(()),
        };

        let tx1 = tx.clone();
        let _ = session.MediaPropertiesChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx1.send(());
            Ok(())
        }))?;

        let tx2 = tx.clone();
        let _ = session.PlaybackInfoChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx2.send(());
            Ok(())
        }))?;

        Ok(())
    }
}

// ─── Autres OS ────────────────────────────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::NowPlaying;
    use tauri::{AppHandle, Runtime};

    pub fn now_playing() -> NowPlaying { NowPlaying::default() }
    pub fn control(_cmd: super::Cmd) {}

    pub fn watch<R: Runtime>(_app: AppHandle<R>) {
        // TODO Linux: mpris
        // TODO macOS: MPNowPlayingInfoCenter
    }
}
