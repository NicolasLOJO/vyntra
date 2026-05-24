import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVyn } from "@vyntra/widget-shared";

export default function App() {
  const [time, setTime] = useState(new Date());
  useVyn();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(time);

  return (
    <div className="h-screen w-screen relative overflow-hidden rounded-2xl flex flex-col items-center justify-center gap-1" style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px) saturate(160%)" }}>
      {/* Subtle ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(124,168,255,0.07) 0%, transparent 55%)," +
            "radial-gradient(circle at 70% 70%, rgba(168,124,255,0.05) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-7xl font-extralight tracking-tighter tabular-nums text-white/90">
            {hours}:{minutes}
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={seconds}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.3, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="text-2xl font-light tabular-nums w-[1.2ch]"
            >
              {seconds}
            </motion.span>
          </AnimatePresence>
        </div>

        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
          {dateStr}
        </span>
      </div>

      {/* Mouse-follow light trace */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            "radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.04) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}
