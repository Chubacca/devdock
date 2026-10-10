# devdock

[![npm version](https://img.shields.io/npm/v/@chuvenger/devdock.svg)](https://www.npmjs.com/package/@chuvenger/devdock)
[![license](https://img.shields.io/npm/l/@chuvenger/devdock.svg)](./LICENSE)

A tiny, dependency-free dev-only floating button. It sits in a corner of your
app, **only renders in development**, and opens a popup to jump between dev
routes and run custom commands.

- 🔒 **Dev-gated by default** — renders only in a dev build served from a dev host (localhost/LAN), so it never ships to a real URL. Fully overridable.
- 🧭 **Route jumper** — list routes manually, or auto-detect your `/dev` routes from React Router or SvelteKit.
- ⚡ **Custom commands** — register any action (reset DB, toggle a flag, copy a token…), with live labels and check marks for toggles.
- 📊 **Custom views** — mount your own UI in the popup for anything a list can't say: a frame-rate meter, a sync status, a segmented control.
- 🔎 Filter box + keyboard nav (↑/↓/Enter/Esc) and an optional global hotkey.
- 🎨 Zero CSS to import — inline-styled, high z-index, no runtime dependencies.
- 🛡️ **Shadow DOM isolated** by default — the host page's CSS can't touch it (and vice versa), or `shadow: "inherit"` to let your design system in.
- 🧩 **Framework-agnostic core** with thin **React** and **Svelte** adapters.

## Architecture

The button, popup, filtering, keyboard handling, and dev-gating live in a
framework-free core (`createDevDock`) that builds DOM directly. The framework
adapters are tiny wrappers that drive its `create → update → destroy`
lifecycle:

| Import | What you get | Custom views |
| ------ | ------------ | ------------ |
| `@chuvenger/devdock` | `createDevDock(options)` — vanilla core, works anywhere | `mount(host)` → teardown |
| `@chuvenger/devdock/react` | `<DevDock />` React component | `render: () => <JSX />`, portaled in |
| `@chuvenger/devdock/react-router` | `<ReactRouterDevDock />` + route auto-detection | same as `/react` |
| `@chuvenger/devdock/svelte` | `use:devdock` Svelte action | `mount(host)` → teardown |
| `@chuvenger/devdock/sveltekit` | `use:devdock` + route auto-detection for SvelteKit | `mount(host)` → teardown |

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

### SvelteKit (auto-detected routes)

SvelteKit has no runtime route table, so the `/sveltekit` entry reads your
routes off an `import.meta.glob` of your page files. The glob has to be written
in your app — Vite resolves it at build time — so pass the result in as
`modules`:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { devdock } from "@chuvenger/devdock/sveltekit";

  const modules = import.meta.glob("/src/routes/**/+page.svelte");

  const options = {
    modules,
    onNavigate: goto, // client-side navigation instead of a full load
    hotkey: "mod+.",
  };
</script>

<div use:devdock={options}></div>
```

The glob is lazy (no page is imported), and in a production build the dock is
gated off anyway. **Only dev routes are listed by default** — `/dev` and
everything under it, matching the React Router adapter's convention. Pass
`staticRoutes` for the whole app, and `match` to scope the results:

```ts
{ modules, staticRoutes: true }                 // every page
{ modules, staticRoutes: true, match: "/admin/*" }
```

Routes are derived the way SvelteKit derives URLs: layout groups (`(app)`) and
optional params (`[[lang]]`) drop out of the path, and `+layout` / `+server` /
`+error` files are ignored. Required (`[id]`), matched (`[id=int]`) and rest
(`[...path]`) params are skipped since they need arguments — reach one with a
command instead:

```ts
{ modules, commands: [{ label: "Sample user", run: () => goto("/users/42") }] }
```

Need the routes without the action — your own UI, or to pass them to the plain
`devdock` action? `detectRoutes` is the same function, exported:

```ts
import { detectRoutes } from "@chuvenger/devdock/sveltekit";

const routes = detectRoutes(import.meta.glob("/src/routes/**/+page.svelte"));
```

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

## Stateful commands

A command is normally fire-and-forget. Two optional fields turn one into a
control that shows its own state — both are re-read on every render of the open
panel, so the row updates in place:

```tsx
<DevDock
  commands={[
    // A function label: the row shows live state.
    { id: "theme", label: () => `Theme: ${theme}`, keepOpen: true, run: toggleTheme },
    // `checked` renders a check mark and makes the row a real toggle
    // (role="checkbox" + aria-checked).
    { id: "freeze", label: "Freeze animations", checked: () => frozen, keepOpen: true, run: freeze },
  ]}
/>
```

Pair them with `keepOpen: true` so the popup stays put and you can watch the
value change. Give a command with a function `label` an explicit `id` — the id
is what keeps the row stable when the text changes.

## Custom views

Some state has no row shape at all: a frame-rate meter, four lines of sync
facts, a segmented control. Pass those in as **views** — your own UI, mounted
inside the popup, keeping the dock's shell, hotkey, filter, route detection and
dev-gating.

Views are mounted when the popup **opens** and torn down when it **closes**,
which is what makes a `requestAnimationFrame` loop or an event listener inside
one correct rather than a leak.

### React

```tsx
<DevDock
  shadow="inherit"             // ← see below: views need the app's CSS
  views={[
    { id: "fps", label: "Frame rate", render: () => <FrameRate /> },
    { id: "theme", label: "Theme", render: () => <ThemeControl value={theme} onChange={setTheme} /> },
    // Two views under one "Session" heading, below the routes/commands list.
    { id: "facts", group: "Session", order: "after", render: () => <SyncFacts /> },
    { id: "signin", group: "Session", order: "after", render: () => <SignInButton /> },
  ]}
/>
```

The component is rendered with `createPortal` into a host element the dock
owns, so it stays part of your React tree: context, hooks and state all work,
and it re-renders when the component holding `<DevDock>` does. A view whose
`id` is unchanged is **never remounted**, so re-rendering the parent is free.

### Vanilla / Svelte

The core contract is framework-free: fill the host element, return a teardown.

```ts
createDevDock({
  views: [
    {
      id: "fps",
      label: "Frame rate",
      mount: (host) => {
        let raf = requestAnimationFrame(function tick() {
          host.textContent = `${fps()} fps`;
          raf = requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(raf); // ← runs when the popup closes
      },
    },
  ],
});
```

In Svelte the same field takes a component (Svelte 5 shown; on Svelte 4 use
`new MyPanel({ target: host })` and `component.$destroy()`):

```svelte
<script lang="ts">
  import { mount, unmount } from "svelte";
  import { devdock } from "@chuvenger/devdock/svelte";
  import SyncFacts from "./SyncFacts.svelte";

  const options = {
    shadow: "inherit",
    views: [
      {
        id: "facts",
        label: "Session",
        mount: (host) => {
          const view = mount(SyncFacts, { target: host });
          return () => unmount(view);
        },
      },
    ],
  };
</script>

<div use:devdock={options}></div>
```

### Views and your CSS

The dock renders inside a shadow root, and **the document's stylesheet does not
cross that boundary** — a view that renders your app's own components renders
unstyled. If your view needs the host app's CSS, say so:

- `shadow="inherit"` — keep the shadow root, but copy the document's styles
  into it (`document.adoptedStyleSheets` plus every `<style>` and
  `<link rel="stylesheet">`, re-synced as your bundler injects or edits them).
- `shadow={false}` — render in the light DOM, where the page's CSS applies
  directly.

Isolation stays the default. Two things to know about `"inherit"`:

- The page's CSS can now reach the dock's own chrome too, and your design
  system's tokens arrive with the page's assumptions — a light-theme token
  lands on the dock's dark panel. Scope the tokens you need onto the view's
  own root.
- **The rules cross the boundary; the element tree does not.** A selector
  anchored on an ancestor outside the shadow root —
  `html[data-theme="dark"] .card`, `body.compact .row` — still won't match
  inside it. Re-apply that state on the view's own root, where it can.

`shadow` is read once, when the dock is created: a shadow root can't be
detached, so `update()` ignores it.

> Testing a view with `@testing-library/user-event`? It can't type into a
> shadow root — it installs its value interceptor from a `focus` listener on
> the document, where the event has been retargeted to the shadow host. Render
> with `shadow: false` in tests, or write the value through the native setter
> and dispatch `input` yourself.

## Controlling when it shows

By default the dock renders only when **both** of these hold:

1. **It's a dev build** — `import.meta.env.DEV` when the bundler is in the
   Vite family (Vite, SvelteKit, React Router 7, Astro…), otherwise
   `process.env.NODE_ENV !== "production"`, the token every bundler inlines.
   Both are replaced statically, so a production bundle drops the dock's gate
   to a constant `false`.
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
styles can't leak out. The host element carries a `data-devdock` attribute in
every mode.

| `shadow` | Where it renders | The page's CSS |
| -------- | ---------------- | -------------- |
| `true` (default) | shadow root | kept out |
| `"inherit"` | shadow root | copied in, and kept in sync |
| `false` | light DOM | applies directly |

Use `"inherit"` (or `false`) when a [custom view](#views-and-your-css) renders
your app's own components and needs its stylesheet. Otherwise leave it alone —
isolation is the reason the dock survives arbitrary host CSS.

## API

### Options (shared by every adapter)

| Option       | Type                          | Default                              | Description |
| ------------ | ----------------------------- | ------------------------------------ | ----------- |
| `routes`     | `DevRoute[]`                  | `[]`                                 | Navigable destinations. |
| `commands`   | `DevCommand[]`                | `[]`                                 | Custom actions. |
| `views`      | `DevView[]`                   | `[]`                                 | Custom panels, mounted while the popup is open. |
| `enabled`    | `boolean \| (() => boolean)`  | dev build **and** dev host           | Whether to render at all. Overrides both default checks. A predicate is re-checked on every update. |
| `devHostOnly`| `boolean`                     | `true`                               | Also require a localhost/LAN hostname, so dev builds on real URLs stay hidden. Ignored when `enabled` is set. |
| `onNavigate` | `(path: string) => void`      | `window.location.assign`             | How to navigate on route select. |
| `position`   | `"bottom-left" \| "bottom-right" \| "top-left" \| "top-right"` | `"bottom-right"` | Corner. |
| `label`      | `string`                      | `"DEV"`                              | Button text. |
| `title`      | `string`                      | `"Dev Menu"`                         | Popup heading. |
| `hotkey`     | `string \| null`              | `null`                               | Toggle shortcut, e.g. `"mod+."`. |
| `zIndex`     | `number`                      | `2147483000`                         | Base z-index. |
| `container`  | `HTMLElement`                 | `document.body`                      | Where to mount. |
| `shadow`     | `boolean \| "inherit"`        | `true`                               | Render in a shadow root (CSS-isolated). `"inherit"` copies the page's styles in; `false` renders in the light DOM. Read once, at creation. |

`DevRoute`: `{ path: string; label?: string; group?: string }`

`DevCommand`: `{ label: string | (() => string); run: () => void | Promise<void>; checked?: () => boolean; id?: string; group?: string; keepOpen?: boolean }`

`DevView`: `{ mount: (host: HTMLElement) => void | (() => void); id?: string; label?: string; group?: string; order?: "before" | "after" }` — on the React adapter, `render: () => ReactNode` replaces `mount`.

### `@chuvenger/devdock` (core)

- `createDevDock(options?): { update(options), destroy() }` — mounts the dock; no-ops during SSR (no `document`).
- `matchHotkey(spec, event)` — the hotkey matcher (exported for reuse).

### `@chuvenger/devdock/react`

- `DevDock(props)` — the component. Same options as the core, with `views` taking `render: () => ReactNode` instead of `mount`.
- `DevDockView` — the React view shape.

### `@chuvenger/devdock/react-router`

- `ReactRouterDevDock(props)` — `DevDock` wired to `useNavigate()` + auto-detected routes. Extra props: `match?: RouteMatcher`, `staticRoutes?: boolean`.
- `useDetectedRoutes(options?): DevRoute[]` — the detected routes (build your own UI). Takes `{ match?, staticRoutes? }`, or a bare matcher.
- `flattenRoutes(routes, parent?, options?): DevRoute[]` — pure helper that flattens a route tree.
- `RouteMatcher` — `string | RegExp | ((route: DevRoute) => boolean)`.

### `@chuvenger/devdock/sveltekit`

- `devdock(node, options)` — the Svelte action, plus `modules`, `match`, `staticRoutes` and `routesDir`. Detected routes come first, then any `routes` you pass.
- `detectRoutes(modules, options?): DevRoute[]` — the detected routes from an `import.meta.glob` (or a plain list of file paths). Takes `{ match?, staticRoutes?, routesDir? }`, or a bare matcher.
- `routeFromFile(file, options?): string | null` — pure helper mapping one page file to the route it serves (`null` if it isn't navigable).

## Examples

Runnable demos consuming the library straight from source live in
[`examples/`](./examples):

```bash
cd examples/react     && bun install && bun run dev   # React + React Router
cd examples/svelte    && bun install && bun run dev   # Svelte 5 (use:devdock)
cd examples/sveltekit && bun install && bun run dev   # SvelteKit (auto-detected routes)
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
