/**
 * Vyntra SDK — `window.Vyn`
 *
 * Module injecté dans chaque widget. Toutes les méthodes passent par le
 * pont `postMessage` vers le host Vyntra, qui valide les capabilities
 * avant d'exécuter l'appel IPC Tauri correspondant.
 */

import { createMedia, type VynMedia } from "./media";
import { createSystem, type VynSystem } from "./system";
import { createLauncher, type VynLauncher } from "./launcher";
import { createStorage, type VynStorage } from "./storage";
import { createUi, type VynUi } from "./ui";
import { createTransport, type Transport } from "./transport";

export interface Vyn {
  /** ID du widget courant (depuis manifest). */
  readonly widgetId: string;
  readonly media: VynMedia;
  readonly system: VynSystem;
  readonly launcher: VynLauncher;
  readonly storage: VynStorage;
  readonly ui: VynUi;
}

declare global {
  interface Window {
    Vyn: Vyn;
  }
}

export function install(widgetId: string): Vyn {
  const transport: Transport = createTransport(widgetId);
  const vyn: Vyn = {
    widgetId,
    media: createMedia(transport),
    system: createSystem(transport),
    launcher: createLauncher(transport),
    storage: createStorage(transport),
    ui: createUi(transport),
  };
  window.Vyn = vyn;
  return vyn;
}

export type { VynMedia, VynSystem, VynLauncher, VynStorage, VynUi };
