#!/usr/bin/env node
/**
 * `vyn` — CLI pour les créateurs de widgets.
 *
 * Sous-commandes:
 *   vyn init <name>     Échafaude un projet widget
 *   vyn build           Bundle JS + assets dans `dist/`
 *   vyn pack            Empaquette `dist/` en `.vyn`
 *   vyn validate <file> Vérifie un manifest ou un `.vyn`
 */

import { init } from "./commands/init.js";
import { build } from "./commands/build.js";
import { pack } from "./commands/pack.js";
import { validate } from "./commands/validate.js";
import { runtime } from "./commands/runtime.js";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "init":
      await init(args);
      break;
    case "build":
      await build(args);
      break;
    case "pack":
      await pack(args);
      break;
    case "runtime":
      await runtime(args);
      break;
    case "validate":
      await validate(args);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`vyn — Vyntra widget toolkit

Commands:
  vyn init <name>     Scaffold a new widget project
  vyn build           Bundle the widget into dist/
  vyn pack            Pack dist/ into a .vyn archive
  vyn runtime [dir]   Copy vyn-runtime.js into a directory (e.g. public/)
  vyn validate <p>    Validate a manifest.json or .vyn file
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
