import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { isValidId, type Manifest } from "@vyntra/widget-types";

export async function pack(args: string[]): Promise<void> {
  const distDir = args[0] ?? "dist";
  const outFile = args[1] ?? "widget.vyn";

  const manifestPath = path.join(distDir, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as Manifest;

  if (!isValidId(manifest.id)) {
    throw new Error(`invalid manifest.id: ${manifest.id}`);
  }

  const zip = new JSZip();
  await addDir(zip, distDir, "");
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(outFile, buf);
  console.log(`✓ packed ${outFile} (${buf.length} bytes)`);
}

async function addDir(zip: JSZip, abs: string, rel: string): Promise<void> {
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries) {
    const absChild = path.join(abs, e.name);
    const relChild = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      await addDir(zip, absChild, relChild);
    } else {
      zip.file(relChild, await fs.readFile(absChild));
    }
  }
}
