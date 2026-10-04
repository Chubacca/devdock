# devdock

[![npm version](https://img.shields.io/npm/v/@chuvenger/devdock.svg)](https://www.npmjs.com/package/@chuvenger/devdock)
[![license](https://img.shields.io/npm/l/@chuvenger/devdock.svg)](./LICENSE)

A tiny, dependency-free dev-only floating button. It sits in a corner of your
app, **only renders in development**, and opens a popup to jump between dev
routes and run custom commands.

- 🔒 **Dev-gated by default** — hidden when `process.env.NODE_ENV === "production"`. Fully overridable.
- 🧭 **Route jumper** — list routes manually, or auto-detect them from React Router.
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

In production the component renders nothing, so it's safe to leave mounted.

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

Render it inside the router tree. Dynamic (`:id`) and splat (`*`) routes are
skipped since they need arguments. Customize per route via React Router's
`handle`:

```tsx
{ path: "reports", element: <Reports />, handle: { devLabel: "Reports", devGroup: "Internal", hidden: false } }
```

**Scope which routes are detected** with `match` — a glob (`*` = any
characters), a `RegExp`, or a predicate. Manual `routes` are always included:

```tsx
<ReactRouterDevDock match="/dev/*" />          // only routes under /dev
<ReactRouterDevDock match={/^\/(admin|dev)/} />
<ReactRouterDevDock match={(r) => r.path.length < 20} />
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

`enabled` overrides the default `NODE_ENV` check — pass a boolean or a
predicate (re-evaluated on every update):

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
| `enabled`    | `boolean \| (() => boolean)`  | `NODE_ENV !== "production"`          | Whether to render at all. A predicate is re-checked on every update. |
| `onNavigate` | `(path: string) => void`      | `window.location.assign`             | How to navigate on route select. |
| `position`   | `"bottom-left" \| "bottom-right" \| "top-left" \| "top-right"` | `"bottom-left"` | Corner. |
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

- `ReactRouterDevDock(props)` — `DevDock` wired to `useNavigate()` + auto-detected routes. Extra prop: `match?: RouteMatcher`.
- `useDetectedRoutes(match?): DevRoute[]` — the detected routes, optionally scoped (build your own UI).
- `flattenRoutes(routes, parent?): DevRoute[]` — pure helper that flattens a route tree.
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
bun run test        # vitest (core + react + svelte + react-router)
bun run build       # tsup → dist (ESM + CJS + d.ts, one entry per adapter)
bun run typecheck
```

## License

MIT
