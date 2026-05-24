//! Énumération des applications installées + lancement.
//!
//! Windows : scan du Start Menu (`%PROGRAMDATA%` + `%APPDATA%`) + icons via SHGetFileInfoW.
//! Linux/macOS : stubs (TODO: .desktop files, LaunchServices).

use dashmap::DashMap;
use parking_lot::Mutex;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
pub struct AppEntry {
    /// Chemin du raccourci — utilisé comme ID opaque par le dispatcher.
    pub id: String,
    pub name: String,
}

// ── Cache ──────────────────────────────────────────────────────────────────────

fn app_cache() -> &'static Mutex<Option<Vec<AppEntry>>> {
    static C: OnceLock<Mutex<Option<Vec<AppEntry>>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(None))
}

fn icon_cache() -> &'static DashMap<String, Option<String>> {
    static C: OnceLock<DashMap<String, Option<String>>> = OnceLock::new();
    C.get_or_init(DashMap::new)
}

// ── API publique ───────────────────────────────────────────────────────────────

/// Retourne la liste triée des apps (depuis le cache ou re-scanne).
pub fn list_apps() -> Vec<AppEntry> {
    let cache = app_cache();
    let mut lock = cache.lock();
    if let Some(apps) = lock.as_ref() {
        return apps.clone();
    }
    let apps = platform::scan();
    *lock = Some(apps.clone());
    apps
}

/// Retourne l'icône (data URL PNG 32×32) pour un ID donné, ou None.
/// Cache par ID — re-extrait uniquement si absent.
pub fn get_icon(id: &str) -> Option<String> {
    let cache = icon_cache();
    if let Some(val) = cache.get(id) {
        return val.clone();
    }
    let result = platform::extract_icon(id);
    cache.insert(id.to_owned(), result.clone());
    result
}

/// Lance l'application (via son raccourci .lnk ou path exécutable).
pub fn launch(id: &str) -> anyhow::Result<()> {
    platform::launch(id)
}

// ─── Windows ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use super::AppEntry;
    use base64::Engine as _;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    fn wide_null(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0u16)).collect()
    }

    // ── Scan : Get-StartApps (Win32 + UWP) avec fallback .lnk ────────────────

    pub fn scan() -> Vec<AppEntry> {
        // @(...) force le tableau même avec un seul résultat.
        let ps = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "@(Get-StartApps) | ConvertTo-Json -Compress",
            ])
            .output();

        if let Ok(out) = ps {
            if out.status.success() {
                let json = String::from_utf8_lossy(&out.stdout);
                let apps = parse_start_apps(json.trim());
                if !apps.is_empty() {
                    return apps;
                }
            }
        }

        // Fallback : scan .lnk (PowerShell indisponible ou résultat vide)
        tracing::warn!("Get-StartApps failed, falling back to .lnk scan");
        scan_lnk()
    }

    #[derive(serde::Deserialize)]
    struct RawApp {
        #[serde(rename = "Name")]
        name: String,
        #[serde(rename = "AppID")]
        app_id: String,
    }

    fn parse_start_apps(json: &str) -> Vec<AppEntry> {
        let raw: Vec<RawApp> = serde_json::from_str(json).unwrap_or_default();
        let skip = ["uninstall", "setup", "remove", "repair"];
        let mut entries: Vec<AppEntry> = raw
            .into_iter()
            .filter(|a| {
                let n = a.name.to_ascii_lowercase();
                !skip.iter().any(|s| n.contains(s))
            })
            .map(|a| AppEntry { id: a.app_id, name: a.name })
            .collect();
        entries.sort_by_key(|a| a.name.to_ascii_lowercase());
        entries
    }

    fn scan_lnk() -> Vec<AppEntry> {
        let mut entries = Vec::new();
        for var in &["PROGRAMDATA", "APPDATA"] {
            if let Ok(base) = std::env::var(var) {
                let dir = std::path::PathBuf::from(base)
                    .join("Microsoft\\Windows\\Start Menu\\Programs");
                scan_lnk_dir(&dir, &mut entries);
            }
        }
        entries.sort_by_key(|a| a.name.to_ascii_lowercase());
        entries.dedup_by(|b, a| a.name.eq_ignore_ascii_case(&b.name));
        entries
    }

    fn scan_lnk_dir(dir: &std::path::Path, out: &mut Vec<AppEntry>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for entry in rd.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_lnk_dir(&path, out);
            } else if path.extension().and_then(|e| e.to_str()) == Some("lnk") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let name_lc = stem.to_ascii_lowercase();
                    if name_lc.contains("uninstall") || name_lc.contains("setup") {
                        continue;
                    }
                    out.push(AppEntry { id: path.to_string_lossy().into_owned(), name: stem.to_owned() });
                }
            }
        }
    }

    // SHGetFileInfoW n'est pas exposé par le binding windows-sys 0.52 ;
    // SHParseDisplayName non plus — on les déclare manuellement.
    // shell32 et ole32 sont déjà liés via Win32_UI_Shell / Win32_System_Com.
    #[repr(C)]
    #[allow(clippy::upper_case_acronyms)]
    struct ITEMIDLIST { _opaque: u8 }

    extern "system" {
        fn SHGetFileInfoW(
            psz_path: *const u16,
            dw_file_attributes: u32,
            psfi: *mut windows_sys::Win32::UI::Shell::SHFILEINFOW,
            cb_file_info: u32,
            u_flags: u32,
        ) -> usize;

        /// Convertit un nom d'affichage shell (ex: "shell:AppsFolder\…") en PIDL.
        fn SHParseDisplayName(
            psz_name: *const u16,
            pbc: *mut core::ffi::c_void, // IBindCtx* — null accepté
            ppidl: *mut *mut ITEMIDLIST,
            sf_gao_in: u32,
            psf_gao_out: *mut u32,
        ) -> i32; // HRESULT
    }

    // ── Icon extraction ───────────────────────────────────────────────────────

    pub fn extract_icon(id: &str) -> Option<String> {
        if id.contains('!') {
            // UWP app (AUMID) : SHGetFileInfoW ne comprend pas les chemins
            // shell:AppsFolder\ comme des chemins filesystem.
            // On passe par SHParseDisplayName → PIDL → SHGetFileInfoW(SHGFI_PIDL).
            extract_icon_uwp(id)
        } else {
            // Win32 app (.lnk ou chemin exe)
            extract_icon_win32(id)
        }
    }

    /// Apps UWP : convertit l'AUMID en PIDL via SHParseDisplayName,
    /// puis extrait l'icône shell avec SHGFI_PIDL.
    fn extract_icon_uwp(aumid: &str) -> Option<String> {
        use windows_sys::Win32::System::Com::CoTaskMemFree;
        use windows_sys::Win32::UI::Shell::{SHFILEINFOW, SHGFI_ICON, SHGFI_PIDL};

        let display_name = format!("shell:AppsFolder\\{}", aumid);
        let wide = wide_null(&display_name);

        let mut pidl: *mut ITEMIDLIST = std::ptr::null_mut();
        let mut attrs: u32 = 0;

        // SHParseDisplayName résout n'importe quel nom d'affichage shell en PIDL.
        let hr = unsafe {
            SHParseDisplayName(wide.as_ptr(), std::ptr::null_mut(), &mut pidl, 0, &mut attrs)
        };

        if hr != 0 || pidl.is_null() {
            return None;
        }

        let mut shfi: SHFILEINFOW = unsafe { std::mem::zeroed() };
        // SHGFI_PIDL : pszPath est traité comme un PIDL et non un chemin fichier.
        let rc = unsafe {
            SHGetFileInfoW(
                pidl as *const u16,
                0,
                &mut shfi,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_PIDL,
            )
        };

        unsafe { CoTaskMemFree(pidl as *const core::ffi::c_void) };

        if rc == 0 || shfi.hIcon == 0 {
            return None;
        }

        hicon_to_png(shfi.hIcon)
    }

    /// Apps Win32 : chemin .lnk ou exe → SHGetFileInfoW standard.
    fn extract_icon_win32(lnk_path: &str) -> Option<String> {
        use windows_sys::Win32::UI::Shell::{SHFILEINFOW, SHGFI_ICON};

        let path_wide = wide_null(lnk_path);
        let mut shfi: SHFILEINFOW = unsafe { std::mem::zeroed() };

        let rc = unsafe {
            SHGetFileInfoW(
                path_wide.as_ptr(),
                0,
                &mut shfi,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON,
            )
        };

        if rc == 0 || shfi.hIcon == 0 {
            return None;
        }

        hicon_to_png(shfi.hIcon)
    }

    /// Rend un HICON en PNG 32×32, encodé en data URL base64.
    fn hicon_to_png(hicon: isize) -> Option<String> {
        use windows_sys::Win32::Graphics::Gdi::{
            BI_RGB, CreateCompatibleDC, CreateDIBSection, DIB_RGB_COLORS, DeleteDC, DeleteObject,
            GetDC, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, RGBQUAD,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{DI_NORMAL, DestroyIcon, DrawIconEx};

        let (w, h) = (32i32, 32i32);
        let screen_dc = unsafe { GetDC(0) };
        if screen_dc == 0 {
            unsafe { DestroyIcon(hicon) };
            return None;
        }

        let mem_dc = unsafe { CreateCompatibleDC(screen_dc) };
        if mem_dc == 0 {
            unsafe { ReleaseDC(0, screen_dc); DestroyIcon(hicon) };
            return None;
        }

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD { rgbBlue: 0, rgbGreen: 0, rgbRed: 0, rgbReserved: 0 }],
        };

        let mut bits_ptr: *mut core::ffi::c_void = std::ptr::null_mut();
        let hbm = unsafe {
            CreateDIBSection(mem_dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, 0, 0)
        };

        if hbm == 0 || bits_ptr.is_null() {
            unsafe { DeleteDC(mem_dc); ReleaseDC(0, screen_dc); DestroyIcon(hicon) };
            return None;
        }

        unsafe { SelectObject(mem_dc, hbm) };
        unsafe { DrawIconEx(mem_dc, 0, 0, hicon, w, h, 0, 0, DI_NORMAL) };

        let pixel_bytes = (w * h * 4) as usize;
        let mut pixels = vec![0u8; pixel_bytes];
        unsafe {
            std::ptr::copy_nonoverlapping(bits_ptr as *const u8, pixels.as_mut_ptr(), pixel_bytes);
        }

        unsafe {
            DeleteDC(mem_dc);
            ReleaseDC(0, screen_dc);
            DeleteObject(hbm);
            DestroyIcon(hicon);
        }

        // BGRA pré-multiplié → RGBA straight alpha
        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
            let a = chunk[3] as u32;
            if a > 0 && a < 255 {
                chunk[0] = ((chunk[0] as u32 * 255 + a / 2) / a).min(255) as u8;
                chunk[1] = ((chunk[1] as u32 * 255 + a / 2) / a).min(255) as u8;
                chunk[2] = ((chunk[2] as u32 * 255 + a / 2) / a).min(255) as u8;
            }
        }

        let png = encode_png(&pixels, w as u32, h as u32)?;
        Some(format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(&png)
        ))
    }

    fn encode_png(rgba: &[u8], w: u32, h: u32) -> Option<Vec<u8>> {
        let mut out = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut out, w, h);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            let mut writer = enc.write_header().ok()?;
            writer.write_image_data(rgba).ok()?;
        }
        Some(out)
    }

    // ── Launch ────────────────────────────────────────────────────────────────

    pub fn launch(id: &str) -> anyhow::Result<()> {
        use windows_sys::Win32::UI::Shell::ShellExecuteW;

        // UWP apps : AppID est un AUMID (contient '!'), ouvrir via shell:AppsFolder.
        // Win32 apps : AppID est un chemin exe ou un nom, ShellExecuteW suffit.
        let file = if id.contains('!') {
            format!("shell:AppsFolder\\{}", id)
        } else {
            id.to_owned()
        };

        let verb = wide_null("open");
        let file_w = wide_null(&file);
        let rc = unsafe {
            ShellExecuteW(0, verb.as_ptr(), file_w.as_ptr(), std::ptr::null(), std::ptr::null(), 1)
        };
        if (rc as isize) <= 32 {
            anyhow::bail!("ShellExecuteW failed: {rc}");
        }
        Ok(())
    }
}

// ─── Autres OS ────────────────────────────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::AppEntry;
    pub fn scan() -> Vec<AppEntry> { vec![] }
    pub fn extract_icon(_id: &str) -> Option<String> { None }
    pub fn launch(_id: &str) -> anyhow::Result<()> { Ok(()) }
}
