import type { Transport } from "./transport";

export type BlurMaterial = "mica" | "acrylic" | "none";

export interface VynUi {
  /** Demande au host d'appliquer un matériau de flou natif au cadre du widget. */
  setBlur(material: BlurMaterial): Promise<void>;
  /** Notifie le host qu'on entre/sort d'une zone interactive (pour la souris). */
  setInteractive(zone: { x: number; y: number; w: number; h: number } | null): Promise<void>;
}

export function createUi(t: Transport): VynUi {
  return {
    setBlur: (m) => t.call("ui.setBlur", { material: m }),
    setInteractive: (zone) => t.call("ui.setInteractive", { zone }),
  };
}
