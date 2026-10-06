import { useContext, useMemo } from "react";
import {
  useNavigate,
  // UNSAFE_DataRouterContext is the supported way to reach the active
  // router instance (and its full route tree) for data routers. Imported
  // from `react-router` (not `react-router-dom`) so this works on v6, v7
  // and v8 — v8 dropped the `react-router-dom` package entirely.
  UNSAFE_DataRouterContext as DataRouterContext,
} from "react-router";
import { DevDock, type DevDockProps } from "./DevDock";
import type { DevRoute } from "../core/types";

/** Minimal shape of a react-router route object we care about. */
interface RRRoute {
  path?: string;
  index?: boolean;
  children?: RRRoute[];
  handle?: {
    dev?: boolean;
    devLabel?: string;
    devGroup?: string;
    hidden?: boolean;
  } & Record<string, unknown>;
}

/**
 * Restricts which auto-detected routes appear. A string is treated as a glob
 * where `*` matches any characters (e.g. `"/dev/*"`, `"/admin/*"`); or pass a
 * `RegExp` tested against the path, or a predicate for full control.
 */
export type RouteMatcher = string | RegExp | ((route: DevRoute) => boolean);

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function toPredicate(match: RouteMatcher): (route: DevRoute) => boolean {
  if (typeof match === "function") return match;
  const re = match instanceof RegExp ? match : globToRegExp(match);
  return (route) => re.test(route.path);
}

function joinPath(parent: string, child: string): string {
  if (child.startsWith("/")) return child;
  if (!child) return parent || "/";
  const base = parent.endsWith("/") ? parent.slice(0, -1) : parent;
  return `${base}/${child}`;
}

/** Opt-in markers that make a route a dev destination. */
function isDevMarked(handle: RRRoute["handle"]): boolean {
  return (
    handle?.dev === true || handle?.devLabel != null || handle?.devGroup != null
  );
}

/**
 * Convention: `/dev` and everything under it is a dev destination, so a dev
 * section needs no `handle` at all.
 */
function isDevPath(path: string): boolean {
  return path === "/dev" || path.startsWith("/dev/");
}

export interface DetectOptions {
  /**
   * Only keep routes that match. A glob string (`*` = any characters), a
   * `RegExp`, or a predicate.
   */
  match?: RouteMatcher;
  /**
   * Also list the app's ordinary static routes, not just the dev ones.
   * Default: `false`.
   */
  staticRoutes?: boolean;
}

/** State handed down to descendants of a dev-marked route. */
interface Inherited {
  dev: boolean;
  group?: string;
}

/**
 * Flatten a react-router route tree into navigable {@link DevRoute}s.
 *
 * Only dev destinations are returned: routes under `/dev`, routes marked with
 * `handle.dev`, `handle.devLabel` or `handle.devGroup`, and everything nested
 * under them. Pass `{ staticRoutes: true }` to list every static route instead.
 *
 * Dynamic (`:param`) and splat (`*`) segments are skipped since they can't be
 * navigated to without arguments. Mark a route with `handle.hidden` to exclude
 * it, or `handle.devLabel` to rename it.
 */
export function flattenRoutes(
  routes: RRRoute[],
  parent = "",
  options: Pick<DetectOptions, "staticRoutes"> = {},
): DevRoute[] {
  return walk(routes, parent, options.staticRoutes === true, { dev: false });
}

function walk(
  routes: RRRoute[],
  parent: string,
  staticRoutes: boolean,
  inherited: Inherited,
): DevRoute[] {
  const out: DevRoute[] = [];
  for (const r of routes) {
    const full = r.index ? parent : joinPath(parent, r.path ?? "");
    // A dev route makes its whole subtree dev, so marking a section's layout
    // route is enough to surface the pages inside it. The `/dev` check reads
    // the joined path, which also catches flat routes like `dev/inspector`.
    const dev = inherited.dev || isDevMarked(r.handle) || isDevPath(full);
    const group = r.handle?.devGroup ?? inherited.group;
    const navigable =
      !r.index &&
      r.path != null &&
      !full.includes(":") &&
      !full.includes("*") &&
      r.handle?.hidden !== true &&
      (dev || staticRoutes);
    if (navigable) {
      out.push({
        path: full || "/",
        label: r.handle?.devLabel ?? (full || "/"),
        group,
      });
    }
    if (r.children?.length)
      out.push(...walk(r.children, full, staticRoutes, { dev, group }));
  }
  return out;
}

function isMatcher(value: DetectOptions | RouteMatcher): value is RouteMatcher {
  return (
    typeof value === "string" ||
    typeof value === "function" ||
    value instanceof RegExp
  );
}

/**
 * Read the dev routes off the active react-router data router — anything under
 * `/dev` or marked with `handle.dev` / `devLabel` / `devGroup`, plus their
 * children.
 * Pass `{ staticRoutes: true }` to include the app's ordinary routes too, and
 * `{ match }` to scope the results. A bare matcher is accepted as shorthand.
 */
export function useDetectedRoutes(
  options: DetectOptions | RouteMatcher = {},
): DevRoute[] {
  const opts: DetectOptions = isMatcher(options) ? { match: options } : options;
  const { match, staticRoutes } = opts;
  const ctx = useContext(DataRouterContext);
  const routes = (ctx?.router?.routes ?? []) as RRRoute[];
  return useMemo(() => {
    const seen = new Set<string>();
    const deduped = flattenRoutes(routes, "", { staticRoutes }).filter((r) =>
      seen.has(r.path) ? false : (seen.add(r.path), true),
    );
    return match ? deduped.filter(toPredicate(match)) : deduped;
  }, [routes, match, staticRoutes]);
}

export interface ReactRouterDevDockProps extends DevDockProps {
  /**
   * Only auto-detect routes that match. A glob string (`*` = any characters,
   * e.g. `"/dev/*"`), a `RegExp`, or a predicate. Manual `routes` are always
   * included regardless of this filter.
   */
  match?: RouteMatcher;
  /**
   * List the app's ordinary static routes alongside the dev ones.
   * Off by default, so the dock only shows what you opted in.
   */
  staticRoutes?: boolean;
}

/**
 * Drop-in {@link DevDock} for react-router apps: navigates via the SPA router
 * and auto-detects the dev routes from the active data router. Any `routes`
 * you pass are appended to the detected ones.
 */
export function ReactRouterDevDock({
  match,
  staticRoutes,
  ...props
}: ReactRouterDevDockProps) {
  const navigate = useNavigate();
  const detected = useDetectedRoutes({ match, staticRoutes });
  const routes = useMemo(
    () => [...detected, ...(props.routes ?? [])],
    [detected, props.routes],
  );
  return (
    <DevDock
      {...props}
      routes={routes}
      onNavigate={props.onNavigate ?? ((path) => navigate(path))}
    />
  );
}
