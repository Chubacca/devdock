import { afterEach, describe, expect, it } from "vitest";
import { detectRoutes, devdock, routeFromFile } from "../src/svelte/sveltekit";
import { hostEl, rowWith, toggle } from "./shadow";

/** The shape `import.meta.glob("/src/routes/**\/+page.svelte")` hands back. */
const glob = (...files: string[]) =>
  Object.fromEntries(files.map((f) => [f, () => Promise.resolve({})]));

const paths = (routes: { path: string }[]) => routes.map((r) => r.path);

describe("routeFromFile", () => {
  it("maps page files to the routes they serve", () => {
    expect(routeFromFile("/src/routes/+page.svelte")).toBe("/");
    expect(routeFromFile("/src/routes/dev/+page.svelte")).toBe("/dev");
    expect(routeFromFile("/src/routes/dev/inspector/+page.svelte")).toBe(
      "/dev/inspector",
    );
  });

  it("accepts the key shapes import.meta.glob produces", () => {
    for (const key of [
      "/src/routes/dev/+page.svelte",
      "src/routes/dev/+page.svelte",
      "../routes/dev/+page.svelte",
      "./dev/+page.svelte",
      "dev/+page.svelte",
      "C:\\app\\src\\routes\\dev\\+page.svelte",
    ])
      expect(routeFromFile(key)).toBe("/dev");
  });

  it("keeps a route directory that is itself named `routes`", () => {
    expect(routeFromFile("/src/routes/routes/+page.svelte")).toBe("/routes");
  });

  it("drops layout groups and optional params from the path", () => {
    expect(routeFromFile("/src/routes/(app)/dev/+page.svelte")).toBe("/dev");
    expect(routeFromFile("/src/routes/[[lang]]/dev/+page.svelte")).toBe("/dev");
  });

  it("follows the layout-reset and non-svelte page extensions", () => {
    expect(routeFromFile("/src/routes/dev/+page@(app).svelte")).toBe("/dev");
    expect(routeFromFile("/src/routes/dev/+page@.svelte")).toBe("/dev");
  });

  it("skips params that need arguments", () => {
    expect(routeFromFile("/src/routes/users/[id]/+page.svelte")).toBeNull();
    expect(routeFromFile("/src/routes/p/[id=integer]/+page.svelte")).toBeNull();
    expect(routeFromFile("/src/routes/files/[...rest]/+page.svelte")).toBeNull();
  });

  it("skips everything that isn't a page", () => {
    for (const key of [
      "/src/routes/+layout.svelte",
      "/src/routes/dev/+layout.ts",
      "/src/routes/dev/+server.ts",
      "/src/routes/+error.svelte",
      "/src/routes/dev/Widget.svelte",
      "/src/routes/dev/+pages.svelte",
    ])
      expect(routeFromFile(key)).toBeNull();
  });

  it("honours an explicit routesDir", () => {
    expect(
      routeFromFile("/app/pages/dev/+page.svelte", { routesDir: "app/pages" }),
    ).toBe("/dev");
    // …and only that directory.
    expect(
      routeFromFile("/src/routes/dev/+page.svelte", { routesDir: "app/pages" }),
    ).toBeNull();
  });
});

describe("detectRoutes", () => {
  const modules = glob(
    "/src/routes/+page.svelte",
    "/src/routes/billing/+page.svelte",
    "/src/routes/dev/+page.svelte",
    "/src/routes/dev/flags/+page.svelte",
    "/src/routes/(internal)/dev/inspector/+page.svelte",
    "/src/routes/users/[id]/+page.svelte",
    "/src/routes/dev/+layout.svelte",
  );

  it("returns only the dev routes by default", () => {
    expect(paths(detectRoutes(modules))).toEqual([
      "/dev",
      "/dev/flags",
      "/dev/inspector",
    ]);
  });

  it("lists every page with staticRoutes", () => {
    expect(paths(detectRoutes(modules, { staticRoutes: true }))).toEqual([
      "/",
      "/billing",
      "/dev",
      "/dev/flags",
      "/dev/inspector",
    ]);
  });

  it("scopes results with a matcher, glob / regexp / predicate alike", () => {
    const all = { staticRoutes: true };
    expect(
      paths(detectRoutes(modules, { ...all, match: "/dev/*" })),
    ).toEqual(["/dev/flags", "/dev/inspector"]);
    expect(
      paths(detectRoutes(modules, { ...all, match: /^\/(billing|dev)$/ })),
    ).toEqual(["/billing", "/dev"]);
    expect(
      paths(detectRoutes(modules, { ...all, match: (r) => r.path === "/" })),
    ).toEqual(["/"]);
  });

  it("takes a bare matcher as shorthand", () => {
    expect(paths(detectRoutes(modules, "/dev/*"))).toEqual([
      "/dev/flags",
      "/dev/inspector",
    ]);
  });

  it("accepts a plain list of files and dedupes shared paths", () => {
    const routes = detectRoutes([
      "/src/routes/dev/+page.svelte",
      "/src/routes/dev/+page.ts",
      "/src/routes/(internal)/dev/+page.svelte",
    ]);
    expect(paths(routes)).toEqual(["/dev"]);
  });

  it("labels each route with its path", () => {
    expect(detectRoutes(modules)[0]).toEqual({ path: "/dev", label: "/dev" });
  });
});

describe("devdock (sveltekit action)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists the detected routes, then the manual ones", () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const action = devdock(node, {
      enabled: true,
      modules: glob(
        "/src/routes/dev/+page.svelte",
        "/src/routes/billing/+page.svelte",
      ),
      routes: [{ path: "/admin", label: "Admin" }],
    });

    toggle().click();
    expect(rowWith("/dev")).not.toBeNull();
    expect(rowWith("Admin")).not.toBeNull();
    expect(rowWith("/billing")).toBeNull();

    action.update({ enabled: false });
    expect(hostEl()).toBeNull();
    action.destroy();
  });
});
