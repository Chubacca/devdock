import { act, render, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  useDetectedRoutes,
  type DetectOptions,
} from "../src/react/react-router";
import type { DevRoute } from "../src/core/types";

// Framework mode (`app/routes.ts`) hands the router a tree of lazy routes:
// `handle` lives in the route module, not on the route object, so it is
// invisible until that module loads — which is why `handle.devLabel` silently
// did nothing there. `loadHandles` imports the modules to read it.
//
// Two `lazy` shapes exist in the wild and both carry `handle`:
//   - a function resolving to the module (`lazy: () => import("./route")`)
//   - an object with one loader per property (framework mode, v7.5+)
// Each test below pins one of them.

type RouteList = Parameters<typeof createMemoryRouter>[0];

function renderDetected(children: RouteList, options?: DetectOptions) {
  let detected: DevRoute[] = [];
  function Probe() {
    detected = useDetectedRoutes(options);
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
      children,
    },
  ]);
  render(<RouterProvider router={router} />);
  // A getter, not a snapshot: the handles land asynchronously and re-render.
  return {
    get detected() {
      return detected;
    },
    at: (path: string) => detected.find((r) => r.path === path),
    paths: () => detected.map((r) => r.path),
    router,
  };
}

/** A lazy route in the shape framework mode builds. */
const lazyObject = (path: string, handle: () => Promise<unknown>) =>
  ({ path, lazy: { handle } }) as unknown as RouteList[number];

/** A lazy route in the `lazy: () => import("./route")` shape. */
const lazyModule = (path: string, module: () => Promise<unknown>) =>
  ({ path, lazy: module }) as unknown as RouteList[number];

describe("loadHandles", () => {
  it("labels a lazy route from the handle in its module", async () => {
    const handle = vi.fn(async () => ({ devLabel: "Style Guide" }));
    const view = renderDetected([lazyObject("dev/style-guide", handle)], {
      loadHandles: true,
    });
    // Detected by the /dev convention from the first render, path as label.
    expect(view.at("/dev/style-guide")?.label).toBe("/dev/style-guide");
    await waitFor(() =>
      expect(view.at("/dev/style-guide")?.label).toBe("Style Guide"),
    );
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("detects a route marked only inside its lazy module", async () => {
    const view = renderDetected(
      [
        lazyModule("flags", async () => ({
          handle: {
            dev: true,
            devLabel: "Feature Flags",
            devGroup: "Internal",
          },
        })),
      ],
      { loadHandles: true },
    );
    expect(view.paths()).not.toContain("/flags");
    await waitFor(() =>
      expect(view.at("/flags")).toMatchObject({
        path: "/flags",
        label: "Feature Flags",
        group: "Internal",
      }),
    );
  });

  it("applies handle.hidden and devGroup read from a lazy module", async () => {
    const view = renderDetected(
      [
        lazyObject("dev/secret", async () => ({ hidden: true })),
        lazyObject("dev/tools", async () => ({ devGroup: "Internal" })),
      ],
      { loadHandles: true },
    );
    expect(view.paths()).toContain("/dev/secret");
    await waitFor(() => expect(view.paths()).not.toContain("/dev/secret"));
    expect(view.at("/dev/tools")?.group).toBe("Internal");
  });

  it("marks a whole lazy subtree dev from its layout route", async () => {
    const view = renderDetected(
      [
        {
          ...lazyObject("internal", async () => ({ dev: true })),
          children: [{ path: "users" }, { path: "jobs" }],
        } as RouteList[number],
      ],
      { loadHandles: true },
    );
    await waitFor(() =>
      expect(view.paths()).toEqual([
        "/internal",
        "/internal/users",
        "/internal/jobs",
      ]),
    );
  });

  it("imports nothing without the opt-in", async () => {
    const handle = vi.fn(async () => ({ devLabel: "Style Guide", dev: true }));
    const view = renderDetected([
      lazyObject("dev/style-guide", handle),
      lazyObject("flags", handle),
    ]);
    await waitFor(() => expect(view.at("/dev/style-guide")).toBeTruthy());
    // The /dev route is still listed — by path, with the path as its label —
    // and the route marked only in its module stays out.
    expect(view.at("/dev/style-guide")?.label).toBe("/dev/style-guide");
    expect(view.paths()).not.toContain("/flags");
    expect(handle).not.toHaveBeenCalled();
  });

  it("leaves a route alone when its handle is already on the object", async () => {
    const handle = vi.fn(async () => ({ devLabel: "From module" }));
    const view = renderDetected(
      [
        {
          ...lazyObject("dev/tools", handle),
          handle: { devLabel: "From route" },
        } as RouteList[number],
      ],
      { loadHandles: true },
    );
    await waitFor(() =>
      expect(view.at("/dev/tools")?.label).toBe("From route"),
    );
    // Assigning over a resolved `handle` would make the router warn about a
    // static property and skip its own lazy resolution.
    expect(handle).not.toHaveBeenCalled();
  });

  it("falls back to the path when a route module fails to load", async () => {
    const view = renderDetected(
      [
        lazyObject("dev/broken", async () => {
          throw new Error("module blew up");
        }),
        lazyObject("dev/fine", async () => ({ devLabel: "Fine" })),
      ],
      { loadHandles: true },
    );
    await waitFor(() => expect(view.at("/dev/fine")?.label).toBe("Fine"));
    expect(view.at("/dev/broken")?.label).toBe("/dev/broken");
  });

  it("picks up routes patched in later, importing each module once", async () => {
    const handle = vi.fn(async () => ({ devLabel: "Style Guide" }));
    const late = vi.fn(async () => ({ devLabel: "Late" }));
    const view = renderDetected([lazyObject("dev/style-guide", handle)], {
      loadHandles: true,
    });
    await waitFor(() =>
      expect(view.at("/dev/style-guide")?.label).toBe("Style Guide"),
    );

    // What lazy route discovery does as links render: a branch the dock has
    // never seen appears on the already-mounted router.
    act(() => {
      view.router.patchRoutes(null, [lazyObject("dev/late", late)]);
    });
    await waitFor(() => expect(view.at("/dev/late")?.label).toBe("Late"));
    expect(handle).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
  });
});

describe("late route trees", () => {
  it("re-reads the tree when routes are patched in, flag or no flag", async () => {
    const view = renderDetected([{ path: "dev/inspector" }]);
    expect(view.paths()).toEqual(["/dev/inspector"]);
    // The route tree is mutated in place, so nothing about the array itself
    // says "this changed" — detection has to compare what it reads.
    act(() => {
      view.router.patchRoutes(null, [
        { path: "dev/flags", handle: { devLabel: "Flags" } },
      ]);
    });
    await waitFor(() => expect(view.at("/dev/flags")?.label).toBe("Flags"));
  });
});
