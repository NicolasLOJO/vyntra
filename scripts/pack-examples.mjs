#!/usr/bin/env node
/**
 * Pack tous les widgets en `.vyn` dans `apps/desktop/src-tauri/widgets-bundled/`.
 * 
 * Supporte :
 * 1. Legacy widgets (HTML/JS) dans `widgets-examples/`
 * 2. Modern widgets (React/Vite) dans `widgets/`
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "apps/desktop/src-tauri/widgets-bundled");

async function packDir(dir, outFile, sharedFiles = []) {
  const zip = new JSZip();
  await addRecursive(zip, dir, "");
  // Injecte les fichiers partagés (legacy seulement)
  for (const [name, content] of sharedFiles) {
    zip.file(name, content);
  }
  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await fs.writeFile(outFile, buf);
  return buf.length;
}

async function addRecursive(zip, abs, rel) {
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries) {
    const absChild = path.join(abs, e.name);
    const relChild = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await addRecursive(zip, absChild, relChild);
    else zip.file(relChild, await fs.readFile(absChild));
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // 1. Pack Legacy Examples
  // const LEGACY_SRC = path.join(ROOT, "widgets-examples");
  // const sharedDir = path.join(LEGACY_SRC, "_shared");
  const shared = [];
  /* try {
    const files = await fs.readdir(sharedDir);
    for (const f of files) {
      shared.push([f, await fs.readFile(path.join(sharedDir, f))]);
    }
  } catch {}

  const legacyDirs = await fs.readdir(LEGACY_SRC, { withFileTypes: true });
  for (const d of legacyDirs) {
    if (!d.isDirectory() || d.name.startsWith("_")) continue;
    const manifest = path.join(LEGACY_SRC, d.name, "manifest.json");
    try {
      await fs.access(manifest);
      const out = path.join(OUT, `${d.name}.vyn`);
      const size = await packDir(path.join(LEGACY_SRC, d.name), out, shared);
      console.log(`✓ legacy: ${d.name}.vyn (${size} bytes)`);
    } catch {}
  } */

  // 2. Pack Modern Widgets
  const MODERN_SRC = path.join(ROOT, "widgets");
  try {
    const modernDirs = await fs.readdir(MODERN_SRC, { withFileTypes: true });
    for (const d of modernDirs) {
      if (!d.isDirectory() || d.name === "shared") continue;
      
      const dir = path.join(MODERN_SRC, d.name);
      const pkgPath = path.join(dir, "package.json");
      
      try {
        await fs.access(pkgPath);
        console.log(`build modern: ${d.name}...`);
        
        // Build the widget
        execSync("pnpm build", { cwd: dir, stdio: "inherit" });
        
        const distDir = path.join(dir, "dist");
        
        // Copy the common runtime into the dist folder
        const runtimeSrc = path.join(ROOT, "widgets-examples", "_shared", "vyn-runtime.js");
        const runtimeDest = path.join(distDir, "vyn-runtime.js");
        await fs.copyFile(runtimeSrc, runtimeDest);

        // Vyntra expects host.html, but Vite generates index.html
        const indexHtml = path.join(distDir, "index.html");
        const hostHtml = path.join(distDir, "host.html");
        try {
          await fs.access(indexHtml);
          await fs.rename(indexHtml, hostHtml);
        } catch {}

        const manifestSrc = path.join(dir, "manifest.json");
        const manifestDest = path.join(distDir, "manifest.json");
        
        // Copy manifest to dist if not there
        try { await fs.access(manifestDest); }
        catch { await fs.copyFile(manifestSrc, manifestDest); }
        
        const out = path.join(OUT, `${d.name}.vyn`);
        const size = await packDir(distDir, out);
        console.log(`✓ modern: ${d.name}.vyn (${size} bytes)`);
      } catch (e) {
        console.warn(`skip modern ${d.name}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn("no modern widgets directory found");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
