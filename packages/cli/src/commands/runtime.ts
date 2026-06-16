import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_ASSET = path.resolve(__dirname, "../../assets/vyn-runtime.js");

export async function runtime(args: string[]): Promise<void> {
  const destDir = args[0] ?? ".";
  
  // Check if runtime asset exists
  try {
    await fs.access(RUNTIME_ASSET);
  } catch {
    // Monorepo fallback for local dev
    const fallback = path.resolve(__dirname, "../../../../widgets-examples/_shared/vyn-runtime.js");
    try {
      await fs.access(fallback);
      const destPath = path.join(destDir, "vyn-runtime.js");
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(fallback, destPath);
      console.log(`✓ copied vyn-runtime.js (monorepo fallback) to ${destPath}`);
      return;
    } catch {
      throw new Error("vyn-runtime.js asset not found. Make sure you are running the CLI from its package directory.");
    }
  }

  const destPath = path.join(destDir, "vyn-runtime.js");
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(RUNTIME_ASSET, destPath);
  console.log(`✓ copied vyn-runtime.js to ${destPath}`);
}
