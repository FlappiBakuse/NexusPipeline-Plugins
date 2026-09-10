import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [vue({ template: { compilerOptions: { isCustomElement: tag => tag.startsWith("nxp-") } } })],
  build: {
    outDir: path.join(root, "..", "web"),
    emptyOutDir: true,
    lib: { entry: path.join(root, "src", "main.ts"), formats: ["es"], fileName: () => "main.js" },
    rollupOptions: { output: { assetFileNames: "style.css" } },
  },
});
