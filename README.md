# Vyntra

Plateforme de widgets desktop modulaires (Tauri v2 + React).

## Structure

```
apps/desktop/        Application Tauri (front React + backend Rust)
packages/sdk/        SDK JS (window.Vyn) injecté dans les widgets
packages/widget-types/  Types TS partagés (miroir du schéma Rust)
packages/cli/        Outil `vyn` (init, build, pack, validate)
crates/vyn-manifest/ Schéma manifest.json + validation
crates/vyn-format/   Lecture/écriture du format .vyn (zip)
crates/vyn-sandbox/  Vérif capabilities + génération CSP
```

## Setup

Prérequis : Node 20+, pnpm 9+, Rust stable, toolchain Tauri (https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm dev        # lance Tauri en mode dev
pnpm build      # build de prod
```

## Modules backend

- `protocol/`  — handler `vyntra://<id>/<path>`, sert les assets depuis l'archive `.vyn`
- `watchdog/`  — poll des ressources, kill switch, throttle / sleep
- `vault/`     — install/uninstall des widgets
- `system/`    — snapshot CPU/RAM (sysinfo)
- `media/`     — stub multi-OS (SMTC/MPRIS/NowPlaying à brancher)
- `ipc/`       — commandes Tauri exposées au front

## Capabilities

Les widgets déclarent leurs permissions dans `manifest.json` :

```json
{
  "permissions": {
    "system": true,
    "network": true
  },
  "network": { "allow": ["api.example.com"] }
}
```

`vyn-sandbox::check()` est appelé avant chaque commande IPC pour valider.
Le CSP de la WebView widget est construit dynamiquement depuis `network.allow`.
