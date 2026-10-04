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
  handle?: { devLabel?: string; devGroup?: string; hidden?: boolean } & Record<
    string,
    unknown
  >;
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

/**
 * Flatten a react-router route tree into navigable {@link DevRoute}s.
 * Dynamic (`:param`) and splat (`*`) segments are skipped since they
 * can't be navigated to without arguments. Mark a route with
 * `handle.hidden` to exclude it, or `handle.devLabel` to rename it.
 */
export function flattenRoutes(routes: RRRoute[], parent = ""): DevRoute[] {
  const out: DevRoute[] = [];
  for (const r of routes) {
    const full = r.index ? parent : joinPath(parent, r.path ?? "");
    const navigable =
      !r.index &&
      r.path != null &&
      !full.includes(":") &&
      !full.includes("*") &&
      r.handle?.hidden !== true;
    if (navigable) {
      out.push({
        path: full || "/",
        label: r.handle?.devLabel ?? (full || "/"),
        group: r.handle?.devGroup,
      });
    }
    if (r.children?.length) out.push(...flattenRoutes(r.children, full));
  }
  return out;
}

/**
 * Read every navigable route from the active react-router data router.
 * Pass `match` to scope the results (glob string, RegExp, or predicate).
 */
export function useDetectedRoutes(match?: RouteMatcher): DevRoute[] {
  const ctx = useContext(DataRouterContext);
  const routes = (ctx?.router?.routes ?? []) as RRRoute[];
  return useMemo(() => {
    const seen = new Set<string>();
    const deduped = flattenRoutes(routes).filter((r) =>
      seen.has(r.path) ? false : (seen.add(r.path), true),
    );
    return match ? deduped.filter(toPredicate(match)) : deduped;
  }, [routes, match]);
}

export interface ReactRouterDevDockProps extends DevDockProps {
  /**
   * Only auto-detect routes that match. A glob string (`*` = any characters,
   * e.g. `"/dev/*"`), a `RegExp`, or a predicate. Manual `routes` are always
   * included regardless of this filter.
   */
  match?: RouteMatcher;
}

/**
 * Drop-in {@link DevDock} for react-router apps: navigates via the SPA
 * router and auto-detects routes from the active data router. Any
 * `routes` you pass are appended to the detected ones.
 */
export function ReactRouterDevDock({
  match,
  ...props
}: ReactRouterDevDockProps) {
  const navigate = useNavigate();
  const detected = useDetectedRoutes(match);
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
