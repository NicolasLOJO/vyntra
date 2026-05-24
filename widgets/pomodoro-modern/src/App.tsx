import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { useVyn } from "@vyntra/widget-shared";

const DEFAULTS = {
  work_minutes: 25,
  break_minutes: 5,
  long_break_minutes: 15,
  long_break_after: 4,
  accent_color: "#ef4444",
};

type Cfg = typeof DEFAULTS;
type Phase = "work" | "break" | "long-break";

// r=48, circumference of the full circle
const R = 48;
const CIRC = 2 * Math.PI * R;

function getSecs(p: Phase, c: Cfg): number {
  if (p === "work") return (c.work_minutes || 25) * 60;
  if (p === "long-break") return (c.long_break_minutes || 15) * 60;
  return (c.break_minutes || 5) * 60;
}

export default function App() {
  const vyn = useVyn();
  const [cfg, setCfg] = useState<Cfg>({ ...DEFAULTS });
  const cfgRef = useRef<Cfg>(cfg);

  const [phase, setPhase] = useState<Phase>("work");
  const phaseRef = useRef<Phase>("work");

  const [totalSecs, setTotalSecs] = useState(DEFAULTS.work_minutes * 60);
  const [secsLeft, setSecsLeft] = useState(DEFAULTS.work_minutes * 60);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [phaseDone, setPhaseDone] = useState(false);
  const phaseDoneRef = useRef(false);
  const [sessions, setSessions] = useState(0);
  const sessionsRef = useRef(0);
  const tickRef = useRef<number>();

  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { phaseDoneRef.current = phaseDone; }, [phaseDone]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  useEffect(() => {
    if (!vyn) return;
    Promise.all([
      vyn.config.getAll().catch(() => null),
      vyn.storage.get("sessions").catch(() => null),
    ]).then(([savedCfg, savedSessions]: [Record<string, unknown> | null, unknown]) => {
      if (savedCfg) {
        const merged: Cfg = { ...DEFAULTS };
        for (const k of Object.keys(DEFAULTS) as (keyof Cfg)[]) {
          if (savedCfg[k] != null) (merged as Record<string, unknown>)[k] = savedCfg[k];
        }
        cfgRef.current = merged;
        setCfg(merged);
        const secs = getSecs("work", merged);
        setTotalSecs(secs);
        setSecsLeft(secs);
      }
      if (savedSessions != null) {
        const n = parseInt(String(savedSessions), 10) || 0;
        sessionsRef.current = n;
        setSessions(n);
      }
    });

    vyn.config.subscribe((change: { key?: string; value?: unknown }) => {
      if (!change?.key) return;
      setCfg((prev) => {
        const next = { ...prev, [change.key!]: change.value } as Cfg;
        cfgRef.current = next;
        return next;
      });
    });
  }, [vyn]);

  // Reset idle timer when config changes duration
  useEffect(() => {
    if (runningRef.current || phaseDoneRef.current) return;
    const secs = getSecs(phaseRef.current, cfg);
    setTotalSecs(secs);
    setSecsLeft(secs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  const stopTicker = useCallback(() => {
    setRunning(false);
    clearInterval(tickRef.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setSecsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tickRef.current);
          setRunning(false);
          setPhaseDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const advance = useCallback(() => {
    const c = cfgRef.current;
    const lba = Math.max(2, c.long_break_after || 4);
    let nextPhase: Phase;
    if (phaseRef.current === "work") {
      const next = sessionsRef.current + 1;
      sessionsRef.current = next;
      setSessions(next);
      vyn?.storage.set("sessions", next).catch(() => {});
      nextPhase = next % lba === 0 ? "long-break" : "break";
    } else {
      nextPhase = "work";
    }
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    const secs = getSecs(nextPhase, c);
    setTotalSecs(secs);
    setSecsLeft(secs);
    setPhaseDone(false);
  }, [vyn]);

  const handleStart = () => {
    if (phaseDone) { advance(); }
    else if (running) { stopTicker(); }
    else { setRunning(true); }
  };

  const handleSkip = () => { stopTicker(); advance(); };

  const handleReset = () => {
    stopTicker();
    const secs = getSecs("work", cfgRef.current);
    phaseRef.current = "work";
    setPhase("work");
    setTotalSecs(secs);
    setSecsLeft(secs);
    setPhaseDone(false);
  };

  const pct = totalSecs > 0 ? secsLeft / totalSecs : 0;
  // Depleting ring: full at start (offset=0), empty at end (offset=CIRC)
  const dashOffset = CIRC * (1 - pct);

  const mins = Math.floor(secsLeft / 60).toString().padStart(2, "0");
  const secs = (secsLeft % 60).toString().padStart(2, "0");
  const accent = cfg.accent_color || "#ef4444";
  const ringColor = phase === "work" ? accent : "#60a5fa";
  const n = Math.max(2, cfg.long_break_after || 4);
  const phaseName =
    phase === "work" ? "Focus" : phase === "long-break" ? "Long Break" : "Break";

  return (
    <div className="h-screen w-screen relative overflow-hidden rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px) saturate(160%)" }}>
      {/* Very subtle pulsing glow — only when running, CSS animation (no Framer overhead) */}
      {running && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${ringColor}30 0%, transparent 60%)`,
            animation: "vyn-pulse-glow 3s ease-in-out infinite",
          }}
        />
      )}

      {/* Ring — plain SVG with CSS transition for reliable animation */}
      <div className="relative" style={{ width: 116, height: 116 }}>
        <svg
          viewBox="0 0 120 120"
          width={116}
          height={116}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx="60" cy="60" r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="5"
          />
          {/* Progress arc — CSS transition, no Framer Motion for SVG attr */}
          <circle
            cx="60" cy="60" r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.9s linear, stroke 0.4s ease",
              filter: `drop-shadow(0 0 6px ${ringColor}99)`,
            }}
          />
        </svg>

        {/* Countdown inside ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[26px] font-extralight tabular-nums tracking-tight text-white/88"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
          >
            {mins}:{secs}
          </span>
        </div>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.8, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-[10px] font-black uppercase tracking-[0.22em]"
          style={{ color: ringColor }}
        >
          {phaseName}
        </motion.span>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={handleSkip}
          className="flex items-center justify-center rounded-full transition-all"
          style={{ width: 30, height: 30, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
        >
          <SkipForward size={12} />
        </button>
        <button
          onClick={handleStart}
          className="flex items-center justify-center rounded-full text-white transition-all"
          style={{
            width: 42, height: 42,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: `0 4px 16px ${ringColor}25`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center justify-center rounded-full transition-all"
          style={{ width: 30, height: 30, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Session dots */}
      <div className="flex gap-1.5">
        {Array.from({ length: n }).map((_, i) => (
          <span
            key={i}
            className="block rounded-full transition-all duration-300"
            style={{
              width: 5, height: 5,
              background: i < sessions % n ? ringColor : "rgba(255,255,255,0.1)",
              boxShadow: i < sessions % n ? `0 0 5px ${ringColor}` : "none",
            }}
          />
        ))}
      </div>

      <p
        className="text-[8px] font-medium uppercase tracking-wider"
        style={{ color: "rgba(255,255,255,0.18)" }}
      >
        {sessions} session{sessions !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
