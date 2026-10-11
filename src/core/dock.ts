import { cn } from "cn";
import { DEFAULT_HOTKEY, formatHotkey, matchHotkey } from "./hotkey";
import {
  DEFAULT_LAYER,
  STYLE_MARKER,
  dockStyles,
  partClass,
  type DockPart,
} from "./theme";
import type {
  DevCommand,
  DevDockInstance,
  DevDockOptions,
  DevRoute,
  DevView,
  DockPosition,
} from "./types";

/**
 * Vite's own build-time flag. The Vite family (Vite, SvelteKit, React Router
 * 7, Astro…) statically replaces the full `import.meta.env.DEV` token with a
 * literal, so this collapses to a constant there. Anywhere else the read
 * throws — `import.meta.env` is undefined in plain Node and in our CJS build,
 * where esbuild rewrites `import.meta` to `{}` — and we report "no opinion"
 * so the caller can fall back to `NODE_ENV`.
 */
const viteDevFlag = (): boolean | undefined => {
  try {
    if (typeof import.meta.env.DEV === "boolean") return import.meta.env.DEV;
  } catch {
    // Not a Vite-built bundle.
  }
  return undefined;
};

const isDevBuild = (): boolean => {
  // Vite knows better than NODE_ENV: `vite build` leaves NODE_ENV unreplaced
  // in some setups, and its dev server is a dev build regardless of NODE_ENV.
  const vite = viteDevFlag();
  if (vite !== undefined) return vite;
  // Bundlers (webpack, Next, esbuild…) statically replace the full
  // `process.env.NODE_ENV` token, even in browser builds where `process`
  // itself is undefined. Reading it directly lets that replacement work;
  // the try/catch covers runtimes where it's left as a real (missing) global.
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

/** Loopback IPv4 (127/8) and the private LAN ranges 10/8, 172.16/12, 192.168/16. */
const isLocalIPv4 = (host: string): boolean => {
  const parts = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!parts) return false;
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
};

/**
 * Whether the page is served from a developer's own machine. The build check
 * alone can't tell: a development build deployed somewhere real (a preview
 * URL, a staging box) still reports itself as a dev build.
 *
 * Dev hosts are loopback, mDNS `.local` names, and private LAN addresses — so
 * hitting the dev server from a phone on the same Wi-Fi still counts. Any
 * other hostname is treated as a deployed site.
 */
const isDevHost = (): boolean => {
  if (typeof location === "undefined") return true;
  // IPv6 literals arrive bracketed, e.g. "[::1]".
  const host = location.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // No hostname at all (file://, about:blank…) is not a deployed site.
  if (!host) return true;
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    isLocalIPv4(host)
  );
};

/**
 * A row in the list, resolved for this render. `label` and `checked` are
 * snapshots of whatever the caller's functions returned just now, while `sig`
 * is deliberately stable across those values — see {@link itemSig}.
 */
type Item = {
  key: string;
  label: string;
  group: string;
  /** Identity of the row's *shape*, not its live values. */
  sig: string;
} & (
  | { kind: "route"; route: DevRoute }
  | { kind: "command"; checked: boolean | null; command: DevCommand }
);

type Styles = Partial<CSSStyleDeclaration>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Partial<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) Object.assign(node, props);
  return node;
}

/** Every part `classNames` can address, in a fixed order. */
const PARTS = Object.keys(partClass) as DockPart[];

function cornerStyle(position: DockPosition): Styles {
  const gap = "16px";
  switch (position) {
    case "bottom-left":
      return { bottom: gap, left: gap };
    case "top-left":
      return { top: gap, left: gap };
    case "top-right":
      return { top: gap, right: gap };
    default:
      return { bottom: gap, right: gap };
  }
}

function panelAnchor(position: DockPosition): Styles {
  const isTop = position.startsWith("top");
  const isRight = position.endsWith("right");
  return {
    position: "absolute",
    [isTop ? "top" : "bottom"]: "calc(100% + 8px)",
    [isRight ? "right" : "left"]: "0",
  } as Styles;
}

/**
 * Pair each view with the key it is reconciled by: its `id`, or its index.
 * Duplicate ids are a caller mistake, but a silent one — two views sharing a
 * key would share a host element, so the collision is broken here instead.
 *
 * Generic over the view shape because the adapters have their own (React's
 * takes `render` in place of `mount`) and have to key their side of a view —
 * a portal, say — exactly the way the core keys its host. Not public API.
 *
 * @internal
 */
export function keyViews<T extends { id?: string }>(
  views: readonly T[],
): { view: T; key: string }[] {
  const used = new Set<string>();
  return views.map((view, i) => {
    let key = view.id ?? `#${i}`;
    while (used.has(key)) key = `${key}#${i}`;
    used.add(key);
    return { view, key };
  });
}

/**
 * Create a framework-agnostic dev dock: a floating button that opens a popup
 * to jump between routes and run commands. Returns a handle to update its
 * options or tear it down. No-ops on the server (when there is no `document`).
 */
export function createDevDock(initial: DevDockOptions = {}): DevDockInstance {
  if (typeof document === "undefined") {
    return { update() {}, destroy() {} };
  }

  let opts: DevDockOptions = { ...initial };
  /**
   * A part's classes: the `devdock-*` one it always carries, then whatever
   * the caller passed for it. Read from `opts` at paint time, so `update()`
   * can change a class without rebuilding anything.
   *
   * `cn` rather than a plain join, because the merge is between Tailwind
   * classes and the last one has to win: `rowActive: "text-emerald-900"` over
   * `row: "text-slate-700"` is a conflict the class attribute can't settle on
   * its own — the stylesheet's order decides, and that isn't ours.
   */
  const cls = (...parts: DockPart[]): string =>
    cn(parts.map((part) => [partClass[part], opts.classNames?.[part]]));
  /**
   * Identity of the caller's classes, folded into the signatures that decide
   * whether the per-render DOM (rows, sections, view wrappers) is reusable.
   */
  const classSig = (): string =>
    PARTS.map((p) => cn(opts.classNames?.[p])).join("\u0000");

  let open = false;
  let query = "";
  let active = 0;
  let mounted = false;

  // Light-DOM host that gets appended to the page. When shadow DOM is used,
  // the actual UI lives inside its shadow root — fully isolated from the host
  // page's CSS. `data-devdock` stays on the host so it's discoverable.
  const host = el("div");
  host.setAttribute("data-devdock", "");
  // Classes are defined by a stylesheet of the caller's, which an isolated
  // shadow root would keep out — so passing `classNames` flips the default to
  // `"inherit"`. An explicit `shadow` still wins.
  const shadowMode = initial.shadow ?? (initial.classNames ? "inherit" : true);
  const useShadow =
    shadowMode !== false && typeof host.attachShadow === "function";
  const shadowRoot = useShadow ? host.attachShadow({ mode: "open" }) : null;
  const mountPoint: Node = shadowRoot ?? host;

  // The dock's own styles. They go in *first* — ahead of the inherited clones
  // below, at the top of `<head>` in light-DOM mode — because that is what
  // fixes the cascade layer order, and what settles a specificity tie in the
  // caller's favour. See `dockStyles`.
  const baseStyle = el("style", {
    textContent: dockStyles(initial.cssLayer ?? DEFAULT_LAYER),
  });
  baseStyle.setAttribute(STYLE_MARKER, "");
  if (shadowRoot) mountPoint.appendChild(baseStyle);

  // `shadow: "inherit"` keeps the isolation boundary but copies the page's
  // styles across it, so a view can render the host app's own components.
  // The clones live in one wrapper so re-syncing is a single replaceChildren;
  // `display: contents` keeps it out of the layout.
  const styleSlot = shadowRoot && shadowMode === "inherit" ? el("div") : null;
  if (styleSlot) {
    styleSlot.style.display = "contents";
    mountPoint.appendChild(styleSlot);
  }

  const root = el("div");
  mountPoint.appendChild(root);

  const panel = el("div");
  panel.setAttribute("role", "dialog");

  // The heading is a row: the title, and the shortcut as a key cap. A tooltip
  // on the button only pays off for someone hovering a button they were about
  // to click, so the hint goes where it is read instead.
  const heading = el("div");
  const headingText = el("span");
  const hotkeyHint = el("kbd");
  heading.append(headingText, hotkeyHint);

  const inputWrap = el("div");
  const input = el("input");
  input.placeholder = "Filter…";
  inputWrap.appendChild(input);

  const list = el("div");
  list.setAttribute("data-devdock-list", "");

  const viewsBefore = el("div");
  viewsBefore.setAttribute("data-devdock-views", "before");
  const viewsAfter = el("div");
  viewsAfter.setAttribute("data-devdock-views", "after");

  // One scroller around the views and the list, so a tall view can't push the
  // panel past its max height.
  const body = el("div");
  body.append(viewsBefore, list, viewsAfter);

  panel.append(heading, inputWrap, body);

  const button = el("button");
  button.type = "button";
  button.setAttribute("aria-label", "Toggle dev menu");
  const dot = el("span");
  const buttonLabel = el("span");
  button.append(dot, buttonLabel);

  root.appendChild(button);

  /** The small uppercase heading above a group of rows, or above a view. */
  const sectionHeading = (text: string) =>
    el("div", { className: cls("group"), textContent: text });

  /** A view's own label, when several views share one `group` heading. */
  const viewLabel = (text: string) =>
    el("div", { className: cls("viewLabel"), textContent: text });

  /** Classes for the parts that live as long as the dock does. */
  const paintClasses = () => {
    root.className = cls("root");
    button.className = cls("button");
    dot.className = cls("dot");
    buttonLabel.className = cls("buttonLabel");
    panel.className = cls("panel");
    heading.className = cls("title");
    hotkeyHint.className = cls("hotkeyHint");
    inputWrap.className = cls("inputWrap");
    input.className = cls("input");
    body.className = cls("body");
    list.className = cls("list");
  };

  // ---- behavior ---------------------------------------------------------

  /**
   * The toggle shortcut. Unset means the default; `null` (or an empty string)
   * means the dock claims no key at all.
   */
  const hotkey = (): string | null =>
    opts.hotkey === undefined ? DEFAULT_HOTKEY : opts.hotkey;

  const enabled = (): boolean => {
    const e = opts.enabled;
    if (typeof e === "function") return e();
    if (e != null) return e;
    // Default gate: a dev build, served from a dev machine. `devHostOnly:
    // false` keeps the build check but allows any hostname.
    return isDevBuild() && (opts.devHostOnly === false || isDevHost());
  };

  const navigate = (path: string) => {
    if (opts.onNavigate) opts.onNavigate(path);
    else if (typeof window !== "undefined") window.location.assign(path);
  };

  const buildItems = (): Item[] => {
    const out: Item[] = [];
    (opts.routes ?? []).forEach((r, i) => {
      const key = `route:${r.path}:${i}`;
      const label = r.label ?? r.path;
      out.push({
        kind: "route",
        key,
        label,
        group: r.group ?? "Routes",
        sig: [key, r.group ?? "Routes", label, r.path].join("\u0000"),
        route: r,
      });
    });
    (opts.commands ?? []).forEach((c, i) => {
      // A function label is read fresh here, on every render of the open
      // panel. The row's signature uses a placeholder in its place so the new
      // text lands on the existing node instead of rebuilding the list — see
      // `renderList`. The same goes for `checked`: its presence is part of the
      // shape, its value isn't.
      const live = typeof c.label === "function";
      const label = typeof c.label === "function" ? c.label() : c.label;
      const checked = c.checked ? c.checked() === true : null;
      const key = `cmd:${c.id ?? (live ? "" : label)}:${i}`;
      const group = c.group ?? "Commands";
      out.push({
        kind: "command",
        key,
        label,
        group,
        sig: [
          key,
          group,
          live ? "\u0000live" : label,
          checked === null ? "" : "\u0000checkable",
        ].join("\u0000"),
        checked,
        command: c,
      });
    });
    return out;
  };

  const getFiltered = (): Item[] => {
    const q = query.trim().toLowerCase();
    const items = buildItems();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.kind === "route" && it.route.path.toLowerCase().includes(q)),
    );
  };

  const runItem = async (it: Item) => {
    if (it.kind === "route") {
      navigate(it.route.path);
      setOpen(false);
      return;
    }
    try {
      await it.command.run();
    } finally {
      if (!it.command.keepOpen) setOpen(false);
    }
  };

  type Row = {
    item: Item;
    node: HTMLButtonElement;
    labelSpan: HTMLSpanElement;
    pathSpan: HTMLSpanElement | null;
    checkSpan: HTMLSpanElement | null;
  };

  // The rendered rows, parallel to the current filtered list. They are kept
  // around so hovering or arrowing only repaints the highlight: rebuilding the
  // rows would destroy the node under the pointer, and the browser then never
  // dispatches a `click` on it (mousedown/mouseup retarget to the parent).
  let rows: Row[] = [];
  // Signature of the item list the rows were built from; identical signature
  // means the existing nodes can be reused as-is.
  let rowsSig: string | null = null;

  // Identity of a row's *shape*. Values that can change between renders
  // without changing the shape — a function `label`'s text, a `checked`
  // state — are excluded on purpose: those are written onto the existing node
  // by `paintRow`, because rebuilding the row would destroy the node under
  // the pointer and swallow the click.
  const itemSig = (it: Item): string => it.sig;

  /** Write a row's live values (dynamic label, check mark) onto its node. */
  const paintRow = (row: Row) => {
    const it = row.item;
    if (row.labelSpan.textContent !== it.label)
      row.labelSpan.textContent = it.label;
    if (row.checkSpan && it.kind === "command") {
      const on = it.checked === true;
      row.checkSpan.textContent = on ? "\u2713" : "";
      row.node.setAttribute("aria-checked", String(on));
    }
  };

  // The highlight is an attribute, not an inline colour: that keeps it in the
  // stylesheet, where `classNames.rowActive` (or a rule of your own on
  // `.devdock-row[data-active]`) can take it over.
  const paintActive = () => {
    rows.forEach((row, idx) => {
      const isActive = idx === active;
      if (isActive) row.node.setAttribute("data-active", "");
      else row.node.removeAttribute("data-active");
      row.node.className = isActive ? cls("row", "rowActive") : cls("row");
    });
  };

  const setActive = (next: number, scroll = false) => {
    if (next === active || next < 0 || next >= rows.length) return;
    active = next;
    paintActive();
    // `scrollIntoView` is absent in jsdom, hence the optional call.
    if (scroll) rows[active]?.node.scrollIntoView?.({ block: "nearest" });
  };

  const renderList = () => {
    const filtered = getFiltered();
    active = Math.min(active, Math.max(0, filtered.length - 1));

    const sig = [classSig(), ...filtered.map(itemSig)].join("\n");
    if (sig === rowsSig) {
      // Same items in the same order: keep the nodes, refresh the highlight.
      // The items themselves are rebuilt on every call, so re-point each row
      // at its current one (its `run`/`route` may have been swapped by
      // `update()`).
      filtered.forEach((it, idx) => {
        const row = rows[idx];
        if (!row) return;
        row.item = it;
        paintRow(row);
      });
      paintActive();
      return;
    }
    rowsSig = sig;
    rows = [];
    list.replaceChildren();

    if (filtered.length === 0) {
      list.appendChild(
        el("div", { className: cls("empty"), textContent: "Nothing here." }),
      );
      return;
    }

    const groups = new Map<string, Item[]>();
    for (const it of filtered) {
      const arr = groups.get(it.group) ?? [];
      arr.push(it);
      groups.set(it.group, arr);
    }

    for (const [groupName, groupItems] of groups) {
      const section = el("div", { className: cls("section") });
      section.appendChild(sectionHeading(groupName));

      for (const it of groupItems) {
        const idx = filtered.indexOf(it);
        const row = el("button", { className: cls("row") });
        row.type = "button";

        const labelSpan = el("span", { className: cls("rowLabel") });
        row.appendChild(labelSpan);

        let pathSpan: HTMLSpanElement | null = null;
        if (it.kind === "route" && it.route.path !== it.label) {
          pathSpan = el("span", {
            className: cls("rowPath"),
            textContent: it.route.path,
          });
          row.appendChild(pathSpan);
        }

        // A command with `checked` is a toggle, not a one-shot action: say so
        // to assistive tech, and keep the mark's box reserved either way so
        // the label doesn't shift when it flips.
        let checkSpan: HTMLSpanElement | null = null;
        if (it.kind === "command" && it.checked !== null) {
          row.setAttribute("role", "checkbox");
          checkSpan = el("span", { className: cls("check") });
          row.appendChild(checkSpan);
        }

        const rec: Row = { item: it, node: row, labelSpan, pathSpan, checkSpan };
        rows[idx] = rec;
        paintRow(rec);

        row.addEventListener("mouseenter", () => setActive(idx));
        row.addEventListener("click", () => void runItem(rec.item));
        section.appendChild(row);
      }
      list.appendChild(section);
    }

    paintActive();
  };

  // ---- views -------------------------------------------------------------

  type MountedView = { host: HTMLElement; teardown?: () => void };

  // Views live only while the panel is open: `setOpen(true)` mounts them and
  // `setOpen(false)` runs their teardowns, which is what makes a rAF loop or
  // an event listener inside a view correct rather than a leak.
  const mountedViews = new Map<string, MountedView>();
  // Shape of the view list the current DOM was built from — keys, placement
  // and headings, but nothing a view renders itself. An `update()` that
  // leaves this unchanged is a no-op, so a view is never remounted (or even
  // reparented) just because the options object is new.
  let viewsSig: string | null = null;

  type KeyedView = { view: DevView; key: string };

  const viewOrder = (v: DevView): "before" | "after" =>
    v.order === "after" ? "after" : "before";

  const unmountViews = () => {
    for (const mv of mountedViews.values()) {
      mv.teardown?.();
      mv.host.remove();
    }
    mountedViews.clear();
    viewsBefore.replaceChildren();
    viewsAfter.replaceChildren();
    viewsSig = null;
  };

  const renderViews = () => {
    const keyed = keyViews(opts.views ?? []);
    const sig = [
      classSig(),
      ...keyed.map(({ view, key }) =>
        [key, viewOrder(view), view.group ?? "", view.label ?? ""].join(
          "\u0000",
        ),
      ),
    ].join("\n");
    if (sig === viewsSig) return;
    viewsSig = sig;

    const live = new Set(keyed.map(({ key }) => key));
    for (const [key, mv] of mountedViews) {
      if (live.has(key)) continue;
      mv.teardown?.();
      mv.host.remove();
      mountedViews.delete(key);
    }

    viewsBefore.replaceChildren();
    viewsAfter.replaceChildren();

    // Hosts are appended first and mounted afterwards, so `mount` is handed a
    // host that is already connected to the document.
    const pending: (KeyedView & { host: HTMLElement })[] = [];

    for (const placement of ["before", "after"] as const) {
      const container = placement === "before" ? viewsBefore : viewsAfter;
      const here = keyed.filter(({ view }) => viewOrder(view) === placement);

      // One section per `group`, in first-appearance order; a view without a
      // group gets its own section headed by its `label`.
      const sections = new Map<
        string,
        { heading?: string; items: KeyedView[] }
      >();
      for (const entry of here) {
        const groupKey = entry.view.group ?? `\u0000${entry.key}`;
        const section = sections.get(groupKey);
        if (section) section.items.push(entry);
        else
          sections.set(groupKey, {
            heading: entry.view.group ?? entry.view.label,
            items: [entry],
          });
      }

      for (const section of sections.values()) {
        const wrap = el("div", { className: cls("section") });
        if (section.heading) wrap.appendChild(sectionHeading(section.heading));
        for (const { view, key } of section.items) {
          if (view.group != null && view.label)
            wrap.appendChild(viewLabel(view.label));
          const existing = mountedViews.get(key);
          if (existing) {
            wrap.appendChild(existing.host);
            continue;
          }
          const viewHost = el("div", { className: cls("view") });
          viewHost.setAttribute("data-devdock-view", view.id ?? "");
          wrap.appendChild(viewHost);
          pending.push({ view, key, host: viewHost });
        }
        container.appendChild(wrap);
      }
    }

    for (const { view, key, host: viewHost } of pending) {
      const mv: MountedView = { host: viewHost };
      mountedViews.set(key, mv);
      const teardown = view.mount(viewHost);
      if (typeof teardown === "function") mv.teardown = teardown;
    }
  };

  // ---- inherited styles --------------------------------------------------

  // What the current clones were made from, so an unrelated head mutation
  // doesn't re-clone every <link> (and make the browser re-fetch it).
  let clonesSig: string | null = null;

  /**
   * Copy the document's styles into the shadow root (`shadow: "inherit"`).
   * Constructed sheets come across by reference; `<style>` and
   * `<link rel="stylesheet">` nodes are cloned, which re-reads the style's
   * text or re-fetches the link's href inside the shadow tree.
   */
  const syncStyles = () => {
    if (!styleSlot || !shadowRoot) return;

    const adopted = (
      document as Document & { adoptedStyleSheets?: readonly unknown[] }
    ).adoptedStyleSheets;
    if (Array.isArray(adopted)) {
      try {
        const sr = shadowRoot as ShadowRoot & {
          adoptedStyleSheets: unknown[];
        };
        sr.adoptedStyleSheets = [...adopted];
      } catch {
        // A sheet the document adopted but this root may not (cross-document).
      }
    }

    // `:not([data-devdock-styles])`: in light-DOM mode a dock puts its own
    // sheet in the document, and re-cloning it here would be noise.
    const sheets = [
      ...document.querySelectorAll(
        `style:not([${STYLE_MARKER}]), link[rel~="stylesheet" i]`,
      ),
    ];
    const sig = sheets
      .map((n) => `${n.tagName}\u0000${n.getAttribute("href") ?? n.textContent}`)
      .join("\n");
    if (sig === clonesSig) return;
    clonesSig = sig;
    styleSlot.replaceChildren(...sheets.map((n) => n.cloneNode(true)));
  };

  // Bundlers inject and mutate <style> tags in `document.head` as you edit —
  // without watching, an HMR'd stylesheet would stop reaching the views.
  let styleObserver: MutationObserver | null = null;
  let syncQueued = false;
  const watchStyles = () => {
    if (
      !styleSlot ||
      styleObserver ||
      !document.head ||
      typeof MutationObserver === "undefined"
    )
      return;
    styleObserver = new MutationObserver(() => {
      if (syncQueued) return;
      syncQueued = true;
      // Coalesce a burst of injections into one re-clone.
      queueMicrotask(() => {
        syncQueued = false;
        syncStyles();
      });
    });
    styleObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };
  const unwatchStyles = () => {
    styleObserver?.disconnect();
    styleObserver = null;
  };

  const renderShell = () => {
    const position = opts.position ?? "bottom-right";
    const zIndex = opts.zIndex ?? 2147483000;

    Object.assign(root.style, {
      position: "fixed",
      zIndex: String(zIndex),
      top: "",
      bottom: "",
      left: "",
      right: "",
    });
    Object.assign(root.style, cornerStyle(position));

    headingText.textContent = opts.title ?? "Dev Menu";
    panel.setAttribute("aria-label", opts.title ?? "Dev Menu");
    Object.assign(panel.style, panelAnchor(position));

    buttonLabel.textContent = opts.label ?? "DEV";

    // An unguessable default is only as good as its hint: the heading shows
    // the chord while the panel is open, the tooltip while it is shut.
    const spec = hotkey();
    const chord = spec ? formatHotkey(spec) : "";
    hotkeyHint.textContent = chord;
    hotkeyHint.hidden = !chord;
    button.title = chord
      ? `${opts.title ?? "Dev Menu"} (${chord})`
      : (opts.title ?? "Dev Menu");
    // The open state is `aria-expanded`, which the stylesheet also paints —
    // see `BASE_CSS`.
    button.setAttribute("aria-expanded", String(open));
    paintClasses();
  };

  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    if (open) {
      query = "";
      input.value = "";
      active = 0;
      panel.isConnected || root.insertBefore(panel, button);
      renderShell();
      renderList();
      // The panel is connected, so views mount into a live document; styles
      // may have changed while it was closed.
      syncStyles();
      renderViews();
      requestAnimationFrame(() => input.focus());
    } else {
      // Teardown runs while the panel is still in the document, so a view can
      // read the DOM it is about to lose.
      unmountViews();
      if (panel.isConnected) panel.remove();
    }
    renderShell();
  }

  // ---- listeners --------------------------------------------------------

  input.addEventListener("input", () => {
    query = input.value;
    active = 0;
    renderList();
  });

  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(active + 1, rows.length - 1), true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(active - 1, 0), true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = rows[active]?.item;
      if (it) void runItem(it);
    }
  });

  button.addEventListener("click", () => setOpen(!open));

  const onDocMouseDown = (e: MouseEvent) => {
    // composedPath() sees through the shadow boundary; a plain
    // `contains(e.target)` would miss clicks inside the shadow root.
    if (open && !e.composedPath().includes(root)) setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const spec = hotkey();
    if (spec && matchHotkey(spec, e)) {
      e.preventDefault();
      setOpen(!open);
    }
  };

  const addListeners = () => {
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKeyDown);
  };
  const removeListeners = () => {
    document.removeEventListener("mousedown", onDocMouseDown);
    window.removeEventListener("keydown", onKeyDown);
  };

  const mount = () => {
    if (mounted) return;
    // Light DOM: the sheet can't ride along inside the host, so it goes at the
    // very top of <head>, ahead of the page's own styles.
    if (!shadowRoot)
      (document.head ?? document.documentElement).prepend(baseStyle);
    (opts.container ?? document.body).appendChild(host);
    addListeners();
    syncStyles();
    watchStyles();
    mounted = true;
  };
  const unmount = () => {
    if (!mounted) return;
    removeListeners();
    unwatchStyles();
    if (!shadowRoot) baseStyle.remove();
    host.remove();
    mounted = false;
  };

  // ---- init -------------------------------------------------------------

  renderShell();
  if (enabled()) mount();

  return {
    update(next: DevDockOptions) {
      opts = { ...opts, ...next };
      if (enabled()) {
        mount();
        renderShell();
        if (open) {
          renderList();
          renderViews();
        }
      } else {
        setOpen(false);
        unmount();
      }
    },
    destroy() {
      setOpen(false);
      unmount();
    },
  };
}
