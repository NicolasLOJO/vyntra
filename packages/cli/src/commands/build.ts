/**
 * `vyn build` — pour l'instant, copie simplement les sources dans dist/.
 * À terme: esbuild/rollup avec tree-shaking, minification, et injection du
 * SDK bootstrap.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export async function build(_args: string[]): Promise<void> {
  const src = "src";
  const dist = "dist";
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
  await copyRecursive(src, dist);
  await fs.copyFile("manifest.json", path.join(dist, "manifest.json"));
  console.log("✓ build complete");
}

async function copyRecursive(src: string, dst: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dst, { recursive: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyRecursive(s, d);
    else await fs.copyFile(s, d);
  }
}
