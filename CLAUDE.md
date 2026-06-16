# CLAUDE.md

Contexte pour reprendre le développement de **Vyntra** avec Claude dans une nouvelle conversation, un projet Anthropic, ou via Claude Code.

---

## Le projet

**Vyntra** est une plateforme de widgets desktop modulaires pour Windows (puis macOS/Linux), construite avec **Tauri v2 + React**. L'objectif est d'offrir une alternative légère et flexible aux widgets natifs Microsoft et à Rainmeter, avec un format de widget propriétaire `.vyn`, une sandbox basée sur capabilities, et une architecture single-WebView pour minimiser la consommation RAM.

Cible de perf : < 120 Mo RAM pour le runtime + widgets. La WebView est unique (pas un Chromium par widget comme Electron).

## Architecture (état actuel)

```
vyntra/
├── apps/desktop/                   # Application Tauri principale
│   ├── src/                        # Front React (TS, Vite)
│   │   ├── core/                   # Surface, Grid, types
│   │   ├── runtime/                # WidgetHost (iframe), dispatcher IPC, registry, bridge
│   │   ├── shell/sections/         # Widgets/Store/Settings/About
│   │   ├── manager/                # Page autonome de la fenêtre Manager
│   │   ├── ui/                     # CSS global + manager.css
│   │   ├── main.tsx                # Entry: Surface (overlay desktop)
│   │   └── manager.tsx             # Entry: Manager (2e fenêtre)
│   ├── src-tauri/                  # Backend Rust
│   │   ├── src/
│   │   │   ├── ipc/                # 27 commandes Tauri (widgets, system, media, storage,
│   │   │   │                       #   layout, ui, guard, config, settings, shortcuts,
│   │   │   │                       #   launcher, update)
│   │   │   ├── persistence/        # JSON store atomique (layout + storage + widget_state
│   │   │   │                       #   + settings + widget_config)
│   │   │   ├── protocol/           # Handler vyntra:// (cross-OS)
│   │   │   ├── tray/               # Tray icon + menu (Manager / Edit / Now Playing / Quit)
│   │   │   ├── window/             # Manager on-demand + surfaces secondaires + hit-test thread
│   │   │   ├── vault/              # Install/uninstall .vyn + bootstrap_bundled
│   │   │   ├── watchdog/           # Fullscreen detect + CPU throttle + kill switch
│   │   │   ├── state.rs            # AppState (DashMap widgets + store + edit_mode)
│   │   │   ├── system/mod.rs       # CPU/RAM/Disk/GPU snapshot (sysinfo + DXGI)
│   │   │   ├── media/mod.rs        # SMTC Windows (tokio watch, artwork cache)
│   │   │   ├── launcher/mod.rs     # Get-StartApps + .lnk fallback + UWP icons (PIDL)
│   │   │   └── lib.rs              # Init + invoke_handler! (27 cmds)
│   │   ├── widgets-bundled/        # .vyn embarqués (générés par pack-examples.mjs)
│   │   ├── icons/
│   │   ├── capabilities/default.json
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   ├── index.html, manager.html
│   └── vite.config.ts              # Multi-entry (index + manager)
├── packages/
│   ├── sdk/                        # window.Vyn TypeScript SDK (transport, modules)
│   ├── widget-types/               # Types miroirs du schéma Rust (Manifest, etc.)
│   └── cli/                        # `vyn` CLI — init/build(esbuild)/pack/validate
│       └── assets/vyn-runtime.js   # Runtime injecté automatiquement par vyn build
├── widgets/                        # Widgets "modern" React+Tailwind (bundlés dans l'app)
│   ├── clock-modern/
│   ├── cpu-modern/                 # CPU + RAM + GPU + Disques
│   ├── notes-modern/
│   ├── pomodoro-modern/
│   ├── launcher-modern/
│   ├── media-modern/
│   └── shared/index.ts             # useVyn() hook React
├── crates/
│   ├── vyn-manifest/               # Schéma manifest.json + validation
│   ├── vyn-format/                 # Parse/lecture .vyn
│   └── vyn-sandbox/                # Check capabilities + génération CSP
├── widgets-examples/               # Widgets vanilla JS (démo)
│   ├── _shared/vyn-runtime.js      # Runtime SDK standalone
│   ├── clock/, cpu/, notes/
├── docs/
│   └── widget-developer-guide.md  # Guide complet pour créateurs de widgets
├── scripts/pack-examples.mjs       # Pack les widgets en .vyn dans widgets-bundled/
├── Cargo.toml                      # Workspace racine
├── pnpm-workspace.yaml
└── package.json                    # `pnpm dev` = pack:examples + tauri dev
```

## Concepts clés

### Format `.vyn`
Archive ZIP contenant au minimum `manifest.json`, `host.html`, `bundle.js`, `vyn-runtime.js`.
`vyn-runtime.js` est injecté automatiquement par `vyn build` (CLI) et par `pack-examples.mjs`.

### Manifest
```json
{
  "schema": 1,
  "id": "com.author.widget",
  "name": "Widget Name",
  "version": "0.1.0",
  "author": { "name": "..." },
  "size": { "w": 4, "h": 2 },
  "permissions": { "system": true },
  "interactive": false,
  "config": {
    "city": { "type": "string", "label": "City", "default": "Paris" }
  }
}
```

### Protocole `vyntra://`
Sert les fichiers depuis l'archive `.vyn` en mémoire. Sur Windows, WebView2 réécrit en `http://vyntra.localhost/<id>/<asset>`. Le handler dans `protocol/mod.rs` gère les 3 OS.

### Dispatcher IPC (`runtime/dispatcher.ts`)
Centre nerveux côté front. Reçoit les `postMessage { type: "vyn:call" }` des iframes, résout le `widgetId` depuis le registry (pas depuis le message — anti-usurpation), pre-check capabilities, appelle `invoke()` Tauri, retourne `{ type: "vyn:response" }`. Map complète des 16 méthodes Vyn.* → commandes Tauri.

### Registry (`runtime/registry.ts`)
`WeakMap<Window, widgetId>` — peuplé à la création de chaque iframe, lu par le dispatcher. Empêche l'usurpation d'identité inter-widget.

### `vyn-runtime.js` vs SDK TypeScript
- **`vyn-runtime.js`** (vanilla) : script standalone injecté dans l'iframe via `<script src="vyn-runtime.js">`. Écoute `vyn:init` pour récupérer le widgetId, expose `window.Vyn` synchroniquement. Utilisé par tous les widgets actuels (vanilla et React).
- **`packages/sdk`** (TypeScript) : API typée pour les devs qui veulent types + IDE. Exporte `install(widgetId)`. À appeler manuellement si le widget n'utilise pas `vyn-runtime.js`.
- **`widgets/shared/useVyn()`** : hook React qui retourne `window.Vyn` dès qu'il est disponible (poll 100ms fallback, en pratique synchrone).

### Persistance
JSON dans `%LOCALAPPDATA%\com.vyntra.desktop\state.json` (atomique tmp+rename). Stocke :
- `layout` : positions/tailles (debounced 400ms)
- `storage` : K/V par widget id
- `widget_state` : `{ visible, display_name, monitor }`
- `settings` : `AppSettings` (autostart, sleep_on_fullscreen, cpu_throttle_threshold, edit_mode_shortcut)
- `widget_config` : champs configurables par widget (schema déclaré dans manifest)

### Click-through
Thread Windows (`window::spawn_hit_test()`) poll `GetCursorPos` toutes les 16ms. Compare avec les hit-rects envoyés par le front via `set_hit_rects`. Appelle `set_ignore_cursor_events` par fenêtre surface. En mode Edit : toujours interactif. Widgets avec `"interactive": false` dans manifest ne génèrent pas de hit-rect.

### Tray
- Clic gauche → Open Manager
- Menu : Open Manager / **Edit mode** (CheckMenuItem) / **Now Playing** (info, rebuild à chaque changement media) / Quit

### Manager window
Créée à la demande (`window::open_manager()`), économise ~35 Mo RAM quand fermée. 4 onglets : **Widgets** (list/toggle/install/config panel), **Store** (catalog depuis `/catalog.json`), **Settings** (autostart Windows Registry, shortcut, throttle, fullscreen), **About** (check update via tauri-plugin-updater).

### Multi-monitor
`window::spawn_surfaces()` crée `vyntra-surface-{i}` pour les écrans secondaires. Chaque surface filtre les widgets par `LayoutEntry.monitor`. Le reassign se fait via le config panel du widget dans le Manager.

### Watchdog
Thread actif : fullscreen detect (`SHQueryUserNotificationState`), CPU throttle (émet `widget://throttle` / `widget://unthrottle`), kill switch (émet `widget://sleep`). Lit `AppSettings` à chaque tick.

## Commandes IPC enregistrées (27)

```
widgets:    list_widgets, install_widget, install_widget_bytes, uninstall_widget,
            set_widget_visible, rename_widget, set_widget_monitor
system:     snapshot  (cpu_pct, ram, disks[], gpu?)
media:      get_now_playing, media_play, media_pause, media_next, media_previous
ui:         set_edit_mode, get_monitor_count, set_hit_rects, get_window_outer_position
layout:     load_layout, save_layout
storage:    storage_get, storage_set, storage_delete, storage_keys
config:     widget_config_get_all, widget_config_set
settings:   get_settings, set_settings
shortcuts:  set_edit_shortcut
launcher:   launcher_apps, launcher_get_icon, launcher_launch
update:     check_update, install_update
```

## Widgets bundlés (tous fonctionnels)

| Widget | Permissions | Taille | Notes |
|---|---|---|---|
| clock-modern | aucune | 3×2 | Glass, heure + date |
| cpu-modern | `system` | 4×5 | CPU + RAM + GPU VRAM + disques (amber si >85%) |
| notes-modern | `storage` | 4×4 | Auto-save 600ms debounce |
| pomodoro-modern | `storage` | 4×4 | Config: durées + couleur ; sessions persistées |
| launcher-modern | `launcher` | 6×5 | Grid apps, icônes UWP+Win32, search |
| media-modern | `media` | 6×2 | SMTC, artwork, controls |

## Conventions de code

### Rust
- `parking_lot` pour les locks sync, `tokio` pour l'async
- `tracing` pour les logs (`RUST_LOG=debug pnpm dev`)
- `thiserror` pour les erreurs internes, `anyhow` pour les flows applicatifs
- `app.path()` pour les chemins (pas `dirs`)
- Tauri v2 : importer explicitement `Manager`, `Emitter` pour `.state()` / `.emit()`
- Windows-sys 0.52 : bindings C Win32 bruts. Windows 0.61 : WinRT/COM safe (`Interface` trait à importer explicitement pour `.cast::<T>()`)

### TypeScript
- Strict mode partout
- React 18, hooks only
- `react-grid-layout` avec `WidthProvider`
- État global : props + hooks, pas de Redux/Zustand
- IPC : `invoke<T>("cmd", args)` avec types miroirs des structs Rust

### Style widgets
Glass morphism baseline sur le div racine (inline style) :
```tsx
style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px) saturate(160%)" }}
className="h-screen w-screen relative overflow-hidden rounded-2xl"
```
`.vyntra-cell` est nu (juste `width/height: 100%`), le fond vit dans chaque widget.

### Perf widgets
- `useVyn()` : poll 100ms (window.Vyn déjà set synchroniquement en pratique)
- Pas de mousemove listeners dans les widgets
- Animations infinies : CSS `@keyframes` uniquement (pas Framer Motion `repeat:Infinity`)
- Fetch d'icônes : `Promise.allSettled` → une seule mise à jour d'état

### Build pipeline
- `pnpm dev` = `pack:examples` + `tauri dev`
- `build.rs` crée des stubs `.vyn` vides si manquants
- Vite multi-entry : `index.html` (surface) + `manager.html` (manager)
- Cargo.toml : `version = "0.1.0"` explicite dans `apps/desktop/src-tauri` (pas workspace)

### CLI (`vyn`)
```bash
vyn init <name>     # scaffold src/index.js + host.html + manifest.json
vyn build           # esbuild src/index.ts|js → dist/bundle.js + inject vyn-runtime.js
vyn pack            # zip dist/ → widget.vyn
vyn runtime [dir]   # copie vyn-runtime.js dans un dossier (ex: public/)
vyn validate <f>    # valide manifest.json ou .vyn
```
`packages/cli/assets/vyn-runtime.js` = copie du runtime, injectée automatiquement par `vyn build` ou exportable via `vyn runtime`.

## Debug

- DevTools surface : auto en `#[cfg(debug_assertions)]`
- DevTools manager : F12
- State JSON : `%LOCALAPPDATA%\com.vyntra.desktop\state.json` — supprimer = reset
- Tester capabilities : retirer `"permissions": { "system": true }` du manifest → erreur dans le widget

## TODOs pour la beta (par priorité)

### 🔴 Bloquants production
1. **Installer Windows** — configurer NSIS/MSI dans `tauri.conf.json` + `tauri build`
2. **Update server** — remplacer `REPLACE_WITH_REAL_MINISIGN_PUBKEY` dans `tauri.conf.json`, héberger endpoint (GitHub Releases suffit)

### 🟡 Importants
3. **Mica/Acrylic** — effet Windows 11 sur la surface via `DwmSetWindowAttribute`
4. **Code signing** — certificat EV pour éviter SmartScreen

### 🟢 Post-beta
5. **MPRIS Linux** — media sur Linux
6. **macOS LaunchAgent** — autostart (stub en place)
7. **Store API réelle** — remplacer `/catalog.json` statique par une API Vyntra hébergée
8. **SQLite** — migrer `state.json` quand le volume justifiera

## Modèle économique

- Marketplace : commission 15% sur widgets premium
- VIP : 2,99€/mois ou 24,99€/an (cloud sync, thèmes exclusifs)
- Certification créateur : audit sécurité + badge "Vérifié"
- Objectif An 3 : 4,5M MAU, ~9,5M USD ARR

## Comment travailler avec Claude

1. **Pair programming** : réponses brèves, pas besoin d'expliquer chaque ligne
2. **Toujours rebuild Rust** après modif `.rs` (`Ctrl+C` puis `pnpm dev`)
3. **Vite hot-reload** pour `.tsx` / `.ts` / `.css`
4. Quand on ajoute une commande IPC : `invoke_handler!` + dispatcher front + `capabilities/default.json`
5. Quand on ajoute un widget bundlé : dossier `widgets/`, `include_bytes!` dans `vault/mod.rs`, nom dans `build.rs`
6. Quand on modifie `system::SystemSnapshot` : mettre à jour aussi le type TS dans le widget qui l'utilise

## Liens utiles

- Tauri v2 docs : https://v2.tauri.app/
- Guide développeur widgets : `docs/widget-developer-guide.md`
- Specs originales : `Spécifications_Stratégiques_Vyntra.txt`
