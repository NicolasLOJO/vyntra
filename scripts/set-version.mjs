#!/usr/bin/env node
/**
 * Usage: node scripts/set-version.mjs 1.2.3
 * Updates version in tauri.conf.json, desktop Cargo.toml, and root package.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node scripts/set-version.mjs <semver>  (e.g. 1.2.3)");
  process.exit(1);
}

function updateJson(relPath, updater) {
  const abs = resolve(root, relPath);
  const obj = JSON.parse(readFileSync(abs, "utf8"));
  updater(obj);
  writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n");
  console.log(`✓  ${relPath}`);
}

function updateToml(relPath) {
  const abs = resolve(root, relPath);
  const updated = readFileSync(abs, "utf8").replace(
    /^version = ".*?"/m,
    `version = "${version}"`
  );
  writeFileSync(abs, updated);
  console.log(`✓  ${relPath}`);
}

updateJson("apps/desktop/src-tauri/tauri.conf.json", (c) => { c.version = version; });
updateJson("package.json",                            (c) => { c.version = version; });
updateJson("apps/desktop/package.json",               (c) => { c.version = version; });
updateToml("apps/desktop/src-tauri/Cargo.toml");

console.log(`\nVersion set to ${version}. Commit and tag with: git tag v${version}`);
