/**
 * Construit le bootstrap injecté dans chaque iframe widget.
 *
 * Le vrai pont `window.Vyn` vit dans `@vyntra/sdk`. Ce module se contente
 * d'écrire le code d'init et d'établir le canal `postMessage` <-> IPC Tauri.
 */
export function buildBridgeScript(): string {
  // Stub: à étoffer quand le SDK exposera les modules.
  return `
    (function () {
      window.addEventListener('message', (e) => {
        // TODO: dispatcher vers les méthodes Vyn.*
      });
    })();
  `;
}
