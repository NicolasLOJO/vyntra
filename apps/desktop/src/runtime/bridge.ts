/**
 * Injects an optional bootstrap script into each widget iframe via the
 * `vyn:init` message.
 *
 * In practice this is a no-op: widgets already include `vyn-runtime.js`
 * in their archive which self-initialises from the `vyn:init` message.
 * This hook exists as an extension point for future per-widget overrides
 * (e.g. injecting a capability-filtered Vyn proxy).
 */
export function buildBridgeScript(): string {
  return "";
}
