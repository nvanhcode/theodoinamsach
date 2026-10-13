import { build } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
const base = process.cwd();
const alias = {
  "@": base,
  "cloudflare:workers": path.join(base, "selfhost/runtime.ts"),
};
await build({
  configFile: false,
  root: path.join(base, "selfhost"),
  publicDir: path.join(base, "public"),
  plugins: [react()],
  resolve: { alias },
  build: { outDir: path.join(base, "selfhost-dist/client"), emptyOutDir: true },
  css: { postcss: path.join(base, "postcss.config.mjs") },
});
await build({
  configFile: false,
  resolve: { alias },
  build: {
    ssr: path.join(base, "selfhost/server.ts"),
    outDir: path.join(base, "selfhost-dist/server"),
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "server.mjs" } },
  },
});
