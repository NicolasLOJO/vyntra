use std::path::Path;

fn main() {
    // Garantit que les .vyn bundlés existent (sinon include_bytes! casse).
    // En dev, `pnpm pack:examples` les régénère depuis widgets-examples/.
    let bundled = Path::new("widgets-bundled");
    std::fs::create_dir_all(bundled).ok();
    for name in &[
        "clock.vyn", "cpu.vyn", "notes.vyn", "media.vyn", "launcher.vyn", "pomodoro.vyn",
        "clock-modern.vyn", "cpu-modern.vyn", "media-modern.vyn",
        "notes-modern.vyn", "pomodoro-modern.vyn", "launcher-modern.vyn",
    ] {
        let p = bundled.join(name);
        if !p.exists() {
            std::fs::write(&p, b"").ok();
        }
    }
    println!("cargo:rerun-if-changed=widgets-bundled");

    tauri_build::build()
}
