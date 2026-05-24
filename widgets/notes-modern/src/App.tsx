import { useState, useEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";
import { useVyn } from "@vyntra/widget-shared";

type SaveState = "idle" | "typing" | "saving" | "saved" | "error";

export default function App() {
  const vyn = useVyn();
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<number>();
  const savedTimer = useRef<number>();
  const dirty = useRef(false);

  useEffect(() => {
    return () => { clearTimeout(saveTimer.current); clearTimeout(savedTimer.current); };
  }, []);

  useEffect(() => {
    if (!vyn) return;
    setSaveState("saving");
    vyn.storage
      .get("content")
      .then((val: unknown) => {
        if (typeof val === "string") setContent(val);
        setSaveState("idle");
      })
      .catch(() => setSaveState("error"));
  }, [vyn]);

  const save = async (val: string) => {
    if (!vyn) return;
    setSaveState("saving");
    try {
      await vyn.storage.set("content", val);
      dirty.current = false;
      setSaveState("saved");
      clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => { if (!dirty.current) setSaveState("idle"); }, 1500);
    } catch {
      setSaveState("error");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    dirty.current = true;
    setSaveState("typing");
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => save(val), 600);
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden rounded-2xl flex flex-col px-3.5 py-3 gap-2" style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px) saturate(160%)" }}>
      {/* Very subtle warm hint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.05) 0%, transparent 55%)" }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">
          Notes
        </span>
        <div className="text-[8px] font-bold uppercase tracking-[0.12em] flex items-center gap-1 h-4 min-w-0">
          {saveState === "typing" && (
            <span className="text-white/22">typing…</span>
          )}
          {saveState === "saving" && (
            <span className="flex items-center gap-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              <Loader2 size={7} className="animate-spin" />
              saving
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1" style={{ color: "rgba(52,211,153,0.55)" }}>
              <Check size={7} />
              saved
            </span>
          )}
          {saveState === "error" && (
            <span style={{ color: "rgba(248,113,113,0.55)" }}>error</span>
          )}
        </div>
      </div>

      {/* Textarea — fills remaining space */}
      <textarea
        className="relative z-10 flex-1 min-h-0 rounded-xl text-white/75 placeholder-white/15 text-[12px] leading-relaxed font-light resize-none outline-none px-2.5 py-2 transition-colors duration-200"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.055)";
          e.currentTarget.style.borderColor = "rgba(120,160,255,0.22)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        }}
        placeholder="Write something down…"
        value={content}
        onChange={handleChange}
        spellCheck={false}
      />
    </div>
  );
}
