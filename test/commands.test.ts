import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevDock } from "../src/core";
import { filterInput, rowEls, rowWith, toggle } from "./shadow";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("stateful commands", () => {
  it("reads a function label on open", async () => {
    const user = userEvent.setup();
    let theme = "Dark";
    const inst = createDevDock({
      enabled: true,
      commands: [{ id: "theme", label: () => `Theme: ${theme}`, run: () => {} }],
    });
    await user.click(toggle());
    expect(rowWith("Theme: Dark")).toBeTruthy();

    // Closed and reopened: the label is read again, not cached.
    await user.click(toggle());
    theme = "Light";
    await user.click(toggle());
    expect(rowWith("Theme: Dark")).toBeFalsy();
    expect(rowWith("Theme: Light")).toBeTruthy();
    inst.destroy();
  });

  // The whole point of the feature: a label that changes has to reach the DOM
  // through the *existing* node. Rebuilding the row would replace the node
  // under the pointer, and the browser then never dispatches a click on it.
  it("re-reads a function label on update without rebuilding the row", async () => {
    const user = userEvent.setup();
    let fps = 60;
    const inst = createDevDock({
      enabled: true,
      commands: [{ id: "fps", label: () => `FPS: ${fps}`, run: () => {} }],
    });
    await user.click(toggle());
    const [row] = rowEls();
    expect(row!.textContent).toBe("FPS: 60");

    fps = 42;
    inst.update({});
    expect(rowEls()[0]).toBe(row); // same node
    expect(row!.textContent).toBe("FPS: 42");
    inst.destroy();
  });

  it("still runs after its label changed", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    let n = 0;
    const inst = createDevDock({
      enabled: true,
      commands: [{ id: "tick", label: () => `Tick ${n}`, run }],
    });
    await user.click(toggle());
    const [row] = rowEls();
    n = 7;
    inst.update({});
    await user.click(row!);
    expect(run).toHaveBeenCalledOnce();
    inst.destroy();
  });

  it("filters on the resolved label", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      commands: [
        { id: "a", label: () => "Freeze animations", run: () => {} },
        { id: "b", label: "Reset", run: () => {} },
      ],
    });
    await user.click(toggle());
    await user.type(filterInput(), "freeze");
    expect(rowWith("Freeze animations")).toBeTruthy();
    expect(rowWith("Reset")).toBeFalsy();
    inst.destroy();
  });

  it("keeps rows apart when two share a dynamic label", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      commands: [
        { label: () => "Same", run: () => {} },
        { label: () => "Same", run: () => {} },
      ],
    });
    await user.click(toggle());
    expect(rowEls()).toHaveLength(2);
    inst.destroy();
  });
});

describe("checked commands", () => {
  const checkMark = (row: HTMLElement) => row.textContent?.includes("✓");

  it("renders a check mark and aria-checked", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      commands: [
        { id: "on", label: "Frozen", checked: () => true, run: () => {} },
        { id: "off", label: "Verbose", checked: () => false, run: () => {} },
      ],
    });
    await user.click(toggle());

    const on = rowWith("Frozen")!;
    const off = rowWith("Verbose")!;
    expect(on.getAttribute("role")).toBe("checkbox");
    expect(on.getAttribute("aria-checked")).toBe("true");
    expect(checkMark(on)).toBe(true);
    expect(off.getAttribute("aria-checked")).toBe("false");
    expect(checkMark(off)).toBe(false);
    inst.destroy();
  });

  it("a plain command stays a plain button", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      commands: [{ label: "Reset", run: () => {} }],
    });
    await user.click(toggle());
    const row = rowWith("Reset")!;
    expect(row.hasAttribute("role")).toBe(false);
    expect(row.hasAttribute("aria-checked")).toBe(false);
    inst.destroy();
  });

  it("flips on update without rebuilding the row", async () => {
    const user = userEvent.setup();
    let frozen = false;
    const inst = createDevDock({
      enabled: true,
      commands: [
        {
          id: "freeze",
          label: "Freeze animations",
          checked: () => frozen,
          run: () => {
            frozen = !frozen;
          },
        },
      ],
      // Keep the panel open so the toggle can be clicked repeatedly.
    });
    await user.click(toggle());
    const [row] = rowEls();
    expect(row!.getAttribute("aria-checked")).toBe("false");

    frozen = true;
    inst.update({});
    expect(rowEls()[0]).toBe(row);
    expect(row!.getAttribute("aria-checked")).toBe("true");
    expect(checkMark(row!)).toBe(true);

    frozen = false;
    inst.update({});
    expect(rowEls()[0]).toBe(row);
    expect(row!.getAttribute("aria-checked")).toBe("false");
    expect(checkMark(row!)).toBe(false);
    inst.destroy();
  });

  it("toggles through run() with keepOpen, reflecting the new state", async () => {
    const user = userEvent.setup();
    let frozen = false;
    const inst = createDevDock({
      enabled: true,
      commands: [
        {
          id: "freeze",
          label: () => (frozen ? "Unfreeze" : "Freeze"),
          checked: () => frozen,
          keepOpen: true,
          run: () => {
            frozen = !frozen;
            inst.update({});
          },
        },
      ],
    });
    await user.click(toggle());
    const [row] = rowEls();
    await user.click(row!);
    expect(rowEls()[0]).toBe(row);
    expect(row!.textContent).toContain("Unfreeze");
    expect(row!.getAttribute("aria-checked")).toBe("true");
    inst.destroy();
  });

  it("re-reads `checked` on reopen", async () => {
    const user = userEvent.setup();
    let frozen = false;
    const inst = createDevDock({
      enabled: true,
      commands: [
        { id: "f", label: "Freeze", checked: () => frozen, run: () => {} },
      ],
    });
    await user.click(toggle());
    expect(rowEls()[0]!.getAttribute("aria-checked")).toBe("false");
    await user.click(toggle());
    frozen = true;
    await user.click(toggle());
    expect(rowEls()[0]!.getAttribute("aria-checked")).toBe("true");
    inst.destroy();
  });
});
