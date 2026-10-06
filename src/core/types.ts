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
  /** Stable id (used as key). Defaults to `label`. */
  id?: string;
  /** Human label shown in the list. */
  label: string;
  /** Called when the command is selected. May be async. */
  run: () => void | Promise<void>;
  /** Optional group heading to organize the list. */
  group?: string;
  /** Keep the popup open after running (default: false — it closes). */
  keepOpen?: boolean;
}

/** Framework-agnostic configuration for the dock. */
export interface DevDockOptions {
  /** Routes to list. */
  routes?: DevRoute[];
  /** Custom commands to list. */
  commands?: DevCommand[];
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
   * Render inside a shadow root so the host page's CSS can't affect the dock
   * (and vice versa). Default: `true` where supported. Set `false` to render
   * in the light DOM (e.g. if you want to style it from the page).
   */
  shadow?: boolean;
}

/** A live dock instance returned by {@link createDevDock}. */
export interface DevDockInstance {
  /** Re-render with new options (merged over the current ones). */
  update(options: DevDockOptions): void;
  /** Remove the dock and all its listeners. */
  destroy(): void;
}
