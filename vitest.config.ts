import { defineConfig } from "vitest/config";

// Default pass: whatever `react-router` devDependency is installed (v8).
// `vitest.rr7.config.ts` re-runs the react-router suite against v7.
export default defineConfig({
  test: {
    name: "react-router-8",
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
