use crate::persistence::AppSettings;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state.store().get_settings()
}

#[tauri::command]
pub fn set_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    set_autostart(settings.autostart).map_err(|e| e.to_string())?;
    state.store().set_settings(settings);
    state.store().flush().map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn set_autostart(enabled: bool) -> anyhow::Result<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW,
        HKEY_CURRENT_USER, KEY_WRITE, REG_SZ,
    };

    fn wide_null(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0u16)).collect()
    }

    let subkey = wide_null("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
    let mut hkey: isize = 0;

    let rc = unsafe {
        RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_WRITE, &mut hkey)
    };
    if rc != 0 {
        anyhow::bail!("RegOpenKeyExW failed: {rc}");
    }

    let name = wide_null("Vyntra");
    let rc = if enabled {
        let exe = std::env::current_exe()?;
        let val = wide_null(&exe.to_string_lossy());
        unsafe {
            RegSetValueExW(
                hkey,
                name.as_ptr(),
                0,
                REG_SZ,
                val.as_ptr() as *const u8,
                (val.len() * 2) as u32,
            )
        }
    } else {
        // 2 = ERROR_FILE_NOT_FOUND — ok if the key wasn't there
        let r = unsafe { RegDeleteValueW(hkey, name.as_ptr()) };
        if r == 2 { 0 } else { r }
    };

    unsafe { RegCloseKey(hkey) };

    if rc != 0 {
        anyhow::bail!("registry operation failed: {rc}");
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_autostart(_enabled: bool) -> anyhow::Result<()> {
    // TODO: Linux (~/.config/autostart), macOS (LaunchAgent plist)
    Ok(())
}
