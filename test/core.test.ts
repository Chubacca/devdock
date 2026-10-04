import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevDock } from "../src/core";
import { devdock } from "../src/svelte";
import {
  byLabel,
  dialog,
  filterInput,
  hostEl,
  rowWith,
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
