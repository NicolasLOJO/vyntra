import { useEffect, useState } from "react";

/**
 * Hook to access the Vyntra API.
 * Assumes vyn-runtime.js is loaded via a script tag before the React bundle.
 * In normal operation window.Vyn is already set synchronously, so the
 * interval never fires. The 100ms fallback covers edge-case timing only.
 */
export function useVyn() {
  const [vyn, setVyn] = useState<any>(() => (window as any).Vyn ?? null);

  useEffect(() => {
    if ((window as any).Vyn) return;

    const timer = setInterval(() => {
      if ((window as any).Vyn) {
        setVyn((window as any).Vyn);
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return vyn;
}
