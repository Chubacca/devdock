import { describe, expect, it } from "vitest";
import { flattenRoutes } from "../src/react/react-router";

const all = { staticRoutes: true };

describe("flattenRoutes", () => {
  it("flattens nested routes and joins paths", () => {
    const routes = flattenRoutes(
      [
        { path: "/", children: [{ path: "about" }, { index: true }] },
        {
          path: "admin",
          children: [{ path: "users" }, { path: ":id" }],
        },
      ],
      "",
      all,
    );
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/about");
    expect(paths).toContain("/admin");
    expect(paths).toContain("/admin/users");
  });

  it("skips dynamic, splat, and hidden routes", () => {
    const routes = flattenRoutes(
      [
        { path: "ok" },
        { path: ":id" },
        { path: "*" },
        { path: "secret", handle: { hidden: true } },
      ],
      "",
      all,
    );
    const paths = routes.map((r) => r.path);
    expect(paths).toEqual(["/ok"]);
  });

  it("uses handle.devLabel and handle.devGroup", () => {
    const [route] = flattenRoutes([
      { path: "reports", handle: { devLabel: "Reports", devGroup: "Internal" } },
    ]);
    expect(route).toMatchObject({
      path: "/reports",
      label: "Reports",
      group: "Internal",
    });
  });

  it("returns only dev-marked routes by default", () => {
    const paths = flattenRoutes([
      { path: "billing" },
      { path: "flagged", handle: { dev: true } },
      { path: "labelled", handle: { devLabel: "Labelled" } },
      { path: "grouped", handle: { devGroup: "Internal" } },
      { path: "off", handle: { dev: false } },
    ]).map((r) => r.path);
    expect(paths).toEqual(["/flagged", "/labelled", "/grouped"]);
  });

  it("treats /dev and anything under it as dev, nested or flat", () => {
    const paths = flattenRoutes([
      { path: "dev", children: [{ path: "inspector" }] },
      { path: "dev/flags" },
      { path: "developers" },
      { path: "billing" },
    ]).map((r) => r.path);
    expect(paths).toEqual(["/dev", "/dev/inspector", "/dev/flags"]);
  });

  it("treats the subtree of a dev-marked route as dev", () => {
    const routes = flattenRoutes([
      {
        path: "dev",
        handle: { dev: true, devGroup: "Internal" },
        children: [{ path: "inspector" }, { path: "flags" }],
      },
      { path: "billing", children: [{ path: "invoices" }] },
    ]);
    expect(routes.map((r) => r.path)).toEqual([
      "/dev",
      "/dev/inspector",
      "/dev/flags",
    ]);
    // The ancestor's group carries down; a child can still set its own.
    expect(routes.every((r) => r.group === "Internal")).toBe(true);
  });

  it("still hides a hidden route inside a dev subtree", () => {
    const paths = flattenRoutes([
      {
        path: "dev",
        handle: { dev: true },
        children: [{ path: "secret", handle: { hidden: true } }],
      },
    ]).map((r) => r.path);
    expect(paths).toEqual(["/dev"]);
  });

  it("includes plain static routes with staticRoutes", () => {
    const paths = flattenRoutes(
      [{ path: "billing" }, { path: "dev", handle: { dev: true } }],
      "",
      all,
    ).map((r) => r.path);
    expect(paths).toEqual(["/billing", "/dev"]);
  });
});
