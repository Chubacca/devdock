import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const fromHere = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The `@chuvenger/devdock` aliases live in svelte.config.js (`kit.alias`), so
// they reach the generated tsconfig as well as the bundler.
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // Allow importing the library source from the repo root.
    fs: { allow: [fromHere("../..")] },
  },
});
