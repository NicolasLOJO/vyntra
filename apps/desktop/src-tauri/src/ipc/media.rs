use crate::media::{self, NowPlaying};

#[tauri::command]
pub fn get_now_playing() -> NowPlaying {
    media::now_playing()
}
