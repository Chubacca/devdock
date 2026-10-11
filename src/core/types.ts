import type { ClassValue } from "cn";

export type { ClassValue };

export type DockPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

/** A navigable destination shown in the dock's "Routes" section. */
export interface DevRoute {
  /** Path to navigate to, e.g. "/admin/users". */
  path: string;
  /** Human label. Defaults to `path`. */
  label?: string;
  /** Optional group heading to organize the list. */
  group?: string;
}

/** A custom action shown in the dock's "Commands" section. */
export interface DevCommand {
  /**
   * Stable id (used as key). Defaults to `label` — pass one explicitly when
   * `label` is a function, so the row survives a label change.
   */
  id?: string;
  /**
   * Human label shown in the list. A function is re-read on every render of
   * the open panel, so the row can show live state ("Theme: Dark", "42 keys").
   */
  label: string | (() => string);
  /** Called when the command is selected. May be async. */
  run: () => void | Promise<void>;
  /**
   * Makes the command a toggle: a check mark is rendered when this returns
   * `true`, and the row exposes `role="checkbox"` + `aria-checked`. Re-read on
   * every render of the open panel, like a function `label`.
   *
   * @example
   * { label: "Freeze animations", checked: () => frozen, run: () => toggle() }
   */
  checked?: () => boolean;
  /** Optional group heading to organize the list. */
  group?: string;
  /** Keep the popup open after running (default: false — it closes). */
  keepOpen?: boolean;
}

/**
 * A custom panel rendered inside the popup — anything the routes/commands
 * list can't express: a live meter, a status readout, a segmented control.
 *
 * Views are mounted when the popup opens and torn down when it closes, so a
 * `requestAnimationFrame` loop or an event listener set up in `mount` has a
 * well-defined place to stop. The teardown function you return is what runs.
 */
export interface DevView {
  /**
   * Stable id. Views are reconciled by id across `update()` calls: a view
   * whose id is unchanged is never remounted. Defaults to the index, so give
   * an id to any view in a list that can reorder or change length.
   */
  id?: string;
  /** Section heading shown above the view. Omit for no heading. */
  label?: string;
  /**
   * Put several views under one shared heading. Views with the same `group`
   * render in one section titled with the group name, each one labelled with
   * its own `label`.
   */
  group?: string;
  /**
   * Fill `host` with your UI. Return a teardown function to undo it — stop
   * timers, remove listeners, unmount your framework's component tree.
   * Called with `host` already connected to the document.
   */
  mount: (host: HTMLElement) => void | (() => void);
  /**
   * Place the view before or after the routes/commands list.
   * Default: `"before"`.
   */
  order?: "before" | "after";
}

/**
 * Classes to merge onto the dock's own parts — one entry per piece of the UI,
 * added alongside the class it already carries (`.devdock-panel`, …) rather
 * than replacing it.
 *
 * Each entry takes anything [`cn`](https://www.npmjs.com/package/cn) does, so
 * a wrapper of your own can forward its props without reaching for a helper:
 *
 * ```tsx
 * <DevDock classNames={{ panel: ["bg-red-100", props.className] }} />
 * ```
 *
 * Merging is `cn`'s, so conflicting Tailwind classes collapse to the last
 * one — `rowActive` beats `row`, and a forwarded `className` beats the
 * default you put in front of it.
 *
 * The dock's own rules are each worth exactly one class and are inserted
 * before the page's styles, so a plain utility class wins on its own — no
 * `!important`, no `[&>*]` escape hatches:
 *
 * ```tsx
 * <DevDock classNames={{ panel: "w-96 max-h-[80vh]", row: "rounded-none" }} />
 * ```
 *
 * Your CSS has to reach the dock for any of this to mean anything, so passing
 * `classNames` flips the default from `shadow: true` (isolated, your
 * stylesheet never crosses the boundary) to `shadow: "inherit"`. Set `shadow`
 * yourself to take that back.
 *
 * Not themeable this way: the corner placement, the z-index, and the popup's
 * anchoring. Those are computed from `position`/`zIndex` and stay inline.
 */
export interface DevDockClassNames {
  /** The fixed-position wrapper holding the button and the popup. */
  root?: ClassValue;
  /** The floating button. */
  button?: ClassValue;
  /** The green status dot inside the button. */
  dot?: ClassValue;
  /** The button's text. */
  buttonLabel?: ClassValue;
  /** The popup. */
  panel?: ClassValue;
  /** The popup's heading (`title`). */
  title?: ClassValue;
  /** The padded wrapper around the filter input. */
  inputWrap?: ClassValue;
  /** The filter input. */
  input?: ClassValue;
  /** The scroller holding the views and the list. */
  body?: ClassValue;
  /** The routes/commands list. */
  list?: ClassValue;
  /** One group's wrapper, in the list or around a view. */
  section?: ClassValue;
  /** A group heading ("Routes", "Commands", a view's `group`/`label`). */
  group?: ClassValue;
  /** Every row. */
  row?: ClassValue;
  /** The highlighted row, on top of {@link DevDockClassNames.row}. */
  rowActive?: ClassValue;
  /** A row's label text. */
  rowLabel?: ClassValue;
  /** The monospace path on a route row. */
  rowPath?: ClassValue;
  /** A toggle command's check mark. */
  check?: ClassValue;
  /** The "Nothing here." placeholder. */
  empty?: ClassValue;
  /** A view's own label, under a shared `group` heading. */
  viewLabel?: ClassValue;
  /** Each view's host element. */
  view?: ClassValue;
}

/** Framework-agnostic configuration for the dock. */
export interface DevDockOptions {
  /** Routes to list. */
  routes?: DevRoute[];
  /** Custom commands to list. */
  commands?: DevCommand[];
  /**
   * Custom panels rendered inside the popup, mounted on open and torn down on
   * close. See {@link DevView}.
   *
   * A view renders inside the dock's shadow root, which the document's
   * stylesheets don't cross — pass `shadow: "inherit"` (or `shadow: false`) if
   * the view uses the host app's CSS.
   */
  views?: DevView[];
  /**
   * Whether the dock renders at all. Accepts a boolean or a predicate
   * (re-evaluated on every `update`). Takes over the gating completely — both
   * the build and the dev-host check are skipped when it's set.
   *
   * When omitted, the dock renders only in development: a dev build
   * (`import.meta.env.DEV` under Vite-family bundlers, otherwise
   * `process.env.NODE_ENV !== "production"`) served from a dev host (see
   * {@link DevDockOptions.devHostOnly}).
   *
   * @example enabled: () => location.search.includes("debug")
   */
  enabled?: boolean | (() => boolean);
  /**
   * Also require the page to be served from a developer's machine — loopback,
   * an mDNS `.local` name, or a private LAN address. Default: `true`.
   *
   * This catches the case the build check can't: a development build deployed
   * to a real URL (a preview deploy, a staging box) still reports itself as a
   * dev build. Set `false` to drop the hostname check and gate on the build
   * alone — e.g. to keep the dock on a shared staging
   * environment or behind a dev tunnel. Ignored when `enabled` is set.
   */
  devHostOnly?: boolean;
  /**
   * How to navigate when a route is selected.
   * Defaults to `window.location.assign(path)`.
   */
  onNavigate?: (path: string) => void;
  /** Corner to anchor the button. Default: "bottom-right". */
  position?: DockPosition;
  /** Text on the floating button. Default: "DEV". */
  label?: string;
  /** Heading shown at the top of the popup. Default: "Dev Menu". */
  title?: string;
  /**
   * Optional keyboard shortcut to toggle the popup, e.g. "mod+." or
   * "ctrl+k". "mod" maps to ⌘ on Mac and Ctrl elsewhere. Default: none.
   */
  hotkey?: string | null;
  /** Base z-index for the floating UI. Default: 2147483000. */
  zIndex?: number;
  /** Where to mount the dock. Default: `document.body`. */
  container?: HTMLElement;
  /**
   * Classes to merge onto the dock's parts — `{ panel: "w-96", … }`. See
   * {@link DevDockClassNames}.
   */
  classNames?: DevDockClassNames;
  /**
   * The cascade layer the dock's own stylesheet goes in. Default:
   * `"devdock"`, declared after Tailwind's `base` and before its `utilities`,
   * so the dock keeps its look inside a reset and your `classNames` still win.
   *
   * Name your own layer and the dock makes no claim about where it sits —
   * place it in your `@layer` statement, where you know the names around it.
   *
   * Pass `false` for an unlayered sheet. Do that when the page's CSS is
   * unlayered too — Tailwind v3, say — because layered rules lose to
   * unlayered ones however specific they are, and the page's reset would
   * otherwise strip the dock's chrome. Unlayered, the sheet is worth one class
   * and goes in first: a reset loses to it, your classes beat it.
   *
   * Read once, when the dock is created.
   */
  cssLayer?: string | false;
  /**
   * Render inside a shadow root so the host page's CSS can't affect the dock
   * (and vice versa). Default: `true` where supported — or `"inherit"` when
   * {@link DevDockOptions.classNames} is set, since those classes are defined
   * by a stylesheet that has to cross the boundary. Set `false` to render in
   * the light DOM (e.g. if you want to style it from the page).
   *
   * `"inherit"` keeps the shadow root but copies the document's styles into
   * it — `document.adoptedStyleSheets` plus every `<style>` and
   * `<link rel="stylesheet">` node, re-synced as they change. Use it when a
   * {@link DevView} renders your app's own components and needs its CSS; the
   * cost is that the page's CSS can now reach the dock too.
   *
   * Read once, when the dock is created: a shadow root can't be detached, so
   * `update()` ignores this.
   */
  shadow?: boolean | "inherit";
}

/** A live dock instance returned by {@link createDevDock}. */
export interface DevDockInstance {
  /** Re-render with new options (merged over the current ones). */
  update(options: DevDockOptions): void;
  /** Remove the dock and all its listeners. */
  destroy(): void;
}
