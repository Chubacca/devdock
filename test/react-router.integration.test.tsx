import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  ReactRouterDevDock,
  type ReactRouterDevDockProps,
} from "../src/react/react-router";
import { rowWith, toggle } from "./shadow";

// Spy on useNavigate so we can assert the dock wires SPA navigation without
// driving react-router's real data-router navigation (which trips a jsdom +
// undici AbortSignal incompatibility under the test runtime).
const navSpy = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
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
