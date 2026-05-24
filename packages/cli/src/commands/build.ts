/**
 * `vyn build` — bundles a widget's source into dist/.
 *
 * Entry detection (in order):
 *   src/index.ts  → TypeScript (esbuild)
 *   src/index.js  → JavaScript (esbuild)
 *   src/bundle.js → pre-bundled, copied as-is
 *
 * Outputs:
 *   dist/bundle.js      — bundled widget code
 *   dist/host.html      — copied from root host.html
 *   dist/manifest.json  — copied from root manifest.json
 *   dist/vyn-runtime.js — Vyntra runtime (window.Vyn)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vyn-runtime.js ships alongside the CLI (assets/ directory).
const RUNTIME_ASSET = path.resolve(__dirname, "../../assets/vyn-runtime.js");

export async function build(_args: string[]): Promise<void> {
  await fs.rm("dist", { recursive: true, force: true });
  await fs.mkdir("dist", { recursive: true });

  // ── Bundle JS ──────────────────────────────────────────────────────────────
  const entry = await detectEntry();

  if (entry.type === "esbuild") {
    await esbuild.build({
      entryPoints: [entry.path],
      bundle: true,
      outfile: "dist/bundle.js",
      format: "iife",
      minify: true,
      // Target WebView2 (Chromium 108+) and modern Safari/Firefox.
      target: ["chrome108", "firefox115", "safari16"],
      logLevel: "warning",
    });
    console.log(`  bundled  ${entry.path} → dist/bundle.js`);
  } else {
    await fs.copyFile(entry.path, "dist/bundle.js");
    console.log(`  copied   ${entry.path} → dist/bundle.js`);
  }

  // ── Copy static files ──────────────────────────────────────────────────────
  for (const file of ["host.html", "manifest.json"]) {
    await fs.copyFile(file, path.join("dist", file));
    console.log(`  copied   ${file} → dist/${file}`);
  }

  // Copy any extra assets (images, fonts) from src/assets/ if present.
  const srcAssets = "src/assets";
  if (await exists(srcAssets)) {
    await copyRecursive(srcAssets, "dist/assets");
    console.log(`  copied   src/assets/ → dist/assets/`);
  }

  // ── Inject vyn-runtime.js ─────────────────────────────────────────────────
  if (await exists(RUNTIME_ASSET)) {
    await fs.copyFile(RUNTIME_ASSET, "dist/vyn-runtime.js");
    console.log(`  injected vyn-runtime.js`);
  } else {
    // Fallback: try the monorepo location for local development.
    const fallback = path.resolve(
      __dirname,
      "../../../../widgets-examples/_shared/vyn-runtime.js",
    );
    if (await exists(fallback)) {
      await fs.copyFile(fallback, "dist/vyn-runtime.js");
      console.log(`  injected vyn-runtime.js (monorepo fallback)`);
    } else {
      console.warn(
        "  warning: vyn-runtime.js not found — widgets won't have access to window.Vyn",
      );
    }
  }

  console.log("✓ build complete");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type EntrySpec =
  | { type: "esbuild"; path: string }
  | { type: "copy"; path: string };

async function detectEntry(): Promise<EntrySpec> {
  for (const p of ["src/index.ts", "src/index.js"]) {
    if (await exists(p)) return { type: "esbuild", path: p };
  }
  if (await exists("src/bundle.js")) {
    return { type: "copy", path: "src/bundle.js" };
  }
  throw new Error(
    "No entry point found. Create src/index.ts, src/index.js, or src/bundle.js.",
  );
}

async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true, () => false);
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
