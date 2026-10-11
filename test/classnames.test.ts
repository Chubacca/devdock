import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createDevDock } from "../src/core";
import {
  dialog,
  hostEl,
  q,
  rowEls,
  shell,
  toggle,
  viewHost,
} from "./shadow";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style, link").forEach((n) => n.remove());
});

const classes = (node: Element | null) => [...(node?.classList ?? [])];
const ownSheet = (within: ParentNode) =>
  within.querySelector("style[data-devdock-styles]");

describe("classNames (merged with cn)", () => {
  it("merges the caller's class onto the part's own", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      shadow: false,
      classNames: { root: "fixed-corner", button: "rounded-xl", panel: "w-96" },
    });

    expect(classes(shell())).toEqual(["devdock-root", "fixed-corner"]);
    expect(classes(toggle())).toEqual(["devdock-button", "rounded-xl"]);
    await user.click(toggle());
    expect(classes(dialog())).toEqual(["devdock-panel", "w-96"]);

    inst.destroy();
  });

  it("carries its own class on every part with nothing passed", () => {
    const inst = createDevDock({ enabled: true });
    expect(classes(shell())).toEqual(["devdock-root"]);
    expect(classes(toggle())).toEqual(["devdock-button"]);
    inst.destroy();
  });

  it("classes rows, and marks the highlighted one", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      shadow: false,
      routes: [
        { path: "/a", label: "A" },
        { path: "/b", label: "B" },
      ],
      classNames: { row: "px-3", rowActive: "bg-emerald-600" },
    });
    await user.click(toggle());

    const [first, second] = rowEls();
    expect(classes(first!)).toEqual(["devdock-row", "px-3", "bg-emerald-600"]);
    expect(classes(second!)).toEqual(["devdock-row", "px-3"]);

    await user.hover(second!);
    expect(classes(first!)).toEqual(["devdock-row", "px-3"]);
    expect(classes(second!)).toEqual(["devdock-row", "px-3", "bg-emerald-600"]);

    inst.destroy();
  });

  it("takes anything cn takes, so a wrapper can forward its props", async () => {
    const user = userEvent.setup();
    const compact = true;
    const muted = false;
    const forwarded: string | undefined = "shadow-lg";
    const inst = createDevDock({
      enabled: true,
      shadow: false,
      routes: [{ path: "/a", label: "A" }],
      classNames: {
        panel: ["bg-red-100", forwarded],
        row: ["px-3", compact && "py-1", { "opacity-50": muted }],
        // A falsy entry drops out rather than landing as "false"/"undefined".
        title: [undefined, null, false, ""],
      },
    });
    await user.click(toggle());

    expect(classes(dialog())).toEqual([
      "devdock-panel",
      "bg-red-100",
      "shadow-lg",
    ]);
    expect(classes(rowEls()[0]!)).toEqual(["devdock-row", "px-3", "py-1"]);
    expect(classes(q(".devdock-title"))).toEqual(["devdock-title"]);

    inst.destroy();
  });

  it("settles a Tailwind conflict in favour of the later class", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      shadow: false,
      routes: [
        { path: "/a", label: "A" },
        { path: "/b", label: "B" },
      ],
      classNames: {
        row: "px-3 text-slate-700",
        rowActive: "px-1 text-emerald-900",
      },
    });
    await user.click(toggle());

    // Both classes in the attribute would leave the stylesheet's order to
    // decide, which isn't ours; the merge drops the one that lost.
    expect(classes(rowEls()[0]!)).toEqual([
      "devdock-row",
      "px-1",
      "text-emerald-900",
    ]);
    expect(classes(rowEls()[1]!)).toEqual([
      "devdock-row",
      "px-3",
      "text-slate-700",
    ]);
    // The dock's own classes are not Tailwind, and pass through untouched.
    expect(classes(q(".devdock-button"))).toEqual(["devdock-button"]);

    inst.destroy();
  });

  it("picks up a class change through update(), panel open", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      shadow: false,
      routes: [{ path: "/a", label: "A" }],
      classNames: { panel: "w-96", row: "px-3" },
    });
    await user.click(toggle());

    inst.update({ classNames: { panel: "w-72", row: "px-1" } });
    expect(classes(dialog())).toEqual(["devdock-panel", "w-72"]);
    expect(classes(rowEls()[0]!)).toEqual(["devdock-row", "px-1"]);

    inst.destroy();
  });

  it("classes a view's host and its section", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({
      enabled: true,
      shadow: false,
      views: [{ id: "meter", label: "Meter", mount: () => {} }],
      classNames: { view: "p-0", section: "mt-4", group: "text-pink-500" },
    });
    await user.click(toggle());

    expect(classes(viewHost("meter"))).toEqual(["devdock-view", "p-0"]);
    const section = viewHost("meter")!.closest(".devdock-section");
    expect(classes(section)).toEqual(["devdock-section", "mt-4"]);
    expect(classes(section!.querySelector(".devdock-group"))).toEqual([
      "devdock-group",
      "text-pink-500",
    ]);

    inst.destroy();
  });

  it("inherits the page's styles by default when classNames is passed", () => {
    const inst = createDevDock({ enabled: true, classNames: { row: "px-3" } });
    const shadow = hostEl()!.shadowRoot!;
    // `shadow: "inherit"` is what makes a page-defined class reach the dock.
    expect(shadow.querySelector("div[style*='contents']")).not.toBeNull();
    inst.destroy();
  });

  it("still obeys an explicit shadow alongside classNames", () => {
    const isolated = createDevDock({
      enabled: true,
      shadow: true,
      classNames: { row: "px-3" },
    });
    const shadow = hostEl()!.shadowRoot!;
    expect(shadow.querySelector("div[style*='contents']")).toBeNull();
    isolated.destroy();

    const light = createDevDock({
      enabled: true,
      shadow: false,
      classNames: { row: "px-3" },
    });
    expect(hostEl()!.shadowRoot).toBeNull();
    light.destroy();
  });
});

describe("custom properties", () => {
  const sheet = () => ownSheet(hostEl()!.shadowRoot!)!.textContent!;

  it("reads every themeable value from one, with the default as fallback", () => {
    const inst = createDevDock({ enabled: true });
    const css = sheet();
    for (const [token, fallback] of [
      ["--devdock-bg", "#16181d"],
      ["--devdock-fg", "#e7e9ee"],
      ["--devdock-muted", "#8b909c"],
      ["--devdock-subtle", "#6b7280"],
      ["--devdock-border", "#2a2e37"],
      ["--devdock-accent", "#2563eb"],
      ["--devdock-accent-fg", "#e7e9ee"],
      ["--devdock-button-bg", "#111317"],
      ["--devdock-button-fg", "#fff"],
      ["--devdock-input-bg", "#0f1115"],
      ["--devdock-success", "#22c55e"],
      ["--devdock-radius", "12px"],
      ["--devdock-radius-sm", "8px"],
      ["--devdock-width", "280px"],
      ["--devdock-max-height", "70vh"],
    ]) {
      expect(css).toContain(`var(${token}, ${fallback})`);
      // Declaring a default inside the shadow tree would beat the value the
      // page inherits in, which is the whole mechanism.
      expect(css).not.toContain(`${token}:`);
    }
    inst.destroy();
  });

  it("steps the active row's path back from the row's own colour", () => {
    const inst = createDevDock({ enabled: true });
    // Not from the accent token: `currentColor` tracks whatever set the row's
    // colour, so a token and a utility class both carry the path with them.
    expect(sheet()).toContain(
      "color-mix(in oklab, currentColor 75%, transparent)",
    );
    inst.destroy();
  });

  it("themes the dock in the isolated default mode, no stylesheet needed", () => {
    // Nothing here depends on `shadow` or `classNames`: custom properties
    // inherit through the boundary, so this reaches an isolated dock.
    const inst = createDevDock({ enabled: true });
    expect(hostEl()!.shadowRoot).not.toBeNull();
    expect(sheet()).toContain("var(--devdock-accent, #2563eb)");
    inst.destroy();
  });
});

describe("the dock's own stylesheet", () => {
  it("goes into the shadow root, ahead of the inherited clones", () => {
    const style = document.createElement("style");
    style.textContent = ".page { color: red }";
    document.head.appendChild(style);

    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    const shadow = hostEl()!.shadowRoot!;
    const sheets = [...shadow.querySelectorAll("style")];
    // Ours first: a tie on specificity then goes to the page's rule.
    expect(sheets[0]!.hasAttribute("data-devdock-styles")).toBe(true);
    expect(sheets.map((n) => n.textContent)).toContain(".page { color: red }");

    inst.destroy();
    style.remove();
  });

  it("goes to the top of <head> in light-DOM mode, and leaves on destroy", () => {
    const page = document.createElement("style");
    page.textContent = ".page { color: red }";
    document.head.appendChild(page);

    const inst = createDevDock({ enabled: true, shadow: false });
    expect(document.head.firstElementChild).toBe(ownSheet(document.head));

    inst.destroy();
    expect(ownSheet(document.head)).toBeNull();
    page.remove();
  });

  it("is not cloned back in as an inherited page style", () => {
    const light = createDevDock({ enabled: true, shadow: false });
    const inheriting = createDevDock({ enabled: true, shadow: "inherit" });

    const shadow = [...document.querySelectorAll("[data-devdock]")]
      .map((h) => (h as HTMLElement).shadowRoot)
      .find((sr) => sr !== null)!;
    expect(shadow.querySelectorAll("style[data-devdock-styles]")).toHaveLength(
      1,
    );

    inheriting.destroy();
    light.destroy();
  });

  it("sits its layer after Tailwind's base and before its utilities", () => {
    const inst = createDevDock({ enabled: true });
    const css = ownSheet(hostEl()!.shadowRoot!)!.textContent!;
    // Layered rules lose to unlayered ones whatever the specificity, so the
    // order statement is what lets a utility class through — and keeps a
    // reset in `base` from stripping the dock.
    expect(css).toContain(
      "@layer theme, base, components, devdock, utilities;",
    );
    expect(css).toContain("@layer devdock {");
    inst.destroy();
  });

  it("takes a layer name, and leaves that one for you to place", () => {
    const named = createDevDock({ enabled: true, cssLayer: "chrome" });
    const css = ownSheet(hostEl()!.shadowRoot!)!.textContent!;
    expect(css).toContain("@layer chrome {");
    // No order statement: the dock would only be guessing at the names
    // around it, and guessing wrong puts it under the page's reset.
    expect(css).not.toContain("@layer theme,");
    named.destroy();

    // Unlayered, for a page whose own CSS is unlayered (Tailwind v3): the
    // sheet then competes on specificity and order, which it is built for.
    const unlayered = createDevDock({ enabled: true, cssLayer: false });
    const bare = ownSheet(hostEl()!.shadowRoot!)!.textContent!;
    expect(bare).not.toContain("@layer");
    expect(bare).toContain(".devdock-panel {");
    unlayered.destroy();
  });

  it("styles the dock without any class plumbing", () => {
    const inst = createDevDock({ enabled: true });
    const css = ownSheet(hostEl()!.shadowRoot!)!.textContent!;
    // One bare class per rule: a page reset loses, a caller's class ties and
    // wins on order. The panel's height is viewport-relative and uncapped,
    // and every themeable value is a custom property with that as its
    // fallback — never a declaration, which would outrank the page's.
    expect(css).toContain("max-height: var(--devdock-max-height, 70vh)");
    expect(css).not.toContain("--devdock-max-height:");
    expect(css).toContain('.devdock-button:where([aria-expanded="true"])');
    expect(css).toContain(".devdock-row:where([data-active])");
    inst.destroy();
  });
});
