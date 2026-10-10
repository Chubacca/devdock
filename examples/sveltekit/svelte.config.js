import adapter from "@sveltejs/adapter-auto";
import { fileURLToPath, URL } from "node:url";

const fromHere = (p) => fileURLToPath(new URL(p, import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter(),
    // Consume the library straight from source so edits to ../../src are live.
    // Declared here rather than as a Vite alias so SvelteKit also writes them
    // into the tsconfig it generates — otherwise `svelte-check` can't resolve
    // the imports, and hand-writing `paths` fights the generated config.
    alias: {
      "@chuvenger/devdock/sveltekit": fromHere("../../src/svelte/sveltekit.ts"),
      "@chuvenger/devdock/svelte": fromHere("../../src/svelte/index.ts"),
      "@chuvenger/devdock": fromHere("../../src/index.ts"),
    },
  },
};
