import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "copy-webdraw-fonts",
      apply: "build",
      writeBundle({ dir }) {
        const fonts = resolve(dir ?? "dist", "fonts");
        rmSync(fonts, { recursive: true, force: true });
        mkdirSync(fonts, { recursive: true });
        cpSync("src/fonts/Lilita", resolve(fonts, "Lilita"), {
          recursive: true,
          filter: (source) => !source.endsWith(".ts"),
        });
      },
    },
  ],
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
