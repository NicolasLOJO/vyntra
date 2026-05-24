import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkipBack, Play, Pause, SkipForward, Music } from "lucide-react";
import { useVyn } from "@vyntra/widget-shared";

interface NowPlaying {
  title?: string;
  artist?: string;
  album?: string;
  app?: string;
  artwork_url?: string;
  is_playing?: boolean;
  position_ms?: number;
  duration_ms?: number;
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function shortApp(aumid: string) {
  return (
    aumid
      .split("!")[0]
      .replace(/\.exe$/i, "")
      .split(".")
      .pop() ?? aumid
  ).toUpperCase();
}

export default function App() {
  const vyn = useVyn();
  const [np, setNp] = useState<NowPlaying | null>(null);
  const [posMs, setPosMs] = useState(0);
  const npRef = useRef<NowPlaying | null>(null);
  const tickRef = useRef<number>();

  useEffect(() => {
    if (!vyn) return;

    const update = (data: NowPlaying | null) => {
      npRef.current = data;
      setNp(data ? { ...data } : null);
      setPosMs(data?.position_ms ?? 0);
      clearInterval(tickRef.current);
      if (data?.is_playing && (data?.duration_ms ?? 0) > 0) {
        tickRef.current = window.setInterval(() => {
          setPosMs((p) => Math.min(p + 1000, npRef.current?.duration_ms ?? p));
        }, 1000);
      }
    };

    vyn.media
      .nowPlaying()
      .then(update)
      .catch(() => {});
    vyn.media.subscribe(update);
    vyn.lifecycle.onSleep(() => clearInterval(tickRef.current));
    vyn.lifecycle.onWake(() =>
      vyn.media
        .nowPlaying()
        .then(update)
        .catch(() => {}),
    );

    return () => clearInterval(tickRef.current);
  }, [vyn]);

  const hasContent = np && (np.title || np.artist);
  const progress =
    np?.duration_ms && np.duration_ms > 0
      ? Math.min(100, (posMs / np.duration_ms) * 100)
      : 0;

  return (
    <div
      className="h-screen w-screen relative overflow-hidden rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      {/* Artwork as blurred full background */}
      <AnimatePresence>
        {np?.artwork_url && (
          <motion.div
            key={np.artwork_url}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${np.artwork_url.replace(/(\r\n|\n|\r)/gm, "")})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(10px) saturate(110%) brightness(0.4)",
              transform: "scale(1.2)",
            }}
          />
        )}
      </AnimatePresence>
      {/* Dark scrim so text stays legible */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      <AnimatePresence mode="wait">
        {!hasContent ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 h-full flex items-center justify-center gap-2 text-white/25"
          >
            <Music size={13} />
            <span className="text-[9px] font-black uppercase tracking-[0.25em]">
              Ready for music
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 h-full flex items-center gap-3 px-4"
          >
            {/* Artwork thumbnail */}
            <motion.div
              key={np?.artwork_url ?? "no-art"}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex-shrink-0 w-[52px] h-[52px] rounded-xl overflow-hidden border border-white/15 shadow-lg"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              {np?.artwork_url ? (
                <img
                  src={np.artwork_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg">
                  🎵
                </div>
              )}
            </motion.div>

            {/* Info + controls */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {/* Title row + app badge */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={np?.title}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.2 }}
                      className="text-[12px] font-semibold text-white/90 truncate leading-tight"
                    >
                      {np?.title || "—"}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-[10px] text-white/40 truncate mt-0.5">
                    {np?.artist || np?.album || ""}
                  </p>
                </div>
                {np?.app && (
                  <span className="flex-shrink-0 text-[7px] font-black text-white/20 uppercase tracking-wider leading-none mt-1">
                    {shortApp(np.app)}
                  </span>
                )}
              </div>

              {/* Progress bar — gradient */}
              <div className="flex flex-col gap-0.5">
                <div
                  className="h-[3px] rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #7ca8ff 0%, #a78bfa 50%, #f472b6 100%)",
                    }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "linear" }}
                  />
                </div>
                {(np?.duration_ms ?? 0) > 0 && (
                  <div
                    className="flex justify-between text-[8px] tabular-nums"
                    style={{ color: "rgba(255,255,255,0.22)" }}
                  >
                    <span>{fmt(posMs)}</span>
                    <span>{fmt(np!.duration_ms!)}</span>
                  </div>
                )}
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => vyn?.media.previous().catch(() => {})}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  <SkipBack size={11} />
                </button>
                <button
                  onClick={() =>
                    (np?.is_playing
                      ? vyn?.media.pause()
                      : vyn?.media.play()
                    )?.catch(() => {})
                  }
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all shadow-md"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                  }}
                >
                  {np?.is_playing ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button
                  onClick={() => vyn?.media.next().catch(() => {})}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  <SkipForward size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
