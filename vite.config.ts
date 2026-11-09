import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import pkg from "./package.json";

const userscriptHeader = `// ==UserScript==
// @name         Petite Grace
// @namespace    https://github.com/styayur/petite-grace
// @version      ${pkg.version}
// @description  Lightweight course companion for Xiaoya learning platform
// @match        https://*.ai-augmented.com/*
// @icon         https://www.ai-augmented.com/static/logo3.1dbbea8f.png
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      ai-augmented.com
// @connect      *.ai-augmented.com
// @connect      api.groq.com
// @connect      openrouter.ai
// @connect      generativelanguage.googleapis.com
// @run-at       document-idle
// ==/UserScript==`;

const userscriptHeaderPlugin = {
  name: "petite-grace-userscript-header",
  generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
    const chunk = bundle["petite-grace.user.js"];
    if (chunk?.type === "chunk" && typeof chunk.code === "string") {
      chunk.code = `${userscriptHeader}\n${chunk.code}`;
    }
  },
};

export default defineConfig({
  plugins: [userscriptHeaderPlugin],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome120",
    sourcemap: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./src/entrypoints/xiaoya.user.tsx", import.meta.url)),
      output: {
        entryFileNames: "petite-grace.user.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
});
