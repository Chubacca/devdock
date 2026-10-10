import { createDevDock } from "../core/dock";
import type { DevDockOptions, DevRoute } from "../core/types";
import {
  dedupeByPath,
  isDevPath,
  isMatcher,
  toPredicate,
  type RouteMatcher,
} from "../core/match";
import type { DevDockAction } from "./index";

export type { RouteMatcher };

/**
 * What `import.meta.glob("/src/routes/**\/+page.svelte")` returns — only the
 * keys matter, so an array of file paths works too.
 */
export type RouteModules = Record<string, unknown> | string[];

export interface DetectOptions {
  /**
   * Only keep routes that match. A glob string (`*` = any characters), a
   * `RegExp`, or a predicate.
   */
  match?: RouteMatcher;
  /**
   * Also list the app's ordinary routes, not just the ones under `/dev`.
   * Default: `false`.
   */
  staticRoutes?: boolean;
  /**
   * Your routes directory, as a name or a trailing path (`"routes"`,
   * `"app/pages"`). Detected from the `src/routes` (or `routes`) segment of
   * each key by default; set it only if your routes live somewhere else.
   */
  routesDir?: string;
}

/** Page files SvelteKit renders: `+page.svelte`, `+page.ts`, `+page@(app).svelte`… */
const PAGE_FILE = /^\+page(@[^.]*)?\.[^.]+$/;

function stripRoutesDir(file: string, routesDir?: string): string | null {
  const path = file.replace(/\\/g, "/");
  const dirs = routesDir ? [routesDir] : ["src/routes", "routes"];
  for (const dir of dirs) {
    const needle = `/${dir.replace(/^\/|\/$/g, "")}/`;
    const at = path.lastIndexOf(needle);
    if (at !== -1) return path.slice(at + needle.length);
    if (path.startsWith(needle.slice(1))) return path.slice(needle.length - 1);
  }
  // Relative glob from inside the routes directory, e.g. "./dev/+page.svelte".
  return routesDir ? null : path.replace(/^\.?\//, "");
}

/**
 * Turn a SvelteKit page file path into the route it serves, or `null` if it
 * isn't a navigable page.
 *
 * Layout groups (`(app)`) and optional params (`[[lang]]`) drop out of the
 * path; required (`[id]`), matched (`[id=int]`) and rest (`[...rest]`) params
 * make the route unnavigable without arguments, so it's skipped.
 */
export function routeFromFile(
  file: string,
  options: Pick<DetectOptions, "routesDir"> = {},
): string | null {
  const relative = stripRoutesDir(file, options.routesDir);
  if (relative == null) return null;
  const segments = relative.split("/");
  const filename = segments.pop();
  if (!filename || !PAGE_FILE.test(filename)) return null;
  const kept: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    // Layout group — organizes files, not URLs.
    if (segment.startsWith("(") && segment.endsWith(")")) continue;
    // Optional param: the route is reachable without it.
    if (segment.startsWith("[[") && segment.endsWith("]]")) continue;
    if (segment.includes("[")) return null;
    kept.push(segment);
  }
  return `/${kept.join("/")}`;
}

/**
 * Flatten a SvelteKit `import.meta.glob` of page files into navigable
 * {@link DevRoute}s.
 *
 * Only dev destinations are returned — anything under `/dev`, by convention.
 * Pass `{ staticRoutes: true }` to list every page instead, and `{ match }`
 * to scope the results. A bare matcher is accepted as shorthand.
 *
 * ```ts
 * const routes = detectRoutes(import.meta.glob("/src/routes/**\/+page.svelte"));
 * ```
 */
export function detectRoutes(
  modules: RouteModules,
  options: DetectOptions | RouteMatcher = {},
): DevRoute[] {
  const opts: DetectOptions = isMatcher(options) ? { match: options } : options;
  const files = Array.isArray(modules) ? modules : Object.keys(modules);
  const paths: string[] = [];
  for (const file of files) {
    const path = routeFromFile(file, opts);
    if (path != null && (opts.staticRoutes === true || isDevPath(path)))
      paths.push(path);
  }
  const routes = dedupeByPath(
    paths.sort().map((path) => ({ path, label: path })),
  );
  return opts.match ? routes.filter(toPredicate(opts.match)) : routes;
}

export interface SvelteKitDevDockOptions extends DevDockOptions, DetectOptions {
  /**
   * Your page files, from `import.meta.glob`. The glob has to be written in
   * your app (Vite resolves it at build time), so pass the result in:
   *
   * ```ts
   * { modules: import.meta.glob("/src/routes/**\/+page.svelte") }
   * ```
   *
   * Detected routes come first; any `routes` you pass are appended.
   */
  modules?: RouteModules;
}

function resolveOptions(options: SvelteKitDevDockOptions): DevDockOptions {
  const { modules, match, staticRoutes, routesDir, ...rest } = options;
  if (!modules) return rest;
  const detected = detectRoutes(modules, { match, staticRoutes, routesDir });
  return { ...rest, routes: [...detected, ...(rest.routes ?? [])] };
}

/**
 * Svelte action that mounts a dev dock with the SvelteKit routes detected
 * from `modules`:
 *
 * ```svelte
 * <script lang="ts">
 *   import { goto } from "$app/navigation";
 *   import { devdock } from "@chuvenger/devdock/sveltekit";
 *
 *   const modules = import.meta.glob("/src/routes/**\/+page.svelte");
 * </script>
 *
 * <div use:devdock={{ modules, onNavigate: goto, hotkey: "mod+." }}></div>
 * ```
 *
 * Same contract as the plain `devdock` action: the dock mounts into
 * `document.body` (or `options.container`), so the host element is just an
 * anchor, and reactive options flow through `update`.
 */
export function devdock(
  _node: HTMLElement,
  options: SvelteKitDevDockOptions = {},
): DevDockAction {
  const instance = createDevDock(resolveOptions(options));
  return {
    update(next: SvelteKitDevDockOptions = {}) {
      instance.update(resolveOptions(next));
    },
    destroy() {
      instance.destroy();
    },
  };
}

export { createDevDock } from "../core/dock";
export type { DevDockAction } from "./index";
export type {
  DevDockOptions,
  DevDockInstance,
  DevRoute,
  DevCommand,
  DevView,
  DockPosition,
} from "../core/types";
