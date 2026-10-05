import { matchHotkey } from "./hotkey";
import type {
  DevCommand,
  DevDockInstance,
  DevDockOptions,
  DevRoute,
  DockPosition,
} from "./types";

const isDev = (): boolean => {
  // Bundlers (Vite, webpack, Next, esbuild…) statically replace the full
  // `process.env.NODE_ENV` token, even in browser builds where `process`
  // itself is undefined. Reading it directly lets that replacement work;
  // the try/catch covers runtimes where it's left as a real (missing) global.
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

type Item =
  | { kind: "route"; key: string; label: string; group: string; route: DevRoute }
  | {
      kind: "command";
      key: string;
      label: string;
      group: string;
      command: DevCommand;
    };

type Styles = Partial<CSSStyleDeclaration>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles?: Styles,
  props?: Partial<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (styles) Object.assign(node.style, styles);
  if (props) Object.assign(node, props);
  return node;
}

function cornerStyle(position: DockPosition): Styles {
  const gap = "16px";
  switch (position) {
    case "bottom-right":
      return { bottom: gap, right: gap };
    case "top-left":
      return { top: gap, left: gap };
    case "top-right":
      return { top: gap, right: gap };
    default:
      return { bottom: gap, left: gap };
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

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

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
  let open = false;
  let query = "";
  let active = 0;
  let mounted = false;

  // Light-DOM host that gets appended to the page. When shadow DOM is used,
  // the actual UI lives inside its shadow root — fully isolated from the host
  // page's CSS. `data-devdock` stays on the host so it's discoverable.
  const host = el("div");
  host.setAttribute("data-devdock", "");
  const useShadow =
    (initial.shadow ?? true) && typeof host.attachShadow === "function";
  const shadowRoot = useShadow ? host.attachShadow({ mode: "open" }) : null;
  const mountPoint: Node = shadowRoot ?? host;

  const root = el("div", { fontFamily: FONT });
  mountPoint.appendChild(root);

  const panel = el("div", {
    width: "280px",
    maxHeight: "min(70vh, 480px)",
    display: "flex",
    flexDirection: "column",
    background: "#16181d",
    color: "#e7e9ee",
    border: "1px solid #2a2e37",
    borderRadius: "12px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    overflow: "hidden",
  });
  panel.setAttribute("role", "dialog");

  const heading = el("div", {
    padding: "10px 12px",
    borderBottom: "1px solid #2a2e37",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    color: "#8b909c",
  });

  const inputWrap = el("div", { padding: "8px" });
  const input = el("input", {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    fontSize: "13px",
    color: "#e7e9ee",
    background: "#0f1115",
    border: "1px solid #2a2e37",
    borderRadius: "8px",
    outline: "none",
  });
  input.placeholder = "Filter…";
  inputWrap.appendChild(input);

  const list = el("div", { overflowY: "auto", padding: "0 6px 8px" });

  panel.append(heading, inputWrap, list);

  const button = el("button", {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.6px",
    color: "#fff",
    background: "#111317",
    border: "1px solid #2a2e37",
    borderRadius: "999px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    cursor: "pointer",
  });
  button.type = "button";
  button.setAttribute("aria-label", "Toggle dev menu");
  const dot = el("span", {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#22c55e",
    display: "inline-block",
  });
  const buttonLabel = el("span");
  button.append(dot, buttonLabel);

  root.appendChild(button);

  // ---- behavior ---------------------------------------------------------

  const enabled = (): boolean => {
    const e = opts.enabled;
    if (typeof e === "function") return e();
    return e ?? isDev();
  };

  const navigate = (path: string) => {
    if (opts.onNavigate) opts.onNavigate(path);
    else if (typeof window !== "undefined") window.location.assign(path);
  };

  const buildItems = (): Item[] => {
    const out: Item[] = [];
    (opts.routes ?? []).forEach((r, i) => {
      out.push({
        kind: "route",
        key: `route:${r.path}:${i}`,
        label: r.label ?? r.path,
        group: r.group ?? "Routes",
        route: r,
      });
    });
    (opts.commands ?? []).forEach((c, i) => {
      out.push({
        kind: "command",
        key: `cmd:${c.id ?? c.label}:${i}`,
        label: c.label,
        group: c.group ?? "Commands",
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
    pathSpan: HTMLSpanElement | null;
  };

  // The rendered rows, parallel to the current filtered list. They are kept
  // around so hovering or arrowing only repaints the highlight: rebuilding the
  // rows would destroy the node under the pointer, and the browser then never
  // dispatches a `click` on it (mousedown/mouseup retarget to the parent).
  let rows: Row[] = [];
  // Signature of the item list the rows were built from; identical signature
  // means the existing nodes can be reused as-is.
  let rowsSig: string | null = null;

  const itemSig = (it: Item): string =>
    [it.key, it.group, it.label, it.kind === "route" ? it.route.path : ""].join(
      "\u0000",
    );

  const paintActive = () => {
    rows.forEach((row, idx) => {
      const isActive = idx === active;
      row.node.style.background = isActive ? "#2563eb" : "transparent";
      if (row.pathSpan)
        row.pathSpan.style.color = isActive ? "#cfe0ff" : "#6b7280";
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

    const sig = filtered.map(itemSig).join("\n");
    if (sig === rowsSig) {
      // Same items in the same order: keep the nodes, refresh the highlight.
      // The items themselves are rebuilt on every call, so re-point each row
      // at its current one (its `run`/`route` may have been swapped by
      // `update()`).
      filtered.forEach((it, idx) => {
        const row = rows[idx];
        if (row) row.item = it;
      });
      paintActive();
      return;
    }
    rowsSig = sig;
    rows = [];
    list.replaceChildren();

    if (filtered.length === 0) {
      list.appendChild(
        el(
          "div",
          { padding: "12px", fontSize: "13px", color: "#6b7280" },
          { textContent: "Nothing here." },
        ),
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
      const section = el("div", { marginTop: "6px" });
      section.appendChild(
        el(
          "div",
          {
            padding: "6px 8px 2px",
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "#6b7280",
          },
          { textContent: groupName },
        ),
      );

      for (const it of groupItems) {
        const idx = filtered.indexOf(it);
        const row = el("button", {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          width: "100%",
          textAlign: "left",
          padding: "8px 10px",
          fontSize: "13px",
          color: "#e7e9ee",
          background: "transparent",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        });
        row.type = "button";

        const labelSpan = el(
          "span",
          {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
          { textContent: it.label },
        );
        row.appendChild(labelSpan);

        let pathSpan: HTMLSpanElement | null = null;
        if (it.kind === "route" && it.route.path !== it.label) {
          pathSpan = el(
            "span",
            {
              fontSize: "11px",
              color: "#6b7280",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              flexShrink: "0",
            },
            { textContent: it.route.path },
          );
          row.appendChild(pathSpan);
        }

        const rec: Row = { item: it, node: row, pathSpan };
        rows[idx] = rec;

        row.addEventListener("mouseenter", () => setActive(idx));
        row.addEventListener("click", () => void runItem(rec.item));
        section.appendChild(row);
      }
      list.appendChild(section);
    }

    paintActive();
  };

  const renderShell = () => {
    const position = opts.position ?? "bottom-left";
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

    heading.textContent = opts.title ?? "Dev Menu";
    panel.setAttribute("aria-label", opts.title ?? "Dev Menu");
    Object.assign(panel.style, panelAnchor(position));

    buttonLabel.textContent = opts.label ?? "DEV";
    button.style.background = open ? "#2563eb" : "#111317";
    button.setAttribute("aria-expanded", String(open));
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
      requestAnimationFrame(() => input.focus());
    } else if (panel.isConnected) {
      panel.remove();
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
    if (opts.hotkey && matchHotkey(opts.hotkey, e)) {
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
    (opts.container ?? document.body).appendChild(host);
    addListeners();
    mounted = true;
  };
  const unmount = () => {
    if (!mounted) return;
    removeListeners();
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
        if (open) renderList();
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
