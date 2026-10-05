import { createRequire } from "node:module";
import { createMemoryRouter } from "react-router";
import { createMemoryRouter as createMemoryRouterV7 } from "react-router-v7";
import { describe, expect, it } from "vitest";

// Guards the two-pass setup that gives the adapter real coverage on both
// supported router majors: the default vitest config runs against the
// installed react-router 8, `vitest.rr7.config.ts` re-runs this suite with the
// bare `react-router` specifier aliased to the `react-router-v7` devDep.
//
// Without these assertions the v7 pass could silently degrade into a second v8
// run (a typo in the alias, a dropped devDep) and nobody would notice.
const require = createRequire(import.meta.url);
const major = (pkg: string): number =>
  Number(require(`${pkg}/package.json`).version.split(".")[0]);

/** Set only by `vitest.rr7.config.ts`. */
const targetsV7 = process.env.DEVDOCK_REACT_ROUTER === "7";

describe("react-router version matrix", () => {
  it("installs both majors to test against", () => {
    expect(major("react-router")).toBe(8);
    expect(major("react-router-v7")).toBe(7);
  });

  it("binds `react-router` to the version this pass targets", () => {
    // Same module object iff the v7 alias is in effect.
    expect(createMemoryRouter === createMemoryRouterV7).toBe(targetsV7);
  });
});
