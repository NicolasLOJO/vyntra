import { useEffect, useRef } from "react";
import type { WidgetSummary } from "../core/types";
import { buildBridgeScript } from "./bridge";

interface Props {
  widget: WidgetSummary;
}

/**
 * Charge un widget tiers dans un iframe sandboxé.
 *
 * Stratégie:
 * - L'iframe pointe sur `vyntra://<id>/__host__.html` (généré par le runtime).
 * - Le pont `window.Vyn` est injecté via `postMessage` après load.
 * - Le Shadow DOM est utilisé côté widget pour isoler CSS.
 *
 * À terme on pourra mutualiser tous les widgets dans une seule WebView sans
 * iframes (Shadow DOM only) — l'iframe sert ici de barrière de sécurité forte
 * et de garde-fou en attendant que l'audit de sécurité statique soit en place.
 */
export function WidgetHost({ widget }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const onLoad = () => {
      iframe.contentWindow?.postMessage(
        { type: "vyn:init", widgetId: widget.id, bridge: buildBridgeScript() },
        "*",
      );
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [widget.id]);

  return (
    <iframe
      ref={ref}
      title={widget.name}
      src={`vyntra://${widget.id}/host.html`}
      sandbox="allow-scripts"
      className="vyntra-widget-frame"
    />
  );
}
