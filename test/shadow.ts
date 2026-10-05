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

export const byLabel = (label: string) => q(`[aria-label="${label}"]`);
export const toggle = () => byLabel("Toggle dev menu") as HTMLElement;
export const dialog = () => q("[role='dialog']");
export const filterInput = () => q("[role='dialog'] input") as HTMLElement;
export const rowWith = (text: string) =>
  rowEls().find((b) => b.textContent?.includes(text)) ?? null;
// Every row in the open panel, in DOM order. The toggle button lives outside
// the dialog, so this is exactly the item rows.
export const rowEls = () => qa("[role='dialog'] button");
export const isHighlighted = (row: HTMLElement) =>
  row.style.background !== "" && row.style.background !== "transparent";
