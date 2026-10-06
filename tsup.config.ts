import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    "react-router": "src/react/react-router.tsx",
    svelte: "src/svelte/index.ts",
    sveltekit: "src/svelte/sveltekit.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  external: ["react", "react-dom", "react-router"],
});
