import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevDock } from "../src/core";
import { devdock } from "../src/svelte";
import {
  byLabel,
  dialog,
  filterInput,
  hostEl,
  isHighlighted,
  rowEls,
  rowWith,
  shell,
  toggle,
} from "./shadow";

const dock = () => hostEl();

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createDevDock (framework-agnostic core)", () => {
  it("mounts only when enabled and unmounts on destroy", () => {
    const off = createDevDock({ enabled: false });
    expect(dock()).toBeNull();
    off.destroy();

    const on = createDevDock({ enabled: true });
    expect(dock()).not.toBeNull();
    on.destroy();
    expect(dock()).toBeNull();
  });

  it("renders inside a shadow root by default (isolated from the page)", () => {
    const inst = createDevDock({ enabled: true });
    const host = hostEl()!;
    expect(host.shadowRoot).not.toBeNull();
    // Internals are NOT reachable from the light DOM.
    expect(document.querySelector("[aria-label='Toggle dev menu']")).toBeNull();
    // …but they exist inside the shadow root.
    expect(host.shadowRoot!.querySelector("[aria-label='Toggle dev menu']")).not.toBeNull();
    inst.destroy();
  });

  it("renders in the light DOM when shadow: false", () => {
    const inst = createDevDock({ enabled: true, shadow: false });
    expect(hostEl()!.shadowRoot).toBeNull();
    expect(document.querySelector("[aria-label='Toggle dev menu']")).not.toBeNull();
    inst.destroy();
  });

  it("anchors to the bottom-right corner by default", () => {
    const inst = createDevDock({ enabled: true });
    const { top, right, bottom, left } = shell()!.style;
    expect({ bottom, right }).toEqual({ bottom: "16px", right: "16px" });
    expect({ top, left }).toEqual({ top: "", left: "" });
    inst.destroy();
  });

  it("moves to the requested corner, clearing the previous one", () => {
    const inst = createDevDock({ enabled: true, position: "top-left" });
    expect(shell()!.style.top).toBe("16px");
    expect(shell()!.style.left).toBe("16px");
    expect(shell()!.style.bottom).toBe("");
    expect(shell()!.style.right).toBe("");

    inst.update({ position: "bottom-right" });
    expect(shell()!.style.bottom).toBe("16px");
    expect(shell()!.style.right).toBe("16px");
    expect(shell()!.style.top).toBe("");
    expect(shell()!.style.left).toBe("");
    inst.destroy();
  });

  it("opens the panel from the same corner as the button", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({ enabled: true });
    await user.click(toggle());
    // Default corner: panel sits above the button and right-aligns to it.
    expect(dialog()!.style.right).toBe("0px");
    expect(dialog()!.style.left).toBe("");
    inst.destroy();
  });

  it("opens, navigates, and runs commands", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const run = vi.fn();
    const inst = createDevDock({
      enabled: true,
      routes: [{ path: "/admin", label: "Admin" }],
      commands: [{ label: "Do it", run }],
      onNavigate,
    });

    await user.click(toggle());
    expect(dialog()).not.toBeNull();

    await user.click(rowWith("Admin")!);
    expect(onNavigate).toHaveBeenCalledWith("/admin");
    expect(dialog()).toBeNull(); // closed

    await user.click(toggle());
    await user.click(rowWith("Do it")!);
    expect(run).toHaveBeenCalledOnce();

    inst.destroy();
  });

  it("closes on outside click, stays open on inside click", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      routes: [{ path: "/a", label: "A" }],
    });
    await user.click(toggle());
    expect(dialog()).not.toBeNull();

    await user.click(filterInput()); // inside the panel
    expect(dialog()).not.toBeNull();

    await user.click(document.body); // outside
    expect(dialog()).toBeNull();

    inst.destroy();
  });

  it("filters items by query", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      routes: [
        { path: "/admin", label: "Admin" },
        { path: "/billing", label: "Billing" },
      ],
    });
    await user.click(toggle());
    await user.type(filterInput(), "bill");
    expect(rowWith("Billing")).toBeTruthy();
    expect(rowWith("Admin")).toBeFalsy();
    inst.destroy();
  });

  // Regression: `renderList()` used to rebuild every row on `mouseenter`,
  // which replaced the node under the pointer. In a real browser that means
  // mousedown and mouseup land on different nodes, so no `click` is ever
  // dispatched on the row and the dock does nothing on a mouse click. jsdom
  // can't see that (no hit testing, and `.click()` dispatches directly), so
  // these tests assert the underlying invariant: hovering doesn't rebuild.
  it("hovering a row does not rebuild the list", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      routes: [
        { path: "/a", label: "A" },
        { path: "/b", label: "B" },
        { path: "/c", label: "C" },
      ],
    });
    await user.click(toggle());

    const hover = (row: HTMLElement) =>
      row.dispatchEvent(new MouseEvent("mouseenter"));

    const first = rowEls()[1]!;
    hover(first);
    expect(isHighlighted(first)).toBe(true);

    // Same row again: the node under the pointer must survive.
    hover(rowEls()[1]!);
    expect(rowEls()[1]).toBe(first);
    expect(isHighlighted(first)).toBe(true);

    // A different row: the highlight moves, every node stays put.
    const before = rowEls();
    hover(rowEls()[2]!);
    expect(rowEls()).toEqual(before);
    expect(isHighlighted(first)).toBe(false);
    expect(isHighlighted(before[2]!)).toBe(true);

    inst.destroy();
  });

  it("moves the highlight with the arrow keys without rebuilding rows", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      routes: [
        { path: "/a", label: "A" },
        { path: "/b", label: "B" },
      ],
    });
    await user.click(toggle());
    // The dock focuses the filter input on open via rAF; do it eagerly so the
    // panel's keydown handler sees the keystrokes.
    filterInput().focus();

    const before = rowEls();
    expect(isHighlighted(before[0]!)).toBe(true);

    await user.keyboard("{ArrowDown}");
    expect(rowEls()).toEqual(before);
    expect(isHighlighted(before[0]!)).toBe(false);
    expect(isHighlighted(before[1]!)).toBe(true);

    await user.keyboard("{ArrowUp}");
    expect(isHighlighted(before[0]!)).toBe(true);
    expect(isHighlighted(before[1]!)).toBe(false);

    inst.destroy();
  });

  it("runs the hovered row on click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const inst = createDevDock({
      enabled: true,
      routes: [
        { path: "/a", label: "A" },
        { path: "/b", label: "B" },
      ],
      onNavigate,
    });
    await user.click(toggle());

    const row = rowEls()[1]!;
    row.dispatchEvent(new MouseEvent("mouseenter"));
    await user.click(row);
    expect(onNavigate).toHaveBeenCalledWith("/b");

    inst.destroy();
  });

  it("enabled accepts a predicate, re-evaluated on update", () => {
    let flag = false;
    const inst = createDevDock({ enabled: () => flag });
    expect(dock()).toBeNull();
    flag = true;
    inst.update({}); // re-evaluates the predicate
    expect(dock()).not.toBeNull();
    flag = false;
    inst.update({});
    expect(dock()).toBeNull();
    inst.destroy();
  });

  it("update() toggles visibility at runtime", () => {
    const inst = createDevDock({ enabled: false });
    expect(dock()).toBeNull();
    inst.update({ enabled: true });
    expect(dock()).not.toBeNull();
    inst.update({ enabled: false });
    expect(dock()).toBeNull();
    inst.destroy();
  });
});

describe("devdock (svelte action)", () => {
  it("mounts on use and tears down on destroy", () => {
    const node = document.createElement("div");
    document.body.appendChild(node);

    const action = devdock(node, { enabled: true });
    expect(dock()).not.toBeNull();
    expect(byLabel("Toggle dev menu")).not.toBeNull();

    action.update({ enabled: false });
    expect(dock()).toBeNull();

    action.update({ enabled: true });
    expect(dock()).not.toBeNull();

    action.destroy();
    expect(dock()).toBeNull();
  });
});

describe("default dev gating (no `enabled` passed)", () => {
  // Vitest runs with NODE_ENV=test and import.meta.env.DEV true, so the build
  // half of the gate is open unless stubbed; these cover the hostname half.
  // jsdom serves from "localhost".
  const servedFrom = (hostname: string) => vi.stubGlobal("location", { hostname });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders with no options at all when served from a dev host", () => {
    const inst = createDevDock();
    expect(dock()).not.toBeNull();
    inst.destroy();
  });

  it.each([
    "localhost",
    "my-app.localhost",
    "macbook.local",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "10.0.0.7",
    "172.16.4.2",
    "192.168.1.42",
    "", // file:// and friends
  ])("counts %s as a dev host", (hostname) => {
    servedFrom(hostname);
    const inst = createDevDock();
    expect(dock()).not.toBeNull();
    inst.destroy();
  });

  it.each([
    "app.example.com",
    "devdock-git-main.vercel.app",
    "staging.internal",
    "mylocalhost.com", // not a ".localhost" subdomain
    "localhost.evil.com",
    "8.8.8.8",
    "172.32.0.1", // just outside the private 172.16/12 range
  ])("stays hidden on %s, even in a dev build", (hostname) => {
    servedFrom(hostname);
    const inst = createDevDock();
    expect(dock()).toBeNull();
    inst.destroy();
  });

  it("devHostOnly: false drops the hostname check", () => {
    servedFrom("staging.example.com");
    const inst = createDevDock({ devHostOnly: false });
    expect(dock()).not.toBeNull();
    inst.destroy();
  });

  it("explicit `enabled` overrides the hostname check", () => {
    servedFrom("app.example.com");
    const inst = createDevDock({ enabled: true });
    expect(dock()).not.toBeNull();
    inst.destroy();

    const predicate = createDevDock({ enabled: () => true });
    expect(dock()).not.toBeNull();
    predicate.destroy();
  });

  it("re-checks the host gate on update()", () => {
    servedFrom("app.example.com");
    const inst = createDevDock();
    expect(dock()).toBeNull();
    inst.update({ devHostOnly: false });
    expect(dock()).not.toBeNull();
    inst.update({ devHostOnly: true });
    expect(dock()).toBeNull();
    inst.destroy();
  });
});

describe("the build half of the gate", () => {
  // Vitest backs `import.meta.env` with `process.env`, so the Vite flag is
  // always present here and `vi.stubEnv` is the only lever: the NODE_ENV
  // fallback only runs where reading `import.meta.env.DEV` throws, which this
  // environment can't reproduce.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides when Vite reports a production build", () => {
    vi.stubEnv("DEV", false);
    const inst = createDevDock();
    expect(dock()).toBeNull();
    inst.destroy();

    // Not the hostname check: dropping it changes nothing.
    const anyHost = createDevDock({ devHostOnly: false });
    expect(dock()).toBeNull();
    anyHost.destroy();
  });

  it("trusts Vite's flag over NODE_ENV", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("NODE_ENV", "development");
    const prod = createDevDock();
    expect(dock()).toBeNull();
    prod.destroy();

    vi.stubEnv("DEV", true);
    vi.stubEnv("NODE_ENV", "production");
    const dev = createDevDock();
    expect(dock()).not.toBeNull();
    dev.destroy();
  });

  it("explicit `enabled` overrides the build check", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("NODE_ENV", "production");
    const inst = createDevDock({ enabled: true });
    expect(dock()).not.toBeNull();
    inst.destroy();
  });

  it("re-checks the build gate on update()", () => {
    vi.stubEnv("DEV", false);
    const inst = createDevDock();
    expect(dock()).toBeNull();
    vi.stubEnv("DEV", true);
    inst.update({});
    expect(dock()).not.toBeNull();
    inst.destroy();
  });
});
