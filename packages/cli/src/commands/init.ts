import { promises as fs } from "node:fs";
import path from "node:path";

export async function init(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) throw new Error("usage: vyn init <name>");

  // Widget id: com.yourname.<slugified-name>
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const id = `com.example.${slug}`;
  const dir = path.resolve(name);

  await fs.mkdir(path.join(dir, "src"), { recursive: true });

  // manifest.json
  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        schema: 1,
        id,
        name,
        version: "0.1.0",
        author: { name: "Your Name" },
        description: "A Vyntra widget",
        size: { w: 4, h: 3 },
        permissions: {},
      },
      null,
      2,
    ),
  );

  // host.html — loads vyn-runtime.js first, then the widget bundle.
  await fs.writeFile(
    path.join(dir, "host.html"),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="app"></div>
  <!-- vyn-runtime.js is injected automatically by vyn build. -->
  <script src="vyn-runtime.js"></script>
  <script src="bundle.js"></script>
</body>
</html>
`,
  );

  // src/index.js — entry point.
  await fs.writeFile(
    path.join(dir, "src", "index.js"),
    `// ${name} — Vyntra widget
// window.Vyn is available once vyn-runtime.js initialises (see host.html).
// Use the Vyn API: system, storage, media, launcher.

const app = document.getElementById('app');

// Style the widget — glass morphism to match the Vyntra aesthetic.
Object.assign(document.body.style, {
  background: 'rgba(255,255,255,0.055)',
  border: '1px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(24px) saturate(160%)',
  borderRadius: '16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.75)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '14px',
});

app.textContent = 'Hello, Vyntra!';
`,
  );

  console.log(`✓ widget scaffolded in ${dir}`);
  console.log(`
Next steps:
  cd ${name}
  vyn build          # bundle src/index.js → dist/
  vyn pack           # create widget.vyn
  # Drag widget.vyn onto the Vyntra Manager to install.

Edit manifest.json to set your widget id, size, and permissions.
Edit src/index.js to build your widget logic.
`);
}
