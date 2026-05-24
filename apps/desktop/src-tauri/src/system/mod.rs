//! Monitoring système global (CPU, RAM, disques, GPU).

use parking_lot::Mutex;
use serde::Serialize;
use std::sync::OnceLock;
use sysinfo::{DiskKind, Disks, System, MINIMUM_CPU_UPDATE_INTERVAL};

// ── Types publics ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct DiskInfo {
    /// Lettre de lecteur ("C:") ou point de montage ("/").
    pub label: String,
    /// "SSD", "HDD", ou "Disk".
    pub kind: String,
    pub total_mb: u64,
    pub used_mb: u64,
}

#[derive(Serialize, Clone)]
pub struct GpuInfo {
    /// Nom abrégé du GPU ("RTX 4080", "RX 7900 XTX"…).
    pub name: String,
    pub vram_total_mb: u64,
    pub vram_used_mb: Option<u64>,
    /// Usage % — None si non disponible sans lib spécialisée.
    pub usage_pct: Option<f32>,
}

#[derive(Serialize, Clone, Default)]
pub struct SystemSnapshot {
    pub cpu_pct: f32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub disks: Vec<DiskInfo>,
    pub gpu: Option<GpuInfo>,
}

// ── Sampler CPU/RAM ────────────────────────────────────────────────────────────

fn sampler() -> &'static Mutex<System> {
    static S: OnceLock<Mutex<System>> = OnceLock::new();
    S.get_or_init(|| {
        let mut sys = System::new_all();
        sys.refresh_cpu_usage();
        // Premier sample "à blanc" — le suivant donnera une valeur réelle.
        std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
        sys.refresh_cpu_usage();
        Mutex::new(sys)
    })
}

// ── Point d'entrée ─────────────────────────────────────────────────────────────

/// Retourne uniquement le CPU% système — moins coûteux que `snapshot()` complet
/// (pas d'énumération disques ni de query DXGI).
pub fn cpu_pct() -> f32 {
    let mut sys = sampler().lock();
    sys.refresh_cpu_usage();
    sys.global_cpu_usage()
}

pub fn snapshot() -> SystemSnapshot {
    // Libérer le verrou avant les queries GPU/disk (plus longues).
    let (cpu_pct, ram_used_mb, ram_total_mb) = {
        let mut sys = sampler().lock();
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        (
            sys.global_cpu_usage(),
            sys.used_memory() / 1_000_000,
            sys.total_memory() / 1_000_000,
        )
    };

    SystemSnapshot {
        cpu_pct,
        ram_used_mb,
        ram_total_mb,
        disks: get_disks(),
        gpu: get_gpu_info(),
    }
}

// ── Disques ────────────────────────────────────────────────────────────────────

fn get_disks() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut result: Vec<DiskInfo> = disks
        .list()
        .iter()
        .filter_map(|d| {
            let total = d.total_space();
            if total == 0 {
                return None;
            }
            let used = total.saturating_sub(d.available_space());

            let mount = d.mount_point().to_string_lossy();
            // Windows : "C:\" → "C:" ; autres OS : garder tel quel.
            let label = if cfg!(target_os = "windows") {
                mount.trim_end_matches('\\').to_string()
            } else {
                mount.into_owned()
            };

            let kind = match d.kind() {
                DiskKind::SSD => "SSD",
                DiskKind::HDD => "HDD",
                _ => "Disk",
            }
            .to_string();

            Some(DiskInfo {
                label,
                kind,
                total_mb: total / 1_000_000,
                used_mb: used / 1_000_000,
            })
        })
        .collect();

    result.sort_by(|a, b| a.label.cmp(&b.label));
    result
}

// ── GPU (DXGI — Windows) ───────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_gpu_info() -> Option<GpuInfo> {
    use windows::core::Interface;
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIAdapter3, IDXGIFactory1, DXGI_MEMORY_SEGMENT_GROUP_LOCAL,
        DXGI_QUERY_VIDEO_MEMORY_INFO,
    };

    unsafe {
        let factory: IDXGIFactory1 = CreateDXGIFactory1().ok()?;

        let mut idx = 0u32;
        loop {
            let adapter = match factory.EnumAdapters1(idx) {
                Ok(a) => a,
                Err(_) => break,
            };
            idx += 1;

            let desc = match adapter.GetDesc1() {
                Ok(d) => d,
                Err(_) => continue,
            };

            // DXGI_ADAPTER_FLAG_SOFTWARE = 2 — ignorer WARP / rendu logiciel.
            if desc.Flags & 2 != 0 {
                continue;
            }

            let end = desc.Description.iter().position(|&c| c == 0).unwrap_or(128);
            let full_name = String::from_utf16_lossy(&desc.Description[..end]);
            let name = abbreviate_gpu_name(&full_name);
            let vram_total_mb = desc.DedicatedVideoMemory as u64 / 1_000_000;

            // IDXGIAdapter3::QueryVideoMemoryInfo → VRAM utilisée.
            let vram_used_mb = adapter.cast::<IDXGIAdapter3>().ok().and_then(|a3| {
                let mut info: DXGI_QUERY_VIDEO_MEMORY_INFO = std::mem::zeroed();
                a3.QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &mut info)
                    .ok()?;
                Some(info.CurrentUsage as u64 / 1_000_000)
            });

            return Some(GpuInfo {
                name,
                vram_total_mb,
                vram_used_mb,
                usage_pct: gpu_pdh::sample(),
            });
        }
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn get_gpu_info() -> Option<GpuInfo> {
    None
}

/// Réduit les noms verbeux : "NVIDIA GeForce RTX 4080" → "RTX 4080".
fn abbreviate_gpu_name(name: &str) -> String {
    let prefixes = [
        "NVIDIA GeForce ",
        "NVIDIA Quadro ",
        "NVIDIA ",
        "AMD Radeon RX ",
        "AMD Radeon ",
        "AMD ",
        "Intel Arc ",
        "Intel UHD Graphics ",
        "Intel ",
        "Apple ",
    ];
    for p in &prefixes {
        if let Some(rest) = name.strip_prefix(p) {
            let short = rest.trim().to_string();
            if !short.is_empty() {
                return short;
            }
        }
    }
    name.to_string()
}

// ── GPU usage % via PDH (Windows) ─────────────────────────────────────────────
//
// Compteur PDH : \GPU Engine(*)\Utilization Percentage
// Nécessite deux PdhCollectQueryData pour calculer un taux :
//   - premier appel  → baseline (retourne None)
//   - appels suivants → retourne Some(usage_pct)

#[cfg(target_os = "windows")]
mod gpu_pdh {
    use parking_lot::Mutex;
    use std::sync::OnceLock;
    use windows_sys::Win32::System::Performance::{
        PdhAddEnglishCounterW, PdhCloseQuery, PdhCollectQueryData,
        PdhGetFormattedCounterArrayW, PdhOpenQueryW, PDH_FMT_COUNTERVALUE_ITEM_W,
        PDH_FMT_DOUBLE,
    };

    enum State {
        Uninit,
        Ready { query: isize, counter: isize },
        Failed,
    }

    fn pdh_state() -> &'static Mutex<State> {
        static S: OnceLock<Mutex<State>> = OnceLock::new();
        S.get_or_init(|| Mutex::new(State::Uninit))
    }

    pub fn sample() -> Option<f32> {
        let mut st = pdh_state().lock();
        match &mut *st {
            State::Failed => None,
            State::Uninit => {
                let path: Vec<u16> = "\\GPU Engine(*)\\Utilization Percentage\0"
                    .encode_utf16()
                    .collect();
                let mut query = 0isize;
                if unsafe { PdhOpenQueryW(std::ptr::null(), 0, &mut query) } != 0 {
                    *st = State::Failed;
                    return None;
                }
                let mut counter = 0isize;
                if unsafe { PdhAddEnglishCounterW(query, path.as_ptr(), 0, &mut counter) } != 0 {
                    unsafe { PdhCloseQuery(query) };
                    *st = State::Failed;
                    return None;
                }
                unsafe { PdhCollectQueryData(query) };
                *st = State::Ready { query, counter };
                None // baseline établie — valeur disponible au prochain appel
            }
            State::Ready { query, counter } => {
                unsafe { PdhCollectQueryData(*query) };
                read_3d_usage(*counter)
            }
        }
    }

    fn read_3d_usage(counter: isize) -> Option<f32> {
        let mut buf_size = 0u32;
        let mut item_count = 0u32;

        // Premier appel : récupère la taille de buffer nécessaire.
        unsafe {
            PdhGetFormattedCounterArrayW(
                counter,
                PDH_FMT_DOUBLE,
                &mut buf_size,
                &mut item_count,
                std::ptr::null_mut(),
            )
        };

        if buf_size == 0 {
            return None;
        }

        // Buffer aligné sur 8 octets (pour les pointeurs et f64 dans la struct).
        let word_count = (buf_size as usize).div_ceil(8);
        let mut buf: Vec<u64> = vec![0u64; word_count];

        let mut read_size = buf_size;
        let mut read_count = 0u32;
        let status = unsafe {
            PdhGetFormattedCounterArrayW(
                counter,
                PDH_FMT_DOUBLE,
                &mut read_size,
                &mut read_count,
                buf.as_mut_ptr() as *mut PDH_FMT_COUNTERVALUE_ITEM_W,
            )
        };

        if status != 0 || read_count == 0 {
            return None;
        }

        // Agréger uniquement les instances engtype_3D (charge 3D/jeu).
        let items_ptr = buf.as_ptr() as *const PDH_FMT_COUNTERVALUE_ITEM_W;
        let mut total = 0f64;
        let mut n = 0u32;

        for i in 0..read_count {
            let item = unsafe { &*items_ptr.add(i as usize) };
            let name_ptr = item.szName;
            if name_ptr.is_null() {
                continue;
            }
            let name = unsafe {
                let len = (0usize..).take_while(|&j| *name_ptr.add(j) != 0).count();
                String::from_utf16_lossy(std::slice::from_raw_parts(name_ptr, len))
            };
            if name.contains("engtype_3D") {
                total += unsafe { item.FmtValue.Anonymous.doubleValue };
                n += 1;
            }
        }

        if n > 0 {
            Some((total as f32 / n as f32).clamp(0.0, 100.0))
        } else {
            Some(0.0) // aucun moteur 3D actif = 0 % de charge
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod gpu_pdh {
    pub fn sample() -> Option<f32> {
        None
    }
}
