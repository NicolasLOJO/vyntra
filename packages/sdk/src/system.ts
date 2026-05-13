import type { Transport } from "./transport";

export interface SystemSnapshot {
  cpu_pct: number;
  ram_used_mb: number;
  ram_total_mb: number;
  gpu_pct: number | null;
  cpu_temp_c: number | null;
}

export interface VynSystem {
  snapshot(): Promise<SystemSnapshot>;
  /** Stream rafraîchi par le host (throttling appliqué). */
  subscribe(cb: (s: SystemSnapshot) => void): () => void;
}

export function createSystem(t: Transport): VynSystem {
  return {
    snapshot: () => t.call<SystemSnapshot>("system.snapshot"),
    subscribe: (cb) => t.on("system.tick", (p) => cb(p as SystemSnapshot)),
  };
}
