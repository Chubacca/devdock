import type { DevDockClassNames } from "./types";

/** One styleable piece of the dock. See {@link DevDockClassNames}. */
export type DockPart = keyof DevDockClassNames;

/**
 * The class every part carries, whatever you pass in `classNames`. Stable
 * API: target `.devdock-row` from your own stylesheet if you'd rather not
 * thread class names through the options.
 *
 * `rowActive` has no class of its own — the highlighted row is marked with
 * `data-active`, so a base rule can reach it without one.
 */
export const partClass: Record<DockPart, string> = {
  root: "devdock-root",
  button: "devdock-button",
  dot: "devdock-dot",
  buttonLabel: "devdock-button-label",
  panel: "devdock-panel",
  title: "devdock-title",
  inputWrap: "devdock-input-wrap",
  input: "devdock-input",
  body: "devdock-body",
  list: "devdock-list",
  section: "devdock-section",
  group: "devdock-group",
  row: "devdock-row",
  rowActive: "",
  rowLabel: "devdock-row-label",
  rowPath: "devdock-row-path",
  check: "devdock-check",
  empty: "devdock-empty",
  viewLabel: "devdock-view-label",
  view: "devdock-view",
};

/** Marks the dock's own stylesheet, so the style-inheriting code can skip it. */
export const STYLE_MARKER = "data-devdock-styles";

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/**
 * The dock's own styles.
 *
 * Two things make `classNames` work without `!important`:
 *
 * 1. **A cascade layer** (see {@link dockStyles}). Layered rules lose to
 *    unlayered ones whatever their specificity, and Tailwind v4 puts its
 *    utilities in `@layer utilities` — so the sheet declares a layer order
 *    that sits the dock's layer after Tailwind's `base` (its reset can't strip
 *    the dock's chrome) and before `utilities` (your classes land).
 * 2. **Exactly one class per rule** — one bare `.devdock-*`, with any state
 *    selector tucked inside `:where()`, which contributes nothing. That is
 *    what settles ties against unlayered CSS, which is the whole cascade when
 *    the layer is turned off (`cssLayer: false`): a page-level reset
 *    (`button { … }`, `*`) is worth less and loses, a class you pass is worth
 *    the same and wins on order, because this sheet goes in first.
 *
 * Colours, sizes and the font come from `--devdock-*` custom properties, each
 * written as a `var(…, default)` fallback rather than declared anywhere. That
 * is the point: a property the page sets — on `:root`, or on the
 * `[data-devdock]` host for one dock — inherits *through* the shadow boundary
 * and is used, while a default of ours declared inside the shadow tree would
 * have beaten it. It also means retheming needs none of the machinery above:
 * no inherited stylesheet, no layer, no change to the isolation.
 *
 * What stays inline, and so can't be overridden by either: the corner
 * placement, the z-index, and the popup's anchoring — all of them computed
 * from `position`/`zIndex` rather than themed.
 */
export const BASE_CSS = `
.devdock-root { font-family: var(--devdock-font, ${FONT}); }

.devdock-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: var(--devdock-button-fg, #fff);
  background: var(--devdock-button-bg, #111317);
  border: 1px solid var(--devdock-border, #2a2e37);
  border-radius: 999px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.devdock-button:where([aria-expanded="true"]) {
  background: var(--devdock-accent, #2563eb);
}

.devdock-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--devdock-success, #22c55e);
  display: inline-block;
}

.devdock-panel {
  width: var(--devdock-width, 280px);
  max-height: var(--devdock-max-height, 70vh);
  display: flex;
  flex-direction: column;
  background: var(--devdock-bg, #16181d);
  color: var(--devdock-fg, #e7e9ee);
  border: 1px solid var(--devdock-border, #2a2e37);
  border-radius: var(--devdock-radius, 12px);
  box-shadow: var(--devdock-shadow, 0 12px 40px rgba(0, 0, 0, 0.45));
  overflow: hidden;
}

.devdock-title {
  padding: 10px 12px;
  border-bottom: 1px solid var(--devdock-border, #2a2e37);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--devdock-muted, #8b909c);
}

.devdock-input-wrap { padding: 8px; }

.devdock-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--devdock-fg, #e7e9ee);
  background: var(--devdock-input-bg, #0f1115);
  border: 1px solid var(--devdock-border, #2a2e37);
  border-radius: var(--devdock-radius-sm, 8px);
  outline: none;
}

.devdock-body {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.devdock-list { padding: 0 6px 8px; }

.devdock-section { margin-top: 6px; }

.devdock-group {
  padding: 6px 8px 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--devdock-subtle, #6b7280);
}

.devdock-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--devdock-fg, #e7e9ee);
  background: transparent;
  border: none;
  border-radius: var(--devdock-radius-sm, 8px);
  cursor: pointer;
}
.devdock-row:where([data-active]) {
  background: var(--devdock-accent, #2563eb);
  color: var(--devdock-accent-fg, #e7e9ee);
}

.devdock-row-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.devdock-row-path {
  font-size: 11px;
  color: var(--devdock-subtle, #6b7280);
  font-family: ui-monospace, SFMono-Regular, monospace;
  flex-shrink: 0;
}
:where(.devdock-row[data-active]) .devdock-row-path {
  /* Whatever colour the row ended up with, stepped back: currentColor in the
     color property means the inherited one, so this tracks the row however it
     was set - a token, a class of yours - instead of guessing at the accent. */
  color: color-mix(in oklab, currentColor 75%, transparent);
}

.devdock-check {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  color: var(--devdock-success, #22c55e);
}

.devdock-empty {
  padding: 12px;
  font-size: 13px;
  color: var(--devdock-subtle, #6b7280);
}

.devdock-view-label {
  padding: 4px 8px 0;
  font-size: 11px;
  color: var(--devdock-muted, #8b909c);
}

.devdock-view { padding: 2px 8px 6px; }
`;

/** The layer the dock's styles go in when `cssLayer` is left alone. */
export const DEFAULT_LAYER = "devdock";

/**
 * The sheet text: {@link BASE_CSS}, in a cascade layer unless `layer` is
 * `false`.
 *
 * For the default layer the statement names Tailwind's four layers around
 * ours, which both fixes the relative order and is inert for a page that has
 * none of them — layer names are declared here, in a sheet that always goes in
 * first, so this is the order that stands. A layer *you* name gets no such
 * statement: put it where you want it in your own `@layer` line.
 */
export function dockStyles(layer: string | false): string {
  if (!layer) return BASE_CSS;
  const block = `@layer ${layer} {${BASE_CSS}}\n`;
  // A layer you named is a layer you're placing yourself — ordering it from
  // in here, against names we'd be guessing at, is how the dock would end up
  // under your reset. Only the default layer gets an opinion.
  if (layer !== DEFAULT_LAYER) return block;
  const order = `@layer theme, base, components, ${layer}, utilities;`;
  return `${order}\n${block}`;
}
