import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevDock } from "../src/core";
import { keyViews } from "../src/core/dock";
import { devdock } from "../src/svelte";
import type { DevView } from "../src/core";
import {
  dialog,
  filterInput,
  rowEls,
  toggle,
  viewHost,
  viewHosts,
  viewsSlot,
} from "./shadow";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A view that records its mount/teardown calls and writes some text. */
function probe(overrides: Partial<DevView> = {}) {
  const calls = { mount: 0, teardown: 0 };
  const view: DevView = {
    mount: (host) => {
      calls.mount += 1;
      host.textContent = `mounted ${calls.mount}`;
      return () => {
        calls.teardown += 1;
      };
    },
    ...overrides,
  };
  return { view, calls };
}

describe("custom views", () => {
  it("mounts on open and tears down on close", async () => {
    const user = userEvent.setup();
    const { view, calls } = probe({ id: "p" });
    const inst = createDevDock({ enabled: true, views: [view] });

    // Nothing is mounted while the panel is closed.
    expect(calls.mount).toBe(0);
    expect(viewHosts()).toHaveLength(0);

    await user.click(toggle());
    expect(calls.mount).toBe(1);
    expect(viewHost("p")!.textContent).toBe("mounted 1");

    await user.click(toggle());
    expect(calls.teardown).toBe(1);
    expect(viewHosts()).toHaveLength(0);

    // Reopening mounts it fresh.
    await user.click(toggle());
    expect(calls.mount).toBe(2);
    expect(calls.teardown).toBe(1);
    inst.destroy();
    expect(calls.teardown).toBe(2);
  });

  it("mounts with the host already connected to the document", async () => {
    const user = userEvent.setup();
    let connected: boolean | null = null;
    const inst = createDevDock({
      enabled: true,
      views: [{ mount: (host) => void (connected = host.isConnected) }],
    });
    await user.click(toggle());
    expect(connected).toBe(true);
    inst.destroy();
  });

  it("runs the teardown, so a rAF loop inside a view stops", async () => {
    const user = userEvent.setup();
    let frames = 0;
    const inst = createDevDock({
      enabled: true,
      views: [
        {
          id: "meter",
          mount: (host) => {
            let raf = requestAnimationFrame(function tick() {
              frames += 1;
              host.textContent = String(frames);
              raf = requestAnimationFrame(tick);
            });
            return () => cancelAnimationFrame(raf);
          },
        },
      ],
    });

    await user.click(toggle());
    await vi.waitFor(() => expect(frames).toBeGreaterThan(1));

    await user.click(toggle()); // close → teardown
    const stoppedAt = frames;
    await new Promise((r) => setTimeout(r, 50));
    expect(frames).toBe(stoppedAt);
    inst.destroy();
  });

  it("removes a listener a view added, after close and reopen", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    const view: DevView = {
      id: "listener",
      mount: () => {
        const onPing = () => seen.push("ping");
        window.addEventListener("devdock:ping", onPing);
        return () => window.removeEventListener("devdock:ping", onPing);
      },
    };
    const inst = createDevDock({ enabled: true, views: [view] });

    await user.click(toggle());
    window.dispatchEvent(new Event("devdock:ping"));
    expect(seen).toHaveLength(1);

    await user.click(toggle());
    window.dispatchEvent(new Event("devdock:ping"));
    expect(seen).toHaveLength(1); // torn down

    // Reopen: exactly one listener again, not two.
    await user.click(toggle());
    window.dispatchEvent(new Event("devdock:ping"));
    expect(seen).toHaveLength(2);

    inst.destroy();
    window.dispatchEvent(new Event("devdock:ping"));
    expect(seen).toHaveLength(2);
  });

  it("update() does not remount a view whose id is unchanged", async () => {
    const user = userEvent.setup();
    const { view, calls } = probe({ id: "stable" });
    const inst = createDevDock({ enabled: true, views: [view] });
    await user.click(toggle());
    const host = viewHost("stable");
    expect(calls.mount).toBe(1);

    // A brand-new options object, a new view object, the same id.
    inst.update({ views: [{ ...view }], title: "Renamed" });
    inst.update({ views: [{ ...view }] });
    expect(calls.mount).toBe(1);
    expect(calls.teardown).toBe(0);
    expect(viewHost("stable")).toBe(host); // same node, too
    inst.destroy();
  });

  it("does not remount when the routes/commands around it change", async () => {
    const user = userEvent.setup();
    const { view, calls } = probe({ id: "stable" });
    const inst = createDevDock({
      enabled: true,
      views: [view],
      commands: [{ label: "A", run: () => {} }],
    });
    await user.click(toggle());
    inst.update({ commands: [{ label: "B", run: () => {} }] });
    expect(rowEls()[0]!.textContent).toBe("B");
    expect(calls.mount).toBe(1);
    expect(calls.teardown).toBe(0);
    inst.destroy();
  });

  it("remounts when the id changes, and tears the old one down", async () => {
    const user = userEvent.setup();
    const first = probe({ id: "one" });
    const second = probe({ id: "two" });
    const inst = createDevDock({ enabled: true, views: [first.view] });
    await user.click(toggle());
    expect(first.calls.mount).toBe(1);

    inst.update({ views: [second.view] });
    expect(first.calls.teardown).toBe(1);
    expect(second.calls.mount).toBe(1);
    expect(viewHost("one")).toBeNull();
    expect(viewHost("two")).not.toBeNull();
    inst.destroy();
  });

  it("tears down a view dropped from the list, keeping its neighbour", async () => {
    const user = userEvent.setup();
    const a = probe({ id: "a" });
    const b = probe({ id: "b" });
    const inst = createDevDock({ enabled: true, views: [a.view, b.view] });
    await user.click(toggle());
    const hostA = viewHost("a");

    inst.update({ views: [a.view] });
    expect(b.calls.teardown).toBe(1);
    expect(a.calls.teardown).toBe(0);
    expect(a.calls.mount).toBe(1);
    expect(viewHost("a")).toBe(hostA);
    expect(viewHost("b")).toBeNull();
    inst.destroy();
  });

  it("mounts a view added by update() while the panel is open", async () => {
    const user = userEvent.setup();
    const a = probe({ id: "a" });
    const b = probe({ id: "b" });
    const inst = createDevDock({ enabled: true, views: [a.view] });
    await user.click(toggle());
    inst.update({ views: [a.view, b.view] });
    expect(b.calls.mount).toBe(1);
    expect(viewHost("b")!.textContent).toBe("mounted 1");
    inst.destroy();
  });

  it("tears views down when the dock is disabled at runtime", async () => {
    const user = userEvent.setup();
    const { view, calls } = probe({ id: "p" });
    const inst = createDevDock({ enabled: true, views: [view] });
    await user.click(toggle());
    expect(calls.mount).toBe(1);

    inst.update({ enabled: false });
    expect(calls.teardown).toBe(1);
    expect(dialog()).toBeNull();
    inst.destroy();
    expect(calls.teardown).toBe(1); // not torn down twice
  });

  it("places views before the list by default and after on request", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      commands: [{ label: "Reset", run: () => {} }],
      views: [
        { id: "top", mount: (h) => void (h.textContent = "top") },
        {
          id: "bottom",
          order: "after",
          mount: (h) => void (h.textContent = "bottom"),
        },
      ],
    });
    await user.click(toggle());
    expect(viewsSlot("before")!.textContent).toContain("top");
    expect(viewsSlot("after")!.textContent).toContain("bottom");

    // DOM order: before-views, then the list, then after-views.
    const order = viewHosts().map((h) => h.textContent);
    expect(order).toEqual(["top", "bottom"]);
    expect(
      viewHost("top")!.compareDocumentPosition(rowEls()[0]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      viewHost("bottom")!.compareDocumentPosition(rowEls()[0]!) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    inst.destroy();
  });

  it("moves a view between slots on update without remounting it", async () => {
    const user = userEvent.setup();
    const { view, calls } = probe({ id: "p" });
    const inst = createDevDock({ enabled: true, views: [view] });
    await user.click(toggle());
    const host = viewHost("p");
    expect(viewsSlot("before")!.contains(host!)).toBe(true);

    inst.update({ views: [{ ...view, order: "after" }] });
    expect(viewsSlot("after")!.contains(viewHost("p")!)).toBe(true);
    expect(viewHost("p")).toBe(host);
    expect(calls.mount).toBe(1);
    expect(calls.teardown).toBe(0);
    inst.destroy();
  });

  it("heads a view with its label, and groups views under one heading", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      views: [
        { id: "a", label: "Frame rate", mount: () => {} },
        { id: "b", group: "Session", label: "Status", mount: () => {} },
        { id: "c", group: "Session", label: "Device", mount: () => {} },
      ],
    });
    await user.click(toggle());
    const slot = viewsSlot("before")!;
    // One section per group: "Frame rate" (its own) and "Session" (two views).
    expect(slot.children).toHaveLength(2);
    expect(slot.children[0]!.textContent).toContain("Frame rate");
    const session = slot.children[1]!;
    expect(session.textContent).toContain("Session");
    expect(session.textContent).toContain("Status");
    expect(session.textContent).toContain("Device");
    expect(session.querySelectorAll("[data-devdock-view]")).toHaveLength(2);
    inst.destroy();
  });

  it("is unaffected by the filter box", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      commands: [{ label: "Reset", run: () => {} }],
      views: [{ id: "p", mount: (h) => void (h.textContent = "still here") }],
    });
    await user.click(toggle());
    await user.type(filterInput(), "zzz");
    expect(rowEls()).toHaveLength(0);
    expect(viewHost("p")!.textContent).toBe("still here");
    inst.destroy();
  });

  it("tolerates a view with no teardown", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      views: [{ id: "p", mount: (h) => void (h.textContent = "hi") }],
    });
    await user.click(toggle());
    expect(viewHost("p")!.textContent).toBe("hi");
    await user.click(toggle()); // must not throw
    expect(viewHosts()).toHaveLength(0);
    inst.destroy();
  });

  it("keys views by index when they have no id", async () => {
    const user = userEvent.setup();
    const a = probe();
    const b = probe();
    const inst = createDevDock({ enabled: true, views: [a.view, b.view] });
    await user.click(toggle());
    expect(viewHosts()).toHaveLength(2);
    expect(a.calls.mount).toBe(1);
    expect(b.calls.mount).toBe(1);
    inst.destroy();
  });

  it("flows through the svelte action's update path", () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const { view, calls } = probe({ id: "p" });

    const action = devdock(node, { enabled: true, views: [view] });
    toggle().click();
    expect(calls.mount).toBe(1);
    expect(viewHost("p")!.textContent).toBe("mounted 1");

    action.update({ enabled: true, views: [{ ...view }] });
    expect(calls.mount).toBe(1); // same id: not remounted

    action.update({ enabled: true, views: [] });
    expect(calls.teardown).toBe(1);
    expect(viewHosts()).toHaveLength(0);

    action.destroy();
  });
});

// `keyViews` is shared between the core and the adapters: both sides have to
// derive the same key for a view or a React portal lands in the wrong host.
describe("keyViews", () => {
  it("prefers the id, and falls back to the index", () => {
    expect(keyViews([{ id: "a" }, {}, { id: "c" }])).toEqual([
      { view: { id: "a" }, key: "a" },
      { view: {}, key: "#1" },
      { view: { id: "c" }, key: "c" },
    ]);
  });

  it("gives a view the same key wherever it sits, as long as it has an id", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const keyOf = (views: { id?: string }[], view: { id?: string }) =>
      keyViews(views).find((k) => k.view === view)!.key;
    expect(keyOf([a, b], a)).toBe(keyOf([b, a], a));
    // Without an id the key is positional, which is why reordering an
    // id-less list reassigns views to each other's hosts.
    const bare = {};
    expect(keyOf([bare, a], bare)).toBe("#0");
    expect(keyOf([a, bare], bare)).toBe("#1");
  });

  it("breaks a collision between duplicate ids", () => {
    const keys = keyViews([{ id: "x" }, { id: "x" }, { id: "x" }]).map(
      (k) => k.key,
    );
    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toBe("x");
  });

  it("breaks a collision between an id and an index key", () => {
    // An explicit id of "#1" would otherwise collide with the second view's
    // positional key.
    const keys = keyViews([{ id: "#1" }, {}]).map((k) => k.key);
    expect(new Set(keys).size).toBe(2);
  });

  it("handles an empty list", () => {
    expect(keyViews([])).toEqual([]);
  });
});

describe("view keys", () => {
  // Duplicate ids are a caller mistake; the dock must not let two views share
  // one host (and silently drop a teardown).
  it("keeps views apart when they share an id", async () => {
    const user = userEvent.setup();
    const a = probe({ id: "dupe" });
    const b = probe({ id: "dupe" });
    const inst = createDevDock({ enabled: true, views: [a.view, b.view] });
    await user.click(toggle());
    expect(a.calls.mount).toBe(1);
    expect(b.calls.mount).toBe(1);
    expect(viewHosts()).toHaveLength(2);

    inst.destroy();
    expect(a.calls.teardown).toBe(1);
    expect(b.calls.teardown).toBe(1);
  });
});
