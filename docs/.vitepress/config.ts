import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Webdraw",
  description: "Build drawing experiences with the Webdraw web component",
  cleanUrls: true,
  head: [["link", { rel: "icon", href: "/logo.svg" }]],
  themeConfig: {
    logo: { src: "/logo.svg", alt: "Webdraw" },
    nav: [
      { text: "Get started", link: "/" },
      { text: "Playground", link: "/playground" },
      { text: "Attributes", link: "/guide/attributes" },
      { text: "Methods", link: "/guide/methods" },
    ],
    sidebar: [
      {
        text: "Integrate Webdraw",
        items: [
          { text: "Quick start", link: "/" },
          { text: "Attributes", link: "/guide/attributes" },
          { text: "Properties", link: "/guide/properties" },
          { text: "Methods", link: "/guide/methods" },
          { text: "Events", link: "/guide/events" },
        ],
      },
    ],
    footer: {
      message:
        'Released under the <a href="https://github.com/henryhale/webdraw/blob/master/LICENSE.txt">MIT License</a>.',
      copyright:
        'Copyright © 2026-present, <a href="https://github.com/henryhale">Henry Hale</a>.',
    },
    search: { provider: "local" },
  },
  vite: {
    plugins: [
      {
        name: "copy-webdraw-docs-fonts",
        apply: "build",
        writeBundle({ dir }) {
          if (!dir?.endsWith("dist")) return;
          const fonts = resolve(dir, "assets/chunks/fonts/Lilita");
          rmSync(fonts, { recursive: true, force: true });
          mkdirSync(fonts, { recursive: true });
          cpSync("src/fonts/Lilita", fonts, {
            recursive: true,
            filter: (source) => !source.endsWith(".ts"),
          });
        },
      },
    ],
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "web-draw",
        },
      },
    },
  },
});
