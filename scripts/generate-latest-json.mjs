#!/usr/bin/env node
/**
 * Usage: node scripts/generate-latest-json.mjs <version> <tag> <sig-file> <zip-name> <repo>
 * Generates latest.json for the Tauri updater endpoint.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [version, tag, sigFile, zipName, repo] = process.argv.slice(2);

if (!version || !tag || !sigFile || !zipName || !repo) {
  console.error("Usage: generate-latest-json.mjs <version> <tag> <sig-file> <zip-name> <repo>");
  process.exit(1);
}

const signature = readFileSync(sigFile, "utf8").trim();

const json = {
  version,
  notes: "",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repo}/releases/download/${tag}/${zipName}`,
    },
  },
};

writeFileSync("latest.json", JSON.stringify(json, null, 2) + "\n");
console.log("Generated latest.json for", version);
