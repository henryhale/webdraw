import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/webdraw.ts",
      formats: ["es"],
      fileName: "webdraw",
    },
    rollupOptions: {
      output: { assetFileNames: "webdraw[extname]" },
    },
  },
});
