import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HOTKEY, createDevDock, formatHotkey, matchHotkey } from "../src/core";
import { byLabel, dialog, q, toggle } from "./shadow";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

/** jsdom reports an empty platform, so "mod" resolves to Ctrl unless stubbed. */
const onMac = () => vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");

const DEFAULT_CHORD = "{Alt>}{Shift>}d{/Shift}{/Alt}";

describe("the default hotkey", () => {
  it("toggles the panel with no hotkey option at all", async () => {
    const user = userEvent.setup();
    createDevDock({ enabled: true });

    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).not.toBeNull();
    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).toBeNull();
  });

  it("is the same chord on Mac, where it reads ⌥⇧D", async () => {
    onMac();
    const user = userEvent.setup();
    createDevDock({ enabled: true });

    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).not.toBeNull();
    expect(formatHotkey(DEFAULT_HOTKEY)).toBe("⌥⇧D");
  });

  it("ignores the near misses", async () => {
    const user = userEvent.setup();
    createDevDock({ enabled: true });

    await user.keyboard("{Alt>}d{/Alt}"); // no shift
    await user.keyboard("{Shift>}D{/Shift}"); // no alt
    await user.keyboard("{Alt>}{Shift>}f{/Shift}{/Alt}"); // wrong key
    await user.keyboard("{Control>}{Alt>}{Shift>}d{/Shift}{/Alt}{/Control}"); // extra mod
    expect(dialog()).toBeNull();
  });

  it("gives way to a custom spec", async () => {
    const user = userEvent.setup();
    createDevDock({ enabled: true, hotkey: "ctrl+k" });

    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).toBeNull();
    await user.keyboard("{Control>}k{/Control}");
    expect(dialog()).not.toBeNull();
  });

  it("claims no key when hotkey is null", async () => {
    const user = userEvent.setup();
    createDevDock({ enabled: true, hotkey: null });

    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).toBeNull();
    // The button still opens it.
    await user.click(toggle());
    expect(dialog()).not.toBeNull();
  });

  it("follows update()", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({ enabled: true });

    inst.update({ hotkey: null });
    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).toBeNull();

    inst.update({ hotkey: DEFAULT_HOTKEY });
    await user.keyboard(DEFAULT_CHORD);
    expect(dialog()).not.toBeNull();
  });

  it("is named in the heading, so it is discoverable", async () => {
    const user = userEvent.setup();
    createDevDock({ enabled: true });
    await user.click(toggle());

    const hint = q(".devdock-hotkey-hint")!;
    expect(hint.tagName).toBe("KBD");
    expect(hint.textContent).toBe("Alt+Shift+D");
    expect(hint.hidden).toBe(false);
    // The heading still reads as its title, hint aside.
    expect(q(".devdock-title")?.textContent).toBe("Dev MenuAlt+Shift+D");
    expect(dialog()?.getAttribute("aria-label")).toBe("Dev Menu");
  });

  it("drops the heading hint when there is no key to name", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({ enabled: true, hotkey: null });
    await user.click(toggle());
    expect(q(".devdock-hotkey-hint")?.hidden).toBe(true);

    // ...and brings it back when one is bound at runtime.
    inst.update({ hotkey: "mod+k" });
    expect(q(".devdock-hotkey-hint")?.hidden).toBe(false);
    expect(q(".devdock-hotkey-hint")?.textContent).toBe("Ctrl+K");
  });

  it("takes a class of yours on the hint", async () => {
    const user = userEvent.setup();
    createDevDock({ enabled: true, classNames: { hotkeyHint: "font-mono" } });
    await user.click(toggle());
    expect(q(".devdock-hotkey-hint")?.className).toBe(
      "devdock-hotkey-hint font-mono",
    );
  });

  it("is named on the button too, for when the panel is shut", () => {
    createDevDock({ enabled: true });
    expect(byLabel("Toggle dev menu")?.getAttribute("title")).toBe(
      "Dev Menu (Alt+Shift+D)",
    );
  });

  it("leaves the button's tooltip alone when there is no hotkey", () => {
    createDevDock({ enabled: true, hotkey: null, title: "Tools" });
    expect(byLabel("Toggle dev menu")?.getAttribute("title")).toBe("Tools");
  });
});

describe("matchHotkey with Alt held", () => {
  /** What macOS actually delivers: the composed character, not the letter. */
  const composed = (over: Partial<KeyboardEventInit>) =>
    new KeyboardEvent("keydown", { altKey: true, shiftKey: true, ...over });

  it("matches by physical key when the character is composed", () => {
    // ⌥⇧D on a US Mac layout.
    expect(matchHotkey("alt+shift+d", composed({ key: "Î", code: "KeyD" }))).toBe(true);
    expect(matchHotkey("alt+shift+d", composed({ key: "Ï", code: "KeyB" }))).toBe(false);
  });

  it("covers punctuation and digits too", () => {
    expect(matchHotkey("alt+.", new KeyboardEvent("keydown", {
      altKey: true, key: "≥", code: "Period",
    }))).toBe(true);
    expect(matchHotkey("alt+1", new KeyboardEvent("keydown", {
      altKey: true, key: "¡", code: "Digit1",
    }))).toBe(true);
  });

  it("still matches a named key by `key` when it has no code of its own", () => {
    expect(matchHotkey("alt+enter", new KeyboardEvent("keydown", {
      altKey: true, key: "Enter", code: "Enter",
    }))).toBe(true);
  });

  it("does not fall back to physical keys without Alt", () => {
    // AZERTY: the KeyQ cap types "a". ⌘A must not fire for ⌘Q.
    onMac();
    expect(matchHotkey("mod+a", new KeyboardEvent("keydown", {
      metaKey: true, key: "q", code: "KeyA",
    }))).toBe(false);
  });
});

describe("an empty spec", () => {
  it("matches nothing and formats to nothing", () => {
    expect(matchHotkey("", new KeyboardEvent("keydown", { key: "d" }))).toBe(false);
    expect(matchHotkey("+ +", new KeyboardEvent("keydown", { key: "d" }))).toBe(false);
    expect(formatHotkey("")).toBe("");
  });
});

describe("formatHotkey", () => {
  it("stacks glyphs on Mac", () => {
    onMac();
    expect(formatHotkey("alt+shift+d")).toBe("⌥⇧D");
    expect(formatHotkey("mod+.")).toBe("⌘.");
    expect(formatHotkey("alt+enter")).toBe("⌥enter");
  });

  it("spells the modifiers out elsewhere", () => {
    expect(formatHotkey("alt+shift+d")).toBe("Alt+Shift+D");
    expect(formatHotkey("mod+shift+k")).toBe("Ctrl+Shift+K");
  });
});
