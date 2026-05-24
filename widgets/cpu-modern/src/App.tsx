import { useState, useEffect } from "react";
import { useVyn } from "@vyntra/widget-shared";

interface DiskInfo {
  label: string;
  kind: string;
  total_mb: number;
  used_mb: number;
}

interface GpuInfo {
  name: string;
  vram_total_mb: number;
  vram_used_mb?: number;
  usage_pct?: number;
}

interface Snapshot {
  cpu_pct: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disks: DiskInfo[];
  gpu?: GpuInfo;
}

function MetricBar({
  label,
  pct,
  value,
  accent = "blue",
}: {
  label: string;
  pct: number;
  value: string;
  accent?: "blue" | "purple" | "teal" | "amber";
}) {
  const clamped = Math.min(100, Math.max(0, pct));

  const gradients: Record<string, string> = {
    blue:   "linear-gradient(90deg, #4f8cff 0%, #7ca8ff 40%, #a78bfa 70%, #c084fc 100%)",
    purple: "linear-gradient(90deg, #a78bfa 0%, #c084fc 60%, #e879f9 100%)",
    teal:   "linear-gradient(90deg, #2dd4bf 0%, #34d399 60%, #6ee7b7 100%)",
    amber:  "linear-gradient(90deg, #fbbf24 0%, #f59e0b 60%, #fcd34d 100%)",
  };

  const glows: Record<string, string> = {
    blue:   "0 0 8px rgba(124,168,255,0.35)",
    purple: "0 0 8px rgba(192,132,252,0.35)",
    teal:   "0 0 8px rgba(52,211,153,0.35)",
    amber:  "0 0 8px rgba(251,191,36,0.35)",
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
          {label}
        </span>
        <span className="text-[10px] font-extralight tabular-nums text-white/60">
          {value}
        </span>
      </div>
      <div className="h-[4px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full"
          style={{
            background: gradients[accent],
            boxShadow: glows[accent],
            width: `${clamped}%`,
            transition: "width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[7px] font-black uppercase tracking-[0.25em] text-white/20">
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

export default function App() {
  const vyn = useVyn();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vyn) return;
    let timer: number;

    const tick = async () => {
      try {
        const s: Snapshot = await vyn.system.snapshot();
        setSnap(s);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    };

    const start = () => { tick(); timer = window.setInterval(tick, 2000); };
    const stop = () => window.clearInterval(timer);

    start();
    vyn.lifecycle.onSleep(stop);
    vyn.lifecycle.onWake(start);
    vyn.lifecycle.onThrottle(() => { stop(); tick(); timer = window.setInterval(tick, 10_000); });
    vyn.lifecycle.onUnthrottle(() => { stop(); start(); });

    return () => stop();
  }, [vyn]);

  const cpuPct = snap?.cpu_pct ?? 0;
  const ramPct = snap ? (snap.ram_used_mb / snap.ram_total_mb) * 100 : 0;
  const ramStr = snap
    ? `${(snap.ram_used_mb / 1024).toFixed(1)} / ${(snap.ram_total_mb / 1024).toFixed(1)} GB`
    : "— / — GB";

  return (
    <div
      className="h-screen w-screen relative overflow-hidden rounded-2xl flex flex-col px-4 py-3.5 gap-3"
      style={{
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(124,168,255,0.07) 0%, transparent 55%)," +
            "radial-gradient(ellipse at 80% 50%, rgba(167,139,250,0.05) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 flex flex-col gap-3 overflow-y-auto min-h-0 flex-1" style={{ scrollbarWidth: "none" }}>

        {/* CPU & RAM */}
        <div className="flex flex-col gap-2.5">
          <SectionLabel>System</SectionLabel>
          <MetricBar label="CPU" pct={cpuPct} value={`${cpuPct.toFixed(1)}%`} accent="blue" />
          <MetricBar label="Memory" pct={ramPct} value={ramStr} accent="purple" />
        </div>

        {/* GPU */}
        {snap?.gpu && (
          <div className="flex flex-col gap-2">
            <SectionLabel>GPU — {snap.gpu.name}</SectionLabel>
            {snap.gpu.usage_pct != null && (
              <MetricBar
                label="Load"
                pct={snap.gpu.usage_pct}
                value={`${snap.gpu.usage_pct.toFixed(1)}%`}
                accent="purple"
              />
            )}
            {snap.gpu.vram_used_mb != null ? (
              <MetricBar
                label="VRAM"
                pct={(snap.gpu.vram_used_mb! / snap.gpu.vram_total_mb) * 100}
                value={`${(snap.gpu.vram_used_mb! / 1024).toFixed(1)} / ${(snap.gpu.vram_total_mb / 1024).toFixed(1)} GB`}
                accent="teal"
              />
            ) : (
              <MetricBar
                label="VRAM"
                pct={0}
                value={`${(snap.gpu.vram_total_mb / 1024).toFixed(1)} GB`}
                accent="teal"
              />
            )}
          </div>
        )}

        {/* Disks */}
        {snap && snap.disks.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Storage</SectionLabel>
            {snap.disks.map((disk) => {
              const pct = (disk.used_mb / disk.total_mb) * 100;
              const usedGB = (disk.used_mb / 1024).toFixed(0);
              const totalGB = (disk.total_mb / 1024).toFixed(0);
              const isAlmost = pct > 85;
              return (
                <MetricBar
                  key={disk.label}
                  label={`${disk.label} · ${disk.kind}`}
                  pct={pct}
                  value={`${usedGB} / ${totalGB} GB`}
                  accent={isAlmost ? "amber" : "teal"}
                />
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="absolute bottom-2 inset-x-0 text-center text-[9px] text-red-400/40 z-10">
          {error}
        </p>
      )}
    </div>
  );
}
