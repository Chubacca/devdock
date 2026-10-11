import { useContext, useEffect, useMemo, useRef, useState } from "react";
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
import {
  dedupeByPath,
  isDevPath,
  isMatcher,
  toPredicate,
  type RouteMatcher,
} from "../core/match";

export type { RouteMatcher };

/** The `handle` fields the dock reads off a route. */
interface DevHandle {
  dev?: boolean;
  devLabel?: string;
  devGroup?: string;
  hidden?: boolean;
  /** Whatever else the app puts on `handle`; the dock ignores it. */
  [key: string]: unknown;
}

/** `handle` loader for one route property, as lazy route objects expose it. */
type LazyProperty<T> = () => Promise<T | undefined>;

/** Minimal shape of a react-router route object we care about. */
interface RRRoute {
  path?: string;
  index?: boolean;
  children?: RRRoute[];
  handle?: DevHandle;
  /**
   * Set while the route's module is still unloaded. Two shapes exist: a
   * function resolving to the module, whose exports are the route's properties
   * (`lazy: () => import("./route")`, v6.19+), and an object with one loader
   * per property (v7.5+, and what framework mode builds for every route).
   * `handle` rides along in both.
   */
  lazy?:
    LazyProperty<{ handle?: DevHandle }> | { handle?: LazyProperty<DevHandle> };
}

/** The slice of the data router the adapter uses, across v6/v7/v8. */
interface RRRouter {
  routes?: RRRoute[];
  subscribe?: (listener: () => void) => () => void;
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
  /**
   * Import lazy route modules to read their `handle`.
   *
   * In framework mode (`app/routes.ts`) every route is lazy, so `handle` is
   * not on the route object the router exposes — it lives in the route module
   * and only reaches the route once that module loads, i.e. once you visit the
   * page. Without this, framework-mode routes are detected by the `/dev/*`
   * path convention alone and `handle.dev` / `devLabel` / `devGroup` /
   * `hidden` are silently ignored.
   *
   * Opt-in because reading a handle up front means importing the module up
   * front — dev only, but that is still every lazy route's module, and any
   * import side effects with it. Default: `false`.
   */
  loadHandles?: boolean;
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
 *
 * Reads `handle` straight off each route object, so a tree whose routes are
 * still lazy has no handles to read — see {@link DetectOptions.loadHandles}.
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

// ---- lazy handles ---------------------------------------------------------

const NO_ROUTES: RRRoute[] = [];
const NO_HANDLES: ReadonlyMap<RRRoute, DevHandle> = new Map();

/** The route's `handle` loader, whichever `lazy` shape it uses. */
function lazyHandleOf(route: RRRoute): LazyProperty<DevHandle> | undefined {
  const lazy = route.lazy;
  if (typeof lazy === "function") return async () => (await lazy())?.handle;
  return typeof lazy?.handle === "function" ? lazy.handle : undefined;
}

async function readLazyHandle(route: RRRoute): Promise<DevHandle | undefined> {
  try {
    return await lazyHandleOf(route)?.();
  } catch {
    // A route module that won't load is the app's problem, not the dock's.
    // Fall back to listing the route by path.
    return undefined;
  }
}

function collectLazy(routes: RRRoute[], out: RRRoute[] = []): RRRoute[] {
  for (const r of routes) {
    // A `handle` already on the route is the router's own resolved value.
    if (r.handle == null && lazyHandleOf(r) != null) out.push(r);
    if (r.children?.length) collectLazy(r.children, out);
  }
  return out;
}

/**
 * Everything the dock reads out of the route tree, as a comparable string.
 *
 * Neither the tree's identity nor its contents are a reliable change signal on
 * their own: the router resolves `lazy` by mutating route objects in place, and
 * patches discovered branches into the arrays it already handed out. Only some
 * versions swap the top-level array. So compare what we actually read.
 */
function signature(routes: RRRoute[], out: string[] = []): string[] {
  for (const r of routes) {
    const h = r.handle;
    out.push(
      `${r.path ?? ""}|${r.index ? 1 : 0}|${h?.dev}|${h?.devLabel}` +
        `|${h?.devGroup}|${h?.hidden}|${lazyHandleOf(r) ? 1 : 0}`,
    );
    if (r.children?.length) signature(r.children, out);
  }
  return out;
}

/**
 * The router's route tree, plus a signature that changes whenever the tree
 * does. Routes arrive late in framework mode — `lazy` modules resolve on
 * navigation and lazy route discovery patches whole branches in as links
 * render — and both land as a router state update.
 */
function useRouteTree(router: RRRouter | undefined): [RRRoute[], string] {
  const routes = router?.routes ?? NO_ROUTES;
  const [sig, setSig] = useState(() => signature(routes).join("\n"));
  useEffect(() => {
    if (!router?.subscribe) return;
    const check = () => {
      const next = signature(router.routes ?? NO_ROUTES).join("\n");
      setSig((prev) => (prev === next ? prev : next));
    };
    // The tree can have moved between render and effect.
    check();
    return router.subscribe(check);
  }, [router]);
  return [routes, sig];
}

/** Handles read out of lazy route modules, keyed by route object. */
function useLazyHandles(
  routes: RRRoute[],
  sig: string,
  enabled: boolean,
): ReadonlyMap<RRRoute, DevHandle> {
  const [handles, setHandles] = useState(NO_HANDLES);
  // Promises, not values, and keyed by the route objects the router reuses: a
  // module is imported once no matter how often the effect re-runs, and an
  // effect that was cleaned up mid-flight (StrictMode's double invoke) can
  // re-await the same work instead of dropping it.
  const started = useRef(
    new WeakMap<RRRoute, Promise<DevHandle | undefined>>(),
  );
  useEffect(() => {
    if (!enabled) return;
    const targets = collectLazy(routes);
    if (targets.length === 0) return;
    let cancelled = false;
    void Promise.all(
      targets.map((route) => {
        let pending = started.current.get(route);
        if (!pending) {
          pending = readLazyHandle(route);
          started.current.set(route, pending);
        }
        return pending.then((handle) => [route, handle] as const);
      }),
    ).then((resolved) => {
      if (cancelled) return;
      const found = resolved.filter(
        (entry): entry is [RRRoute, DevHandle] => entry[1] != null,
      );
      setHandles((prev) =>
        found.some(([route, handle]) => prev.get(route) !== handle)
          ? new Map([...prev, ...found])
          : prev,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [routes, sig, enabled]);
  return handles;
}

/**
 * The tree with lazily-read handles filled in. A copy rather than a mutation:
 * assigning `route.handle` ourselves makes the router warn about a "static
 * property" and skip its own resolution of the lazy one.
 */
function mergeHandles(
  routes: RRRoute[],
  handles: ReadonlyMap<RRRoute, DevHandle>,
): RRRoute[] {
  let changed = false;
  const merged = routes.map((r) => {
    const handle = r.handle ?? handles.get(r);
    const children = r.children
      ? mergeHandles(r.children, handles)
      : r.children;
    if (handle === r.handle && children === r.children) return r;
    changed = true;
    return { ...r, handle, children };
  });
  return changed ? merged : routes;
}

/**
 * Read the dev routes off the active react-router data router — anything under
 * `/dev` or marked with `handle.dev` / `devLabel` / `devGroup`, plus their
 * children.
 * Pass `{ staticRoutes: true }` to include the app's ordinary routes too,
 * `{ match }` to scope the results, and `{ loadHandles: true }` to read
 * `handle` from routes whose module hasn't loaded yet (framework mode). A bare
 * matcher is accepted as shorthand.
 *
 * Re-reads the tree as the router grows it, so routes that are discovered or
 * resolved after the first render show up on their own.
 */
export function useDetectedRoutes(
  options: DetectOptions | RouteMatcher = {},
): DevRoute[] {
  const opts: DetectOptions = isMatcher(options) ? { match: options } : options;
  const { match, staticRoutes, loadHandles } = opts;
  const ctx = useContext(DataRouterContext);
  const [routes, sig] = useRouteTree(ctx?.router as RRRouter | undefined);
  const handles = useLazyHandles(routes, sig, loadHandles === true);
  // `sig` is a dep because the tree is mutated in place (see useRouteTree).
  return useMemo(() => {
    const tree = handles.size > 0 ? mergeHandles(routes, handles) : routes;
    const deduped = dedupeByPath(flattenRoutes(tree, "", { staticRoutes }));
    return match ? deduped.filter(toPredicate(match)) : deduped;
  }, [routes, sig, handles, match, staticRoutes]);
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
  /**
   * Import lazy route modules so their `handle` is visible. Needed for
   * `handle.dev` / `devLabel` / `devGroup` / `hidden` in React Router
   * framework mode. See {@link DetectOptions.loadHandles}.
   */
  loadHandles?: boolean;
}

/**
 * Drop-in {@link DevDock} for react-router apps: navigates via the SPA router
 * and auto-detects the dev routes from the active data router. Any `routes`
 * you pass are appended to the detected ones.
 */
export function ReactRouterDevDock({
  match,
  staticRoutes,
  loadHandles,
  ...props
}: ReactRouterDevDockProps) {
  const navigate = useNavigate();
  const detected = useDetectedRoutes({ match, staticRoutes, loadHandles });
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
