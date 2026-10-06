import { describe, expect, it } from "vitest";
import {
  dedupeByPath,
  isDevPath,
  isMatcher,
  toPredicate,
} from "../src/core/match";

// The route matching every adapter shares: the react-router and SvelteKit
// detectors both filter through these.
const route = (path: string) => ({ path, label: path });

describe("toPredicate", () => {
  it("treats a string as a glob where * spans any characters", () => {
    const underDev = toPredicate("/dev/*");
    expect(underDev(route("/dev/flags"))).toBe(true);
    expect(underDev(route("/dev/a/b"))).toBe(true);
    expect(underDev(route("/dev"))).toBe(false);
    expect(underDev(route("/billing"))).toBe(false);
  });

  it("anchors the glob at both ends", () => {
    const exact = toPredicate("/admin");
    expect(exact(route("/admin"))).toBe(true);
    expect(exact(route("/admin/users"))).toBe(false);
    expect(exact(route("/x/admin"))).toBe(false);
  });

  it("escapes regexp metacharacters in a glob", () => {
    // The dot is a literal, not "any character".
    const dotted = toPredicate("/a.b");
    expect(dotted(route("/a.b"))).toBe(true);
    expect(dotted(route("/axb"))).toBe(false);
    // Brackets and parens from SvelteKit-ish paths don't blow up either.
    expect(toPredicate("/users/[id]")(route("/users/[id]"))).toBe(true);
    expect(toPredicate("/(app)/dev")(route("/(app)/dev"))).toBe(true);
  });

  it("passes a RegExp and a predicate straight through", () => {
    expect(toPredicate(/^\/dev/)(route("/dev/flags"))).toBe(true);
    expect(toPredicate(/^\/dev/)(route("/billing"))).toBe(false);
    expect(toPredicate((r) => r.path.length < 5)(route("/dev"))).toBe(true);
  });
});

describe("isMatcher", () => {
  it("tells a matcher apart from an options object", () => {
    expect(isMatcher("/dev/*")).toBe(true);
    expect(isMatcher(/^\/dev/)).toBe(true);
    expect(isMatcher(() => true)).toBe(true);
    expect(isMatcher({ staticRoutes: true })).toBe(false);
    expect(isMatcher({})).toBe(false);
  });
});

describe("isDevPath", () => {
  it("covers /dev and its subtree", () => {
    expect(isDevPath("/dev")).toBe(true);
    expect(isDevPath("/dev/inspector")).toBe(true);
    expect(isDevPath("/dev/a/b")).toBe(true);
  });

  it("does not match paths that merely start with the letters", () => {
    expect(isDevPath("/developer")).toBe(false);
    expect(isDevPath("/devices")).toBe(false);
    // Only a top-level /dev section counts.
    expect(isDevPath("/admin/dev")).toBe(false);
    expect(isDevPath("/")).toBe(false);
  });
});

describe("dedupeByPath", () => {
  it("keeps the first route for each path, in order", () => {
    const routes = dedupeByPath([
      { path: "/dev", label: "Dev" },
      { path: "/billing", label: "Billing" },
      { path: "/dev", label: "Dev again" },
    ]);
    expect(routes).toEqual([
      { path: "/dev", label: "Dev" },
      { path: "/billing", label: "Billing" },
    ]);
  });

  it("leaves an already-unique list untouched", () => {
    const routes = [{ path: "/a" }, { path: "/b" }];
    expect(dedupeByPath(routes)).toEqual(routes);
  });
});
