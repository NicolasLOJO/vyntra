import type { Transport } from "./transport";

export interface InstalledApp {
  id: string;
  name: string;
  /** Icône en data-URL (WebP). */
  icon: string | null;
}

export interface VynLauncher {
  listApps(): Promise<InstalledApp[]>;
  launch(appId: string): Promise<void>;
}

export function createLauncher(t: Transport): VynLauncher {
  return {
    listApps: () => t.call("launcher.list"),
    launch: (id) => t.call("launcher.launch", { id }),
  };
}
