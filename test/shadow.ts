// Shadow-aware DOM query helpers. The dock renders inside a shadow root by
// default, so `document.querySelector` can't see its internals — reach in
// through the host's shadowRoot (falling back to the host for light-DOM mode).

export const hostEl = () =>
  document.querySelector("[data-devdock]") as HTMLElement | null;

export const root = (): ParentNode | null => {
  const h = hostEl();
  return h ? (h.shadowRoot ?? h) : null;
};

export const q = (sel: string) =>
  (root()?.querySelector(sel) ?? null) as HTMLElement | null;

export const qa = (sel: string) =>
  [...(root()?.querySelectorAll(sel) ?? [])] as HTMLElement[];

// The fixed-position wrapper that carries the corner placement. It's inside
// the shadow root, not the `data-devdock` host.
export const shell = () => q(".devdock-root");

export const byLabel = (label: string) => q(`[aria-label="${label}"]`);
export const toggle = () => byLabel("Toggle dev menu") as HTMLElement;
export const dialog = () => q("[role='dialog']");
export const filterInput = () => q("[role='dialog'] input") as HTMLElement;
export const rowWith = (text: string) =>
  rowEls().find((b) => b.textContent?.includes(text)) ?? null;
// Every row in the open panel, in DOM order. Scoped to the list container so
// a button rendered by a custom view isn't mistaken for an item row.
export const rowEls = () => qa("[data-devdock-list] button");
// The highlight is an attribute the dock's stylesheet paints, so jsdom (which
// doesn't need to resolve the cascade for this) can read it directly.
export const isHighlighted = (row: HTMLElement) =>
  row.hasAttribute("data-active");

// ---- custom views ---------------------------------------------------------

/** A view's host element, by its `id` (or the only one, with no id). */
export const viewHost = (id?: string) =>
  q(id ? `[data-devdock-view="${id}"]` : "[data-devdock-view]");
export const viewHosts = () => qa("[data-devdock-view]");
/** The `before` / `after` containers the views are placed into. */
export const viewsSlot = (order: "before" | "after") =>
  q(`[data-devdock-views="${order}"]`);
/**
 * Every cloned stylesheet node in the shadow root (`shadow: "inherit"`) —
 * minus the dock's own sheet, which is there in every mode.
 */
export const inheritedStyles = () =>
  [
    ...((hostEl()?.shadowRoot?.querySelectorAll(
      'style:not([data-devdock-styles]), link[rel~="stylesheet" i]',
    ) ?? []) as NodeListOf<HTMLElement>),
  ];
