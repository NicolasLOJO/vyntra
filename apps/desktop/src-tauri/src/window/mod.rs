//! Création à la demande de la fenêtre Manager + surfaces multi-moniteurs.
//!
//! La surface primaire est créée au démarrage par la conf Tauri ("vyntra-surface").
//! `spawn_surfaces` crée "vyntra-surface-{i}" pour chaque moniteur secondaire.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

pub const MANAGER_LABEL: &str = "manager";

pub fn open_manager<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(MANAGER_LABEL) {
        w.unminimize().ok();
        w.show()?;
        w.set_focus()?;
        return Ok(());
    }

    let url = WebviewUrl::App("manager.html".into());
    let window = WebviewWindowBuilder::new(app, MANAGER_LABEL, url)
        .title("Vyntra")
        .inner_size(960.0, 680.0)
        .min_inner_size(720.0, 480.0)
        .resizable(true)
        .center()
        .decorations(true)
        .build()?;

    // Applique Mica (Win11 22000+) avec fallback Acrylic (Win10 1803+) sur le Manager.
    // La surface desktop n'est pas touchée (click-through / hit-test).
    #[cfg(target_os = "windows")]
    apply_backdrop(&window);

    Ok(())
}

/// Tente d'appliquer Mica puis Acrylic (fallback) sur une fenêtre Windows.
///
/// - Mica         : Windows 11 Build 22000+
/// - Acrylic      : Windows 10 Build 17134 (1803)+
/// Échoue silencieusement si la version Windows ne supporte aucun des deux effets.
#[cfg(target_os = "windows")]
fn apply_backdrop<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    use window_vibrancy::{apply_acrylic, apply_mica};

    // `window_vibrancy` attend un type qui implémente `HasWindowHandle`.
    // `tauri::WebviewWindow` l'implémente via `raw-window-handle`.

    // Essayer Mica en premier (Windows 11 uniquement).
    if apply_mica(window, None).is_err() {
        // Mica non supporté — tenter Acrylic (Windows 10 1803+).
        // Couleur : None = opaque ; Some((r,g,b,a)) pour teinter.
        if let Err(e) = apply_acrylic(window, Some((18, 18, 18, 180))) {
            tracing::debug!("Mica/Acrylic non disponibles sur cette version de Windows : {e}");
        }
    }
}

/// Force une fenêtre surface au bas du z-order et l'y maintient définitivement.
///
/// Stratégie :
/// 1. `WS_EX_NOACTIVATE` — un clic ne déclenche pas d'activation → pas de remontée automatique.
/// 2. `SetWindowPos(HWND_BOTTOM)` — position initiale au fond.
/// 3. Sous-classement WndProc (`SetWindowSubclass`) — intercepte `WM_WINDOWPOSCHANGING`
///    et injecte `SWP_NOZORDER` pour bloquer toute tentative future de changement de z-order,
///    quelle qu'en soit la source (clic, Alt+Tab, autre appli, etc.).
#[cfg(target_os = "windows")]
pub fn pin_surface_to_bottom<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM,
        SWP_NOMOVE, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, WM_WINDOWPOSCHANGING, WINDOWPOS,
    };

    const WS_EX_NOACTIVATE: isize = 0x0800_0000;
    const SUBCLASS_ID: usize = 0x5946_4E56; // "VNFY" — identifiant arbitraire unique

    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        if msg == WM_WINDOWPOSCHANGING {
            // Bloquer tout changement de z-order — la surface reste toujours au fond.
            let pos = &mut *(lparam as *mut WINDOWPOS);
            pos.flags |= SWP_NOZORDER;
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }

    let Ok(raw) = window.hwnd() else { return };
    let hwnd = raw.0 as HWND;

    unsafe {
        // 1. Empêcher l'activation par clic.
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE);

        // 2. Positionner au fond immédiatement.
        SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

        // 3. Sous-classer pour intercepter tous les futurs WM_WINDOWPOSCHANGING.
        SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, 0);
    }
}

/// Crée une fenêtre surface pour chaque moniteur secondaire (index 1..n).
/// La surface primaire ("vyntra-surface", index 0) est déjà créée par tauri.conf.json.
pub fn spawn_surfaces<R: Runtime>(app: &AppHandle<R>) {
    // Requires an existing window to call monitor APIs.
    let surface = match app.get_webview_window("vyntra-surface") {
        Some(w) => w,
        None => {
            tracing::warn!("vyntra-surface not found — skipping multi-monitor setup");
            return;
        }
    };

    let all_monitors = match surface.available_monitors() {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!("cannot enumerate monitors: {e}");
            return;
        }
    };

    if all_monitors.len() <= 1 {
        return;
    }

    // Position of the primary monitor — skip it (already handled by vyntra-surface).
    let primary_pos = surface
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| *m.position());

    let mut idx = 1u8;
    for monitor in &all_monitors {
        if let Some(ppos) = &primary_pos {
            if monitor.position() == ppos {
                continue;
            }
        }

        let label = format!("vyntra-surface-{idx}");
        if app.get_webview_window(&label).is_some() {
            idx += 1;
            continue;
        }

        let scale = monitor.scale_factor();
        let pos = monitor.position();
        let size = monitor.size();
        let logical_x = pos.x as f64 / scale;
        let logical_y = pos.y as f64 / scale;
        let logical_w = size.width as f64 / scale;
        let logical_h = size.height as f64 / scale;

        let url = WebviewUrl::App("index.html".into());
        match WebviewWindowBuilder::new(app, &label, url)
            .transparent(true)
            .decorations(false)
            .skip_taskbar(true)
            .shadow(false)
            .resizable(false)
            .position(logical_x, logical_y)
            .inner_size(logical_w, logical_h)
            .build()
        {
            Ok(w) => {
                tracing::info!(label, "surface window created for secondary monitor");
                #[cfg(target_os = "windows")]
                pin_surface_to_bottom(&w);
            }
            Err(e) => tracing::error!(label, err = %e, "failed to create surface window"),
        }

        idx += 1;
    }
}

/// Thread de hit-test click-through (Windows release uniquement).
///
/// Poll `GetCursorPos` toutes les 16ms et bascule `set_ignore_cursor_events`
/// sur chaque surface selon que le curseur est dans un rect interactif ou non.
#[cfg(target_os = "windows")]
pub fn spawn_hit_test<R: Runtime + 'static>(app: AppHandle<R>, state: crate::state::AppState) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    std::thread::spawn(move || {
        // Par label : dernier état connu pour éviter des appels inutiles.
        let mut last: std::collections::HashMap<String, bool> = std::collections::HashMap::new();

        loop {
            std::thread::sleep(std::time::Duration::from_millis(50));

            let edit_mode = *state.edit_mode.read();

            let pt = unsafe {
                let mut p = POINT { x: 0, y: 0 };
                GetCursorPos(&mut p);
                p
            };

            let hit_rects = state.hit_rects.read();

            for (label, win) in app.webview_windows() {
                if !label.starts_with("vyntra-surface") {
                    continue;
                }

                let interactive = if edit_mode {
                    true
                } else if let Some(rects) = hit_rects.get(&label) {
                    rects.iter().any(|r| {
                        pt.x >= r.x
                            && pt.x < r.x + r.w
                            && pt.y >= r.y
                            && pt.y < r.y + r.h
                    })
                } else {
                    false
                };

                let prev = last.get(&label).copied().unwrap_or(true);
                if interactive != prev {
                    let _ = win.set_ignore_cursor_events(!interactive);
                    last.insert(label, interactive);
                }
            }
        }
    });
}
