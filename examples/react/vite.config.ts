import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const fromHere = (p: string) =>
  fileURLToPath(new URL(p, import.meta.url));

// Consume the library straight from source so edits to ../src are live.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@chuvenger/devdock/react-router",
        replacement: fromHere("../../src/react/react-router.tsx"),
      },
      {
        find: "@chuvenger/devdock/react",
        replacement: fromHere("../../src/react/index.ts"),
      },
      { find: "@chuvenger/devdock", replacement: fromHere("../../src/index.ts") },
    ],
    // Ensure a single copy of React et al. even though the source lives
    // outside this example's own node_modules.
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  server: {
    // Allow importing the library source from the repo root.
    fs: { allow: [fromHere("../..")] },
  },
});
