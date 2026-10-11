import { describe, expect, it } from "vitest";
import {
  BASE_CSS,
  DEFAULT_LAYER,
  dockStyles,
  partClass,
  type DockPart,
} from "../src/core/theme";

/** Every `selector { … }` in the sheet, selectors only. */
const selectors = () =>
  [...BASE_CSS.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(([, sel]) => sel!.trim());

describe("dockStyles", () => {
  it("places the default layer against Tailwind's", () => {
    const css = dockStyles(DEFAULT_LAYER);
    expect(css).toContain(
      `@layer theme, base, components, ${DEFAULT_LAYER}, utilities;`,
    );
    expect(css).toContain(`@layer ${DEFAULT_LAYER} {`);
    expect(css).toContain(BASE_CSS);
  });

  it("leaves a layer you named for you to place", () => {
    const css = dockStyles("chrome");
    expect(css).toContain("@layer chrome {");
    // Ordering it against names the dock would be guessing at is how it ends
    // up under someone's reset.
    expect(css).not.toContain("@layer theme,");
  });

  it("emits the bare sheet with the layer off", () => {
    expect(dockStyles(false)).toBe(BASE_CSS);
  });
});

describe("BASE_CSS", () => {
  it("is worth exactly one class per rule", () => {
    // The discipline the whole `classNames` story rests on: one bare class,
    // everything else inside `:where()`. Anything heavier and a caller's
    // utility stops winning the tie when `cssLayer` is off.
    for (const selector of selectors()) {
      const bare = selector.replace(/:where\([^)]*\)/g, "");
      expect({ selector, classes: (bare.match(/\./g) ?? []).length }).toEqual({
        selector,
        classes: 1,
      });
      expect({ selector, heavier: /[[#]/.test(bare) }).toEqual({
        selector,
        heavier: false,
      });
    }
  });

  // Two parts carry no rule of their own, on purpose: `rowActive` is reached
  // through `[data-active]` instead of a class, and `buttonLabel` is a bare
  // hook — the span inherits everything from the button. Any other part
  // without a rule is a typo between `partClass` and the sheet.
  const unstyled: DockPart[] = ["rowActive", "buttonLabel"];

  it("styles every part it hands a class to", () => {
    for (const [part, cls] of Object.entries(partClass) as [
      DockPart,
      string,
    ][]) {
      if (unstyled.includes(part)) continue;
      expect({ part, styled: BASE_CSS.includes(`.${cls}`) }).toEqual({
        part,
        styled: true,
      });
    }
  });

  it("reaches the highlighted row without a class of its own", () => {
    expect(partClass.rowActive).toBe("");
    expect(BASE_CSS).toContain(".devdock-row:where([data-active])");
  });

  it("styles nothing a part doesn't name", () => {
    const known = new Set(Object.values(partClass));
    const used = new Set(
      [...BASE_CSS.matchAll(/\.(devdock-[\w-]+)/g)].map(([, cls]) => cls!),
    );
    for (const cls of used) {
      expect({ cls, reachable: known.has(cls) }).toEqual({
        cls,
        reachable: true,
      });
    }
  });
});
