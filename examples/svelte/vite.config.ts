import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath, URL } from "node:url";

const fromHere = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Consume the library straight from source so edits to ../../src are live.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: "@chuvenger/devdock/svelte",
        replacement: fromHere("../../src/svelte/index.ts"),
      },
      { find: "@chuvenger/devdock", replacement: fromHere("../../src/index.ts") },
    ],
    dedupe: ["svelte"],
  },
  server: {
    fs: { allow: [fromHere("../..")] },
  },
});
