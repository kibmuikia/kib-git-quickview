// file: vite.config.ts
import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

import manifest from "./src/manifest.config.ts";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
  },
});
