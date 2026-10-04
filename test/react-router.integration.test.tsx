import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  ReactRouterDevDock,
  type ReactRouterDevDockProps,
  type RouteMatcher,
  useDetectedRoutes,
} from "../src/react/react-router";
import type { DevRoute } from "../src/core/types";
import { rowWith, toggle } from "./shadow";

// Spy on useNavigate so we can assert the dock wires SPA navigation without
// driving react-router's real data-router navigation (which trips a jsdom +
// undici AbortSignal incompatibility under the test runtime).
const navSpy = vi.hoisted(() => vi.fn());
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navSpy,
}));

function makeRouter(dockProps: ReactRouterDevDockProps = {}) {
  return createMemoryRouter([
    {
      path: "/",
      element: (
        <>
          <div>home</div>
          <Outlet />
          <ReactRouterDevDock enabled {...dockProps} />
        </>
      ),
      children: [
        { path: "admin", element: <div>admin page</div> },
        { path: "billing", element: <div>billing page</div> },
        { path: "dev", element: <div>dev index</div> },
        { path: "dev/inspector", element: <div>inspector</div> },
        { path: ":id", element: <div>dynamic</div> },
      ],
    },
  ]);
}

describe("ReactRouterDevDock", () => {
  it("auto-detects navigable routes and skips dynamic ones", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={makeRouter()} />);
    await user.click(toggle());
    expect(rowWith("/admin")).toBeTruthy();
    expect(rowWith("/billing")).toBeTruthy();
    expect(rowWith("/:id")).toBeFalsy();
  });

  it("navigates through the SPA router on select", async () => {
    const user = userEvent.setup();
    navSpy.mockClear();
    render(<RouterProvider router={makeRouter()} />);
    await user.click(toggle());
    await user.click(rowWith("/admin")!);
    expect(navSpy).toHaveBeenCalledWith("/admin");
  });

  it("scopes auto-detected routes with a glob match", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={makeRouter({ match: "/dev/*" })} />);
    await user.click(toggle());
    expect(rowWith("/dev/inspector")).toBeTruthy();
    expect(rowWith("/admin")).toBeFalsy();
    expect(rowWith("/billing")).toBeFalsy();
  });
});

// `useDetectedRoutes` is public API (for building your own UI), so exercise it
// directly rather than only through the dock.
function renderDetected(match?: RouteMatcher) {
  let detected: DevRoute[] = [];
  function Probe() {
    detected = useDetectedRoutes(match);
    return null;
  }
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <>
          <Probe />
          <Outlet />
        </>
      ),
      children: [
        { path: "admin", element: null },
        { path: "dev", element: null },
        { path: "dev/inspector", element: null, handle: { devLabel: "Insp" } },
        { path: "secret", element: null, handle: { hidden: true } },
        { path: ":id", element: null },
        { path: "*", element: null },
      ],
    },
  ]);
  render(<RouterProvider router={router} />);
  return detected;
}

describe("useDetectedRoutes", () => {
  it("reads navigable routes off the active data router", () => {
    const paths = renderDetected().map((r) => r.path);
    expect(paths).toContain("/admin");
    expect(paths).toContain("/dev/inspector");
    expect(paths).not.toContain("/:id");
    expect(paths).not.toContain("/*");
    expect(paths).not.toContain("/secret");
  });

  it("carries handle.devLabel through", () => {
    expect(renderDetected()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/dev/inspector", label: "Insp" }),
      ]),
    );
  });

  it("scopes results with a RouteMatcher and dedupes paths", () => {
    const paths = renderDetected("/dev/*").map((r) => r.path);
    expect(paths).toEqual(["/dev/inspector"]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("accepts a RegExp and a predicate matcher", () => {
    expect(renderDetected(/^\/admin$/).map((r) => r.path)).toEqual(["/admin"]);
    expect(
      renderDetected((r) => r.path.startsWith("/dev")).map((r) => r.path),
    ).toEqual(["/dev", "/dev/inspector"]);
  });
});
