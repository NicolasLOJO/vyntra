import { promises as fs } from "node:fs";
import JSZip from "jszip";
import { isValidId, type Manifest } from "@vyntra/widget-types";

export async function validate(args: string[]): Promise<void> {
  const target = args[0];
  if (!target) throw new Error("usage: vyn validate <manifest.json|widget.vyn>");

  if (target.endsWith(".json")) {
    const raw = await fs.readFile(target, "utf8");
    checkManifest(JSON.parse(raw) as Manifest);
    console.log("✓ manifest is valid");
    return;
  }

  if (target.endsWith(".vyn")) {
    const buf = await fs.readFile(target);
    const zip = await JSZip.loadAsync(buf);

    // Required files.
    for (const required of ["manifest.json", "host.html", "bundle.js"]) {
      if (!zip.file(required)) {
        throw new Error(`.vyn is missing required file: ${required}`);
      }
    }

    const manifestRaw = await zip.file("manifest.json")!.async("string");
    checkManifest(JSON.parse(manifestRaw) as Manifest);

    const files = Object.keys(zip.files);
    console.log(`✓ ${target} is valid (${files.length} files)`);
    console.log(`  files: ${files.slice(0, 8).join(", ")}${files.length > 8 ? ", …" : ""}`);
    return;
  }

  throw new Error("target must be a .json or .vyn file");
}

function checkManifest(m: Manifest): void {
  if (m.schema !== 1) throw new Error(`unsupported schema: ${m.schema}`);
  if (!isValidId(m.id)) throw new Error(`invalid id "${m.id}" — must be reverse-DNS (e.g. com.you.widget)`);
  if (!m.name?.trim()) throw new Error("missing name");
  if (!m.version) throw new Error("missing version");
  if (!m.size || m.size.w <= 0 || m.size.h <= 0) throw new Error("invalid size");
}
