/**
 * Canal RPC widget <-> host Vyntra via postMessage.
 *
 * Le host répond avec `{ id, ok, result } | { id, ok: false, error }`.
 */

export interface Transport {
  call<T = unknown>(method: string, params?: unknown): Promise<T>;
  on(event: string, handler: (payload: unknown) => void): () => void;
}

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

export function createTransport(widgetId: string): Transport {
  let seq = 0;
  const pending = new Map<number, Pending>();
  const listeners = new Map<string, Set<(p: unknown) => void>>();

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "vyn:response" && pending.has(msg.id)) {
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
    } else if (msg.type === "vyn:event" && listeners.has(msg.event)) {
      listeners.get(msg.event)!.forEach((h) => h(msg.payload));
    }
  });

  return {
    call<T>(method: string, params?: unknown): Promise<T> {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        window.parent.postMessage(
          { type: "vyn:call", id, widgetId, method, params },
          "*",
        );
      });
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
  };
}
