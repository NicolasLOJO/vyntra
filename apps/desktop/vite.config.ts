import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri attend un dev server fixe.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "chrome110",
    outDir: "dist",
  },
});
