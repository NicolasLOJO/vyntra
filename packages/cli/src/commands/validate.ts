import { promises as fs } from "node:fs";
import { isValidId, type Manifest } from "@vyntra/widget-types";

export async function validate(args: string[]): Promise<void> {
  const target = args[0];
  if (!target) throw new Error("usage: vyn validate <manifest.json|widget.vyn>");

  if (target.endsWith(".json")) {
    const raw = await fs.readFile(target, "utf8");
    const m = JSON.parse(raw) as Manifest;
    checkManifest(m);
    console.log("✓ manifest is valid");
    return;
  }

  // TODO: décompresser .vyn et valider en mémoire (utiliser jszip).
  throw new Error(".vyn validation not yet implemented");
}

function checkManifest(m: Manifest): void {
  if (m.schema !== 1) throw new Error(`unsupported schema: ${m.schema}`);
  if (!isValidId(m.id)) throw new Error(`invalid id: ${m.id}`);
  if (!m.name?.trim()) throw new Error("missing name");
  if (!m.version) throw new Error("missing version");
  if (!m.size || m.size.w <= 0 || m.size.h <= 0) throw new Error("invalid size");
}
