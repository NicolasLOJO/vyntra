import { promises as fs } from "node:fs";
import path from "node:path";

const SAMPLE_MANIFEST = {
  schema: 1,
  id: "com.example.hello",
  name: "Hello Vyntra",
  version: "0.1.0",
  author: { name: "You" },
  size: { w: 4, h: 2 },
  permissions: { system: false },
};

const SAMPLE_BUNDLE = `// Entry point. window.Vyn is injected by the host.
const root = document.getElementById('app');
root.textContent = 'Hello, Vyntra!';
`;

const SAMPLE_HOST_HTML = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body><div id="app"></div><script src="bundle.js"></script></body></html>
`;

export async function init(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) throw new Error("usage: vyn init <name>");

  const dir = path.resolve(name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify({ ...SAMPLE_MANIFEST, name }, null, 2),
  );
  await fs.writeFile(path.join(dir, "bundle.js"), SAMPLE_BUNDLE);
  await fs.writeFile(path.join(dir, "host.html"), SAMPLE_HOST_HTML);
  console.log(`✓ scaffolded widget in ${dir}`);
}
