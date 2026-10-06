import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const fromHere = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Consume the library straight from source so edits to ../../src are live.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: [
      {
        find: "@chuvenger/devdock/sveltekit",
        replacement: fromHere("../../src/svelte/sveltekit.ts"),
      },
      {
        find: "@chuvenger/devdock/svelte",
        replacement: fromHere("../../src/svelte/index.ts"),
      },
      { find: "@chuvenger/devdock", replacement: fromHere("../../src/index.ts") },
    ],
  },
  server: {
    fs: { allow: [fromHere("../..")] },
  },
});
