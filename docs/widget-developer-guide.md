# Vyntra Widget Developer Guide

Build desktop widgets with plain HTML/JS or any framework (React, Vue, Svelte…).

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (or npm / yarn)
- **Vyntra** installed on Windows

Install the CLI:

```bash
npm install -g @vyntra/cli
# or, in the monorepo:
pnpm --filter @vyntra/cli build
```

---

## Quick start — vanilla widget

```bash
vyn init my-clock
cd my-clock
# Edit src/index.js
vyn build
vyn pack
```

Drag `widget.vyn` onto the **Manager** window to install.

---

## Project structure

After `vyn init my-clock` you get:

```
my-clock/
├── manifest.json   ← widget metadata & permissions
├── host.html       ← iframe entry point
└── src/
    └── index.js    ← your widget code
```

After `vyn build`:

```
dist/
├── bundle.js       ← bundled + minified
├── host.html
├── manifest.json
└── vyn-runtime.js  ← Vyntra API (injected automatically)
```

---

## manifest.json

```json
{
  "schema": 1,
  "id": "com.yourname.my-clock",
  "name": "My Clock",
  "version": "0.1.0",
  "author": { "name": "Your Name" },
  "description": "A minimal clock widget",
  "size": { "w": 4, "h": 2 },
  "permissions": {
    "system": false,
    "storage": false,
    "media": false,
    "launcher": false
  }
}
```

### `id`
Reverse-DNS format, globally unique. Use your domain or GitHub handle:
`com.yourname.widget-name` / `io.github.yourname.widget-name`.

### `size`
Grid units. The surface grid has **24 columns**. One unit ≈ 60px on a 1440p display.
Typical sizes: `4×2` (info card), `4×4` (launcher), `6×3` (media player).

### `permissions`
Only declare what you use. Undeclared permissions return an error at runtime.

| Permission | Enables |
|---|---|
| `system` | CPU, RAM, disk, GPU stats |
| `storage` | Per-widget persistent key-value store |
| `media` | Now-playing info + playback controls (Windows SMTC) |
| `launcher` | List installed apps + launch them |

---

## The `window.Vyn` API

`vyn-runtime.js` is automatically loaded before your bundle. Once loaded, `window.Vyn` is available synchronously.

### `Vyn.system` — requires `"system": true`

```js
// One-shot snapshot
const snap = await Vyn.system.snapshot();
// snap.cpu_pct     — 0–100
// snap.ram_used_mb / ram_total_mb
// snap.disks[]     — [{ label, kind, used_mb, total_mb }]
// snap.gpu         — { name, vram_total_mb, vram_used_mb } or null
```

### `Vyn.storage` — requires `"storage": true`

Isolated per widget. Data survives app restarts.

```js
await Vyn.storage.set("note", "Hello world");
const text = await Vyn.storage.get("note");   // "Hello world"
const keys = await Vyn.storage.keys();
await Vyn.storage.delete("note");
```

### `Vyn.media` — requires `"media": true`

Reads the Windows system media session (Spotify, Groove, browsers…).

```js
const np = await Vyn.media.nowPlaying();
// np.title / np.artist / np.album / np.artwork_url / np.is_playing
// np.position / np.duration (seconds)

await Vyn.media.play();
await Vyn.media.pause();
await Vyn.media.next();
await Vyn.media.previous();

// Subscribe to changes
Vyn.media.subscribe((np) => renderTrack(np));
```

### `Vyn.launcher` — requires `"launcher": true`

```js
const apps = await Vyn.launcher.apps();
// apps[i] = { id, name }

const dataUrl = await Vyn.launcher.getIcon(app.id);   // PNG data URL or null
await Vyn.launcher.launch(app.id);
```

### `Vyn.lifecycle` — no permission required

Reduce work when hidden or system is under load.

```js
Vyn.lifecycle.onSleep(() => clearInterval(timer));
Vyn.lifecycle.onWake(() => startPolling());
Vyn.lifecycle.onThrottle(() => { /* slow down — eg. poll every 10s */ });
Vyn.lifecycle.onUnthrottle(() => { /* resume normal rate */ });
```

### `Vyn.config` — no permission required

Per-widget user-configurable fields (set via the Manager).

```js
const config = await Vyn.config.getAll();   // { city: "Paris", units: "C" }
const city   = await Vyn.config.get("city");
await Vyn.config.set("city", "London");

Vyn.config.subscribe((change) => {
  // change = { key: "city", value: "London" }
  render(change);
});
```

---

## Full example — live CPU bar

```js
// src/index.js
const bar = document.createElement("div");
Object.assign(bar.style, {
  height: "100vh", width: "100vw",
  background: "rgba(255,255,255,0.055)",
  backdropFilter: "blur(24px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "16px",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  gap: "12px", color: "rgba(255,255,255,0.7)",
  fontFamily: "system-ui, sans-serif",
});
document.body.appendChild(bar);

const label = document.createElement("span");
label.style.fontSize = "11px";
label.style.letterSpacing = "0.2em";
label.style.textTransform = "uppercase";
label.style.opacity = "0.4";
label.textContent = "CPU";
bar.appendChild(label);

const track = document.createElement("div");
Object.assign(track.style, {
  width: "80%", height: "6px",
  background: "rgba(255,255,255,0.08)",
  borderRadius: "9999px", overflow: "hidden",
});
bar.appendChild(track);

const fill = document.createElement("div");
Object.assign(fill.style, {
  height: "100%",
  background: "linear-gradient(90deg, #4f8cff, #a78bfa)",
  borderRadius: "9999px",
  transition: "width 0.9s ease",
  width: "0%",
});
track.appendChild(fill);

const pct = document.createElement("span");
pct.style.fontSize = "24px";
pct.style.fontWeight = "200";
bar.appendChild(pct);

async function tick() {
  const snap = await Vyn.system.snapshot();
  fill.style.width = snap.cpu_pct + "%";
  pct.textContent = snap.cpu_pct.toFixed(1) + "%";
}

tick();
const timer = setInterval(tick, 2000);
Vyn.lifecycle.onSleep(() => clearInterval(timer));
Vyn.lifecycle.onWake(() => { tick(); setInterval(tick, 2000); });
```

`manifest.json`:
```json
{ "permissions": { "system": true }, "size": { "w": 3, "h": 2 } }
```

---

## React / TypeScript widget

Use your own Vite project. The CLI handles packing.

```bash
pnpm create vite my-widget --template react-ts
cd my-widget
pnpm add @vyntra/widget-shared   # useVyn() hook (optional)

# Add vyn-runtime.js to index.html before the React script tag:
# <script src="vyn-runtime.js"></script>

# Build with Vite, then pack with the CLI:
pnpm build
vyn pack dist widget.vyn
```

`useVyn()` (from `@vyntra/widget-shared`) is a convenience React hook that
returns `window.Vyn` once the runtime is ready:

```tsx
import { useVyn } from "@vyntra/widget-shared";

export default function App() {
  const vyn = useVyn();
  const [cpu, setCpu] = useState(0);

  useEffect(() => {
    if (!vyn) return;
    const timer = setInterval(async () => {
      const snap = await vyn.system.snapshot();
      setCpu(snap.cpu_pct);
    }, 2000);
    return () => clearInterval(timer);
  }, [vyn]);

  return <div>{cpu.toFixed(1)}%</div>;
}
```

---

## CLI reference

```
vyn init <name>         Scaffold a new widget project
vyn build               Bundle src/ → dist/  (esbuild + runtime injection)
vyn pack [dist] [out]   Zip dist/ into a .vyn archive
vyn validate <file>     Validate a manifest.json or .vyn file
```

---

## Styling conventions

Vyntra widgets render on a transparent desktop surface. Use the glass morphism
baseline so your widget blends with the rest:

```css
/* Applied to your root element */
background: rgba(255, 255, 255, 0.055);
border: 1px solid rgba(255, 255, 255, 0.09);
backdrop-filter: blur(24px) saturate(160%);
border-radius: 16px;
overflow: hidden;
```

Text on glass:
- Headers: `rgba(255,255,255,0.30)` — 9px, bold, uppercase, letter-spacing
- Values: `rgba(255,255,255,0.70)` — 12–14px, light weight
- Muted:  `rgba(255,255,255,0.18)`

Accent colors used by built-in widgets:
- Blue gradient: `#4f8cff → #7ca8ff → #a78bfa`
- Teal: `#2dd4bf → #34d399`
- Amber (warning): `#fbbf24 → #f59e0b`

---

## Performance tips

- Poll at 2 s intervals for system stats — faster updates don't add visible detail.
- Use `Vyn.lifecycle.onThrottle` to drop to 10 s when Vyntra is under load.
- Prefer CSS animations over JS-driven loops for visual effects.
- Batch DOM updates — avoid triggering layout on every tick.

---

## Publishing (coming soon)

The Vyntra store will allow creators to submit `.vyn` files for review.
Submissions will be validated automatically; manifests with a certified badge
indicate the widget has passed a security audit.

For early access to store submissions: n.lopez@arcade.fr
