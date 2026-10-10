import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevDock } from "../src/core";
import { hostEl, inheritedStyles, toggle, viewHost } from "./shadow";

const addStyle = (css: string) => {
  const node = document.createElement("style");
  node.textContent = css;
  document.head.appendChild(node);
  return node;
};

const addLink = (href: string) => {
  const node = document.createElement("link");
  node.rel = "stylesheet";
  node.href = href;
  document.head.appendChild(node);
  return node;
};

const cssText = () =>
  inheritedStyles()
    .map((n) => n.textContent ?? "")
    .join("\n");

afterEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style, link").forEach((n) => n.remove());
  vi.unstubAllGlobals();
});

describe('shadow: "inherit"', () => {
  it("keeps the shadow root", () => {
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    expect(hostEl()!.shadowRoot).not.toBeNull();
    // Still invisible from the light DOM — isolation of *structure* is intact.
    expect(document.querySelector("[aria-label='Toggle dev menu']")).toBeNull();
    inst.destroy();
  });

  it("copies the document's <style> and <link> nodes into it", () => {
    addStyle(".app-card { color: rebeccapurple }");
    addLink("/app.css");
    const inst = createDevDock({ enabled: true, shadow: "inherit" });

    expect(cssText()).toContain(".app-card { color: rebeccapurple }");
    const link = inheritedStyles().find(
      (n) => n.tagName === "LINK",
    ) as HTMLLinkElement | undefined;
    expect(link?.getAttribute("href")).toBe("/app.css");
    inst.destroy();
  });

  it("copies document.adoptedStyleSheets", () => {
    // jsdom has no adoptedStyleSheets, so stand one up on the document.
    const sheet = new CSSStyleSheet();
    (document as unknown as { adoptedStyleSheets: unknown[] }).adoptedStyleSheets =
      [sheet];
    try {
      const inst = createDevDock({ enabled: true, shadow: "inherit" });
      const adopted = (
        hostEl()!.shadowRoot as ShadowRoot & { adoptedStyleSheets?: unknown[] }
      ).adoptedStyleSheets;
      expect(adopted).toEqual([sheet]);
      // A copy, not the document's own array.
      expect(adopted).not.toBe(
        (document as unknown as { adoptedStyleSheets: unknown[] })
          .adoptedStyleSheets,
      );
      inst.destroy();
    } finally {
      delete (document as unknown as { adoptedStyleSheets?: unknown[] })
        .adoptedStyleSheets;
    }
  });

  it("does not copy anything in the default isolated mode", () => {
    addStyle(".app-card { color: red }");
    const isolated = createDevDock({ enabled: true });
    expect(inheritedStyles()).toHaveLength(0);
    isolated.destroy();

    const explicit = createDevDock({ enabled: true, shadow: true });
    expect(inheritedStyles()).toHaveLength(0);
    explicit.destroy();
  });

  it("has nothing to copy into the light DOM", () => {
    addStyle(".app-card { color: red }");
    // `shadow: false` already renders where the page's CSS applies.
    const inst = createDevDock({ enabled: true, shadow: false });
    expect(hostEl()!.shadowRoot).toBeNull();
    inst.destroy();
  });

  it("picks up a stylesheet injected after mount", async () => {
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    expect(cssText()).not.toContain("lazy");

    addStyle(".lazy { color: red }");
    await vi.waitFor(() => expect(cssText()).toContain(".lazy { color: red }"));
    inst.destroy();
  });

  it("picks up an HMR edit to an existing stylesheet", async () => {
    const node = addStyle(".app { color: red }");
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    expect(cssText()).toContain("color: red");

    node.textContent = ".app { color: blue }";
    await vi.waitFor(() => expect(cssText()).toContain("color: blue"));
    expect(cssText()).not.toContain("color: red");
    inst.destroy();
  });

  it("drops a stylesheet removed from the document", async () => {
    const node = addStyle(".doomed { color: red }");
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    expect(cssText()).toContain(".doomed");

    node.remove();
    await vi.waitFor(() => expect(cssText()).not.toContain(".doomed"));
    inst.destroy();
  });

  it("re-syncs when the panel opens", async () => {
    const user = userEvent.setup();
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    // Bypass the observer to prove the open path syncs on its own.
    const node = document.createElement("style");
    node.textContent = ".late { color: red }";
    document.body.appendChild(node);

    await user.click(toggle());
    expect(cssText()).toContain(".late");
    node.remove();
    inst.destroy();
  });

  // Re-cloning a <link> makes the browser re-fetch it, which flashes the
  // views unstyled. An unrelated head mutation must not cost that.
  it("keeps the existing clones when nothing about the styles changed", async () => {
    addLink("/app.css");
    addStyle(".app { color: red }");
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    const before = inheritedStyles();
    expect(before).toHaveLength(2);

    const meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
    await Promise.resolve();
    await Promise.resolve();
    expect(inheritedStyles()).toEqual(before); // same nodes, not re-cloned

    meta.remove();
    inst.destroy();
  });

  it("stops observing the document after destroy", async () => {
    const inst = createDevDock({ enabled: true, shadow: "inherit" });
    const shadow = hostEl()!.shadowRoot!;
    inst.destroy();

    addStyle(".after-destroy { color: red }");
    await Promise.resolve();
    await Promise.resolve();
    expect(shadow.querySelectorAll("style")).toHaveLength(0);
  });

  it("lets a view use the page's CSS", async () => {
    const user = userEvent.setup();
    addStyle(".ds-button { padding: 8px }");
    const inst = createDevDock({
      enabled: true,
      shadow: "inherit",
      views: [
        {
          id: "v",
          mount: (host) => {
            const button = document.createElement("button");
            button.className = "ds-button";
            button.textContent = "Sign in";
            host.appendChild(button);
          },
        },
      ],
    });
    await user.click(toggle());

    const button = viewHost("v")!.querySelector(".ds-button");
    expect(button).not.toBeNull();
    // The rule the button needs is inside the same (shadow) tree it lives in.
    expect(cssText()).toContain(".ds-button");
    inst.destroy();
  });
});
