/**
 * Associe chaque contentWindow d'iframe à son widgetId autorisé.
 * Le dispatcher lit cette map plutôt que de faire confiance au msg.widgetId
 * fourni par le widget lui-même — empêche l'usurpation d'identité inter-widget.
 *
 * WeakMap : quand l'iframe est retirée du DOM et son Window GC'd,
 * l'entrée disparaît automatiquement.
 */
const registry = new WeakMap<Window, string>();

export function registerWidget(win: Window, widgetId: string): void {
  registry.set(win, widgetId);
}

export function unregisterWidget(win: Window): void {
  registry.delete(win);
}

/** Retourne le widgetId lié à cette fenêtre source, ou undefined si inconnue. */
export function resolveWidgetId(win: Window): string | undefined {
  return registry.get(win);
}
