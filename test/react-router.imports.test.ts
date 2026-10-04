import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the React Router 8 break: v8 ships no `react-router-dom`
// package, so the adapter must reach `useNavigate` / `UNSAFE_DataRouterContext`
// through the `react-router` core package (which has exported both since v6).
// Importing `react-router-dom` made the whole entry unresolvable on v8.
//
// This asserts on source text instead of importing the adapter on purpose: if
// the specifier regresses, this file still loads and reports *why*, rather than
// dying in module resolution the way every other suite would.
describe("react-router adapter imports", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/react/react-router.tsx"),
    "utf8",
  );
  const importedFrom = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
    (m) => m[1],
  );

  it("pulls router APIs from react-router, not react-router-dom", () => {
    expect(importedFrom).toContain("react-router");
    expect(importedFrom).not.toContain("react-router-dom");
  });

  it("does not import react-router-dom anywhere", () => {
    expect(source).not.toMatch(/import[\s\S]*?"react-router-dom"/);
  });
});
