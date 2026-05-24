// Vyn runtime — injecté dans chaque widget pour exposer `window.Vyn`.
// Pour l'instant, version inline minimale (système + media + storage).
(function () {
  let widgetId = null;
  let seq = 0;
  const pending = new Map();
  const eventListeners = new Map();

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "vyn:init" && msg.widgetId) {
      widgetId = msg.widgetId;
    } else if (msg.type === "vyn:response" && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
    } else if (msg.type === "vyn:event" && eventListeners.has(msg.event)) {
      eventListeners.get(msg.event).forEach((h) => h(msg.payload));
    }
  });

  function call(method, params) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      window.parent.postMessage(
        { type: "vyn:call", id, widgetId, method, params },
        "*",
      );
    });
  }

  function on(event, handler) {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event).add(handler);
    return () => eventListeners.get(event)?.delete(handler);
  }

  window.Vyn = {
    get widgetId() {
      return widgetId;
    },
    lifecycle: {
      onSleep:       (cb) => on("lifecycle.sleep",       cb),
      onWake:        (cb) => on("lifecycle.wake",        cb),
      onThrottle:    (cb) => on("lifecycle.throttle",    cb),
      onUnthrottle:  (cb) => on("lifecycle.unthrottle",  cb),
    },
    system: {
      snapshot: () => call("system.snapshot"),
      subscribe: (cb) => on("system.tick", cb),
    },
    media: {
      nowPlaying: () => call("media.nowPlaying"),
      play: () => call("media.play"),
      pause: () => call("media.pause"),
      next: () => call("media.next"),
      previous: () => call("media.previous"),
      subscribe: (cb) => on("media.change", cb),
    },
    launcher: {
      apps:    ()       => call("launcher.apps"),
      getIcon: (id)     => call("launcher.getIcon", { id }),
      launch:  (id)     => call("launcher.launch",  { id }),
    },
    storage: {
      get: (key) => call("storage.get", { key }),
      set: (key, value) => call("storage.set", { key, value }),
      delete: (key) => call("storage.delete", { key }),
      keys: () => call("storage.keys"),
    },
    config: {
      getAll: ()          => call("config.getAll"),
      get:    (key)       => call("config.getAll").then((c) => c[key]),
      set:    (key, val)  => call("config.set", { key, value: val }),
      subscribe: (cb)     => on("config.change", cb),
    },
  };
})();
