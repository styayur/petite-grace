import { resolve } from "node:path";
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

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome120",
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "src/entrypoints/xiaoya.user.ts"),
      output: {
        entryFileNames: "petite-grace.user.js",
        format: "iife",
        inlineDynamicImports: true,
        banner: userscriptHeader,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});