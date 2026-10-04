import { describe, expect, it } from "vitest";
import { flattenRoutes } from "../src/react/react-router";

describe("flattenRoutes", () => {
  it("flattens nested routes and joins paths", () => {
    const routes = flattenRoutes([
      { path: "/", children: [{ path: "about" }, { index: true }] },
      {
        path: "admin",
        children: [{ path: "users" }, { path: ":id" }],
      },
    ]);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/about");
    expect(paths).toContain("/admin");
    expect(paths).toContain("/admin/users");
  });

  it("skips dynamic, splat, and hidden routes", () => {
    const routes = flattenRoutes([
      { path: "ok" },
      { path: ":id" },
      { path: "*" },
      { path: "secret", handle: { hidden: true } },
    ]);
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
});
