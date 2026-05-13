import type { Transport } from "./transport";

/**
 * Storage isolé par `widget.id` (clé/valeur JSON-sérialisable).
 * Persiste entre les sessions. Capacité: `permissions.storage`.
 */
export interface VynStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function createStorage(t: Transport): VynStorage {
  return {
    get: (k) => t.call("storage.get", { key: k }),
    set: (k, v) => t.call("storage.set", { key: k, value: v }),
    delete: (k) => t.call("storage.delete", { key: k }),
    keys: () => t.call("storage.keys"),
  };
}
