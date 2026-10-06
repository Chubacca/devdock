import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevDock } from "../src/react";
import { byLabel, dialog, filterInput, rowWith, toggle } from "./shadow";

describe("DevDock (React)", () => {
  it("does not render when disabled", () => {
    render(<DevDock enabled={false} routes={[{ path: "/x" }]} />);
    expect(byLabel("Toggle dev menu")).toBeNull();
  });

  it("renders the floating button when enabled", () => {
    render(<DevDock enabled label="DEV" />);
    expect(byLabel("Toggle dev menu")).not.toBeNull();
  });

  it("opens the popup and lists routes and commands", async () => {
    const user = userEvent.setup();
    render(
      <DevDock
        enabled
        routes={[{ path: "/admin", label: "Admin" }]}
        commands={[{ label: "Clear cache", run: () => {} }]}
      />,
    );
    await user.click(toggle());
    expect(dialog()).not.toBeNull();
    expect(rowWith("Admin")).toBeTruthy();
    expect(rowWith("Clear cache")).toBeTruthy();
  });

  it("navigates via onNavigate when a route is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <DevDock
        enabled
        onNavigate={onNavigate}
        routes={[{ path: "/admin", label: "Admin" }]}
      />,
    );
    await user.click(toggle());
    await user.click(rowWith("Admin")!);
    expect(onNavigate).toHaveBeenCalledWith("/admin");
  });

  it("runs a command and closes by default", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<DevDock enabled commands={[{ label: "Do it", run }]} />);
    await user.click(toggle());
    await user.click(rowWith("Do it")!);
    expect(run).toHaveBeenCalledOnce();
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("filters items by query", async () => {
    const user = userEvent.setup();
    render(
      <DevDock
        enabled
        routes={[
          { path: "/admin", label: "Admin" },
          { path: "/billing", label: "Billing" },
        ]}
      />,
    );
    await user.click(toggle());
    await user.type(filterInput(), "bill");
    expect(rowWith("Admin")).toBeFalsy();
    expect(rowWith("Billing")).toBeTruthy();
  });

  it("toggles with the configured hotkey", async () => {
    const user = userEvent.setup();
    render(<DevDock enabled hotkey="ctrl+." />);
    expect(dialog()).toBeNull();
    await user.keyboard("{Control>}.{/Control}");
    expect(dialog()).not.toBeNull();
  });

  it("tears down when unmounted", () => {
    const { unmount } = render(<DevDock enabled />);
    expect(byLabel("Toggle dev menu")).not.toBeNull();
    unmount();
    expect(byLabel("Toggle dev menu")).toBeNull();
  });
});

describe("DevDock (React) default dev gating", () => {
  // NODE_ENV is "test" under vitest, so the build half of the gate is open;
  // these check the hostname half flows through the adapter untouched.
  const servedFrom = (hostname: string) => vi.stubGlobal("location", { hostname });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders with no props when served from a dev host", () => {
    render(<DevDock />);
    expect(byLabel("Toggle dev menu")).not.toBeNull();
  });

  it("stays hidden on a deployed host", () => {
    servedFrom("app.example.com");
    render(<DevDock />);
    expect(byLabel("Toggle dev menu")).toBeNull();
  });

  it("renders on a deployed host with devHostOnly={false}", () => {
    servedFrom("staging.example.com");
    render(<DevDock devHostOnly={false} />);
    expect(byLabel("Toggle dev menu")).not.toBeNull();
  });
});
