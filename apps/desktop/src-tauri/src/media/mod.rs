//! Contrôles media multi-plateforme.
//!
//! Implémentations à brancher:
//! - Windows: SMTC (windows-rs / windows::Media::Control)
//! - Linux: MPRIS (mpris / dbus)
//! - macOS: MPNowPlayingInfoCenter / MPRemoteCommandCenter

use serde::Serialize;

#[derive(Serialize, Clone, Default)]
pub struct NowPlaying {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub app: Option<String>,
    pub is_playing: bool,
    /// Position en ms.
    pub position_ms: Option<u64>,
    pub duration_ms: Option<u64>,
    pub artwork_url: Option<String>,
}

pub fn now_playing() -> NowPlaying {
    // TODO: brancher SMTC/MPRIS/NowPlaying.
    NowPlaying::default()
}
