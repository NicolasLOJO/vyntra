use crate::system::{self, SystemSnapshot};

#[tauri::command]
pub fn snapshot() -> SystemSnapshot {
    system::snapshot()
}
