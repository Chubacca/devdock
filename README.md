# devdock

[![npm version](https://img.shields.io/npm/v/@chuvenger/devdock.svg)](https://www.npmjs.com/package/@chuvenger/devdock)
[![license](https://img.shields.io/npm/l/@chuvenger/devdock.svg)](./LICENSE)

A tiny, dependency-free dev-only floating button. It sits in a corner of your
app, **only renders in development**, and opens a popup to jump between dev
routes and run custom commands.

- 🔒 **Dev-gated by default** — renders only in a dev build served from a dev host (localhost/LAN), so it never ships to a real URL. Fully overridable.
- 🧭 **Route jumper** — list routes manually, or auto-detect your `/dev` routes from React Router.
- ⚡ **Custom commands** — register any action (reset DB, toggle a flag, copy a token…).
- 🔎 Filter box + keyboard nav (↑/↓/Enter/Esc) and an optional global hotkey.
- 🎨 Zero CSS to import — inline-styled, high z-index, no runtime dependencies.
- 🛡️ **Shadow DOM isolated** by default — the host page's CSS can't touch it (and vice versa).
- 🧩 **Framework-agnostic core** with thin **React** and **Svelte** adapters.

## Architecture

The button, popup, filtering, keyboard handling, and dev-gating live in a
framework-free core (`createDevDock`) that builds DOM directly. The framework
adapters are tiny wrappers that drive its `create → update → destroy`
lifecycle:

| Import | What you get |
| ------ | ------------ |
| `@chuvenger/devdock` | `createDevDock(options)` — vanilla core, works anywhere |
| `@chuvenger/devdock/react` | `<DevDock />` React component |
| `@chuvenger/devdock/react-router` | `<ReactRouterDevDock />` + route auto-detection |
| `@chuvenger/devdock/svelte` | `use:devdock` Svelte action |

`react`, `react-dom`, `react-router`, and `svelte` are all **optional** peer
deps — install only what your adapter needs. The react-router adapter imports
from `react-router`, so it works on v6, v7 and v8 (v8 removed the
`react-router-dom` package; on v6/v7 `react-router` ships alongside it).

## Install

```bash
npm install @chuvenger/devdock
# or: bun add @chuvenger/devdock / pnpm add @chuvenger/devdock
```

## React

```tsx
import { DevDock } from "@chuvenger/devdock/react";

export function App() {
  return (
    <>
      {/* …your app… */}
      <DevDock
        routes={[
          { path: "/admin", label: "Admin" },
          { path: "/style-guide", label: "Style guide" },
        ]}
        commands={[
          { label: "Reset onboarding", run: () => localStorage.clear() },
          { label: "Log current user", run: async () => console.log(await getUser()) },
        ]}
        hotkey="mod+."
      />
    </>
  );
}
```

Outside development the component renders nothing, so it's safe to leave
mounted.

### React Router (auto-detected routes)

For a React Router **data router** (`createBrowserRouter`), use the dedicated
entry. It navigates through the SPA router (no full reload) and discovers your
routes automatically:

```tsx
import { ReactRouterDevDock } from "@chuvenger/devdock/react-router";

function Layout() {
  return (
    <>
      <Outlet />
      <ReactRouterDevDock commands={[{ label: "Reload", run: () => location.reload() }]} />
    </>
  );
}
```

The adapter imports `useNavigate` / `UNSAFE_DataRouterContext` from
`react-router` (the core package), which covers v6, v7 and v8. On v6/v7 that
package comes in via `react-router-dom`; with a strict package manager (pnpm)
add `react-router` to your own deps so it resolves.

Render it inside the router tree. **Only dev routes are listed by default.** A
route counts as one if it lives under `/dev`, or if you opt it in via React
Router's `handle`:

```tsx
{ path: "/dev/inspector", element: <Inspector /> }                // by convention
{ path: "reports", element: <Reports />, handle: { dev: true } }  // opted in
{ path: "flags", element: <Flags />, handle: { devLabel: "Feature Flags", devGroup: "Internal" } }
```

Any of `dev`, `devLabel` or `devGroup` marks a route, and both the convention
and the mark cover the whole subtree — put one on a section's layout route and
every page inside shows up (inheriting its `devGroup`). Use `handle.hidden` to
drop one back out.

**Want the whole app listed?** Set `staticRoutes` and every static route is
detected, marked or not:

```tsx
<ReactRouterDevDock staticRoutes />
```

Dynamic (`:id`) and splat (`*`) routes are always skipped since they need
arguments — to reach one, use a command that navigates to a known id:

```tsx
<ReactRouterDevDock commands={[{ label: "Sample user", run: () => navigate("/users/42") }]} />
```

**Scope what's detected** with `match` — a glob (`*` = any characters), a
`RegExp`, or a predicate. Manual `routes` are always included:

```tsx
<ReactRouterDevDock staticRoutes match="/dev/*" />   // only routes under /dev
<ReactRouterDevDock staticRoutes match={/^\/(admin|dev)/} />
<ReactRouterDevDock staticRoutes match={(r) => r.path.length < 20} />
```

## Svelte

`@chuvenger/devdock/svelte` exports a Svelte action — no extra build step, works
in any Svelte 4/5 app:

```svelte
<script lang="ts">
  import { devdock } from "@chuvenger/devdock/svelte";

  const options = {
    routes: [{ path: "/admin", label: "Admin" }],
    commands: [{ label: "Reset", run: () => localStorage.clear() }],
    hotkey: "mod+.",
    onNavigate: (path) => goto(path), // e.g. SvelteKit's goto
  };
</script>

<!-- The dock mounts to document.body; this element is just an anchor. -->
<div use:devdock={options}></div>
```

Reactive `options` flow through automatically (the action's `update` re-renders).

## Vanilla / any framework

```ts
import { createDevDock } from "@chuvenger/devdock";

const dock = createDevDock({
  routes: [{ path: "/admin", label: "Admin" }],
  commands: [{ label: "Reset", run: () => localStorage.clear() }],
});

// later…
dock.update({ enabled: false }); // hide
dock.destroy();                  // remove entirely
```

Use this to build a Vue/Angular/web-component adapter, or wire it up by hand.

## Controlling when it shows

By default the dock renders only when **both** of these hold:

1. **It's a dev build** — `process.env.NODE_ENV !== "production"`, the token
   every bundler inlines.
2. **It's served from a dev host** — loopback (`localhost`, `127.0.0.1`,
   `::1`), an mDNS `.local` name, or a private LAN address (`10.x`,
   `172.16–31.x`, `192.168.x`, so hitting your dev server from a phone on the
   same Wi-Fi still counts).

The second check catches what `NODE_ENV` alone can't: a **development build
deployed to a real URL** — a preview deploy, a staging box, `vite build --mode
development` — still reports `NODE_ENV !== "production"`, and would otherwise
show the dock to anyone who opened it.

Pass `devHostOnly={false}` to keep the build check but allow any hostname
(a shared staging environment, a dev tunnel like ngrok or Cloudflare Tunnel):

```tsx
<DevDock devHostOnly={false} />
```

`enabled` takes over the gating entirely — both checks are skipped when it's
set. Pass a boolean or a predicate (re-evaluated on every update):

```tsx
// Show in dev, plus in prod when ?debug is present:
<DevDock enabled={import.meta.env.DEV || location.search.includes("debug")} />

// Or a callback, e.g. gate on a role or a runtime flag:
<DevDock enabled={() => currentUser?.isStaff ?? false} />
```

To strip it from production bundles entirely, gate the element so the minifier
tree-shakes it: `{import.meta.env.DEV && <DevDock … />}`.

## Styling & isolation

The dock is styled entirely with inline styles (no stylesheet to import) and,
by default, renders inside an **open shadow root** attached to a host element in
`document.body`. That means the host page's CSS can't leak in and the dock's
styles can't leak out. Pass `shadow: false` to render in the light DOM instead
(e.g. if you want to override its look from the page). The host element carries
a `data-devdock` attribute either way.

## API

### Options (shared by every adapter)

| Option       | Type                          | Default                              | Description |
| ------------ | ----------------------------- | ------------------------------------ | ----------- |
| `routes`     | `DevRoute[]`                  | `[]`                                 | Navigable destinations. |
| `commands`   | `DevCommand[]`                | `[]`                                 | Custom actions. |
| `enabled`    | `boolean \| (() => boolean)`  | dev build **and** dev host           | Whether to render at all. Overrides both default checks. A predicate is re-checked on every update. |
| `devHostOnly`| `boolean`                     | `true`                               | Also require a localhost/LAN hostname, so dev builds on real URLs stay hidden. Ignored when `enabled` is set. |
| `onNavigate` | `(path: string) => void`      | `window.location.assign`             | How to navigate on route select. |
| `position`   | `"bottom-left" \| "bottom-right" \| "top-left" \| "top-right"` | `"bottom-right"` | Corner. |
| `label`      | `string`                      | `"DEV"`                              | Button text. |
| `title`      | `string`                      | `"Dev Menu"`                         | Popup heading. |
| `hotkey`     | `string \| null`              | `null`                               | Toggle shortcut, e.g. `"mod+."`. |
| `zIndex`     | `number`                      | `2147483000`                         | Base z-index. |
| `container`  | `HTMLElement`                 | `document.body`                      | Where to mount. |
| `shadow`     | `boolean`                     | `true`                               | Render in a shadow root (CSS-isolated). Set `false` for light DOM. |

`DevRoute`: `{ path: string; label?: string; group?: string }`

`DevCommand`: `{ label: string; run: () => void | Promise<void>; id?: string; group?: string; keepOpen?: boolean }`

### `@chuvenger/devdock` (core)

- `createDevDock(options?): { update(options), destroy() }` — mounts the dock; no-ops during SSR (no `document`).
- `matchHotkey(spec, event)` — the hotkey matcher (exported for reuse).

### `@chuvenger/devdock/react-router`

- `ReactRouterDevDock(props)` — `DevDock` wired to `useNavigate()` + auto-detected routes. Extra props: `match?: RouteMatcher`, `staticRoutes?: boolean`.
- `useDetectedRoutes(options?): DevRoute[]` — the detected routes (build your own UI). Takes `{ match?, staticRoutes? }`, or a bare matcher.
- `flattenRoutes(routes, parent?, options?): DevRoute[]` — pure helper that flattens a route tree.
- `RouteMatcher` — `string | RegExp | ((route: DevRoute) => boolean)`.

## Examples

Runnable demos consuming the library straight from source live in
[`examples/`](./examples):

```bash
cd examples/react   && bun install && bun run dev   # React + React Router
cd examples/svelte  && bun install && bun run dev   # Svelte 5 (use:devdock)
```

## Development

```bash
bun install
bun run test        # vitest, twice: once on react-router 8, once on 7
bun run test:rr7    # just the react-router 7 pass
bun run build       # tsup → dist (ESM + CJS + d.ts, one entry per adapter)
bun run typecheck
```

The react-router adapter is the one surface that has to work across router
majors, so the suite runs twice. The default pass uses the installed
`react-router` 8 (and React 19, which v8 requires); `vitest.rr7.config.ts`
re-runs `test/react-router*` with the bare `react-router` specifier aliased to
the `react-router-v7` devDep. `test/react-router.matrix.test.ts` asserts each
pass really resolved the version it claims.

## License

MIT
