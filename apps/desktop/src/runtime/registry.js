/**
 * Associe chaque contentWindow d'iframe à son widgetId autorisé.
 * Le dispatcher lit cette map plutôt que de faire confiance au msg.widgetId
 * fourni par le widget lui-même — empêche l'usurpation d'identité inter-widget.
 *
 * WeakMap : quand l'iframe est retirée du DOM et son Window GC'd,
 * l'entrée disparaît automatiquement.
 */
const registry = new WeakMap();
export function registerWidget(win, widgetId) {
    registry.set(win, widgetId);
}
export function unregisterWidget(win) {
    registry.delete(win);
}
/** Retourne le widgetId lié à cette fenêtre source, ou undefined si inconnue. */
export function resolveWidgetId(win) {
    return registry.get(win);
}
