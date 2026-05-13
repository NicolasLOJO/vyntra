//! Monitoring système global (pas par widget).

use serde::Serialize;
use sysinfo::System;

#[derive(Serialize, Clone, Default)]
pub struct SystemSnapshot {
    pub cpu_pct: f32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    /// Vide pour l'instant; à brancher sur nvml (NVIDIA) / IOKit / etc.
    pub gpu_pct: Option<f32>,
    pub cpu_temp_c: Option<f32>,
}

pub fn snapshot() -> SystemSnapshot {
    let mut sys = System::new();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    SystemSnapshot {
        cpu_pct: sys.global_cpu_usage(),
        ram_used_mb: sys.used_memory() / 1_000_000,
        ram_total_mb: sys.total_memory() / 1_000_000,
        gpu_pct: None,
        cpu_temp_c: None,
    }
}
