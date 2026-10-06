import type { DevRoute } from "./types";

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

/** Normalize any {@link RouteMatcher} into a predicate. */
export function toPredicate(match: RouteMatcher): (route: DevRoute) => boolean {
  if (typeof match === "function") return match;
  const re = match instanceof RegExp ? match : globToRegExp(match);
  return (route) => re.test(route.path);
}

export function isMatcher(value: object | RouteMatcher): value is RouteMatcher {
  return (
    typeof value === "string" ||
    typeof value === "function" ||
    value instanceof RegExp
  );
}

/**
 * Convention shared by every adapter: `/dev` and everything under it is a dev
 * destination, so a dev section needs no extra marker.
 */
export function isDevPath(path: string): boolean {
  return path === "/dev" || path.startsWith("/dev/");
}

/** Drop later routes that repeat an earlier route's path. */
export function dedupeByPath(routes: DevRoute[]): DevRoute[] {
  const seen = new Set<string>();
  return routes.filter((r) =>
    seen.has(r.path) ? false : (seen.add(r.path), true),
  );
}
