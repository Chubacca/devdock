import { describe, expect, it } from "vitest";
import { detectRoutes } from "../src/svelte/sveltekit";

// The detector's whole input is whatever `import.meta.glob` hands back, so
// these run it for real (Vite resolves the patterns at transform time) over a
// fixture tree shaped like SvelteKit's `src/routes`. Both key styles Vite
// produces are covered: relative to this file, and root-absolute.
const relative = import.meta.glob("./fixtures/sveltekit-routes/**/+page.svelte");
const absolute = import.meta.glob("/test/fixtures/sveltekit-routes/**/+page.svelte");

// The fixture directory isn't named `routes`, so point the detector at it.
const routesDir = "sveltekit-routes";
const paths = (modules: Record<string, unknown>) =>
  detectRoutes(modules, { staticRoutes: true, routesDir }).map((r) => r.path);

describe("detectRoutes over a real import.meta.glob", () => {
  it("sees the fixture pages through both key styles", () => {
    expect(Object.keys(relative).length).toBeGreaterThan(0);
    expect(Object.keys(relative)[0]).toMatch(/^\.\/fixtures\//);
    expect(Object.keys(absolute)[0]).toMatch(/^\/test\/fixtures\//);
  });

  it("maps them to the routes SvelteKit would serve", () => {
    const expected = ["/", "/billing", "/dev", "/dev/flags", "/dev/inspector"];
    expect(paths(relative)).toEqual(expected);
    expect(paths(absolute)).toEqual(expected);
  });

  it("keeps only the dev subtree by default", () => {
    expect(detectRoutes(relative, { routesDir }).map((r) => r.path)).toEqual([
      "/dev",
      "/dev/flags",
      "/dev/inspector",
    ]);
  });
});
