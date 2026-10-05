import { defineConfig } from "vitest/config";

// Second pass over the react-router suite with the adapter resolved against
// react-router 7 instead of the v8 the devDeps install. The adapter supports
// v6/v7/v8 off one `react-router` specifier, so CI has to run the version it
// is not building against — the v8 break (a missing `react-router-dom`) is
// exactly the kind of regression a single-version suite cannot see.
//
// v7 is installed under the `react-router-v7` alias in devDependencies; this
// config points the bare `react-router` specifier at it for this pass only.
export default defineConfig({
  resolve: {
    alias: [{ find: /^react-router$/, replacement: "react-router-v7" }],
  },
  test: {
    name: "react-router-7",
    env: { DEVDOCK_REACT_ROUTER: "7" },
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/react-router*.test.{ts,tsx}"],
  },
});
