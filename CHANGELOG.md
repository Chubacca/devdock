# @chuvenger/devdock

## 0.5.0

### Minor Changes

- a9250f9: Add custom views, stateful commands, and a `shadow: "inherit"` mode.
  
  A command could only ever express an action, so anything with a value that
  changes — a frame-rate meter, a sync status, a device id — had no home in the
  dock. Three additive changes close that gap; no existing option changes meaning.
  
  **Stateful commands.** `DevCommand.label` now accepts a function, and a new
  `checked` predicate renders a check mark and makes the row a real toggle
  (`role="checkbox"` + `aria-checked`). Both are re-read on every render of the
  open panel and written onto the existing row, so the node under the pointer
  survives:
  
  ```ts
  { id: "freeze", label: () => `Theme: ${theme}`, checked: () => frozen, keepOpen: true, run: toggle }
  ```
  
  **Custom views.** `views` mounts your own UI inside the popup, keeping the
  dock's shell, hotkey, filter, route detection and dev-gating. The core contract
  is framework-free — fill the host element, return a teardown — and views are
  mounted when the popup opens and torn down when it closes, so a
  `requestAnimationFrame` loop inside one is correct rather than a leak. A view
  whose `id` is unchanged is never remounted by `update()`.
  
  ```ts
  { id: "fps", label: "Frame rate", order: "after", mount: (host) => { …; return () => stop(); } }
  ```
  
  The React adapter takes `render: () => ReactNode` instead and `createPortal`s
  into the dock, so views stay part of your React tree; the core keeps no React
  import.
  
  **`shadow: "inherit"`.** A view that renders your app's own components renders
  unstyled inside the dock's shadow root, because the document's stylesheet
  doesn't cross it. The new third mode keeps the shadow root but copies
  `document.adoptedStyleSheets` and the document's `<style>` / `<link>` nodes
  into it, re-syncing as your bundler injects or edits them. Isolation stays the
  default.

## 0.4.1

### Patch Changes

- 9df8275: Check Vite's `import.meta.env.DEV` first in the default dev gate.
  
  Under Vite-family bundlers (Vite, SvelteKit, React Router 7, Astro…) the build
  half of the gate now reads `import.meta.env.DEV`, the flag those bundlers
  actually inline, and falls back to `process.env.NODE_ENV !== "production"`
  everywhere else (webpack, Next, plain Node, the CJS build). Both tokens are
  replaced statically, so a production bundle still collapses the gate to a
  constant. The dev-host check is unchanged.

## 0.4.0

### Minor Changes

- eb4dfca: Add a SvelteKit route detector at `@chuvenger/devdock/sveltekit`.
  
  SvelteKit has no runtime route table, so the new entry reads the routes off an
  `import.meta.glob` of your page files, which you pass in as `modules`:
  
  ```svelte
  <script lang="ts">
    import { goto } from "$app/navigation";
    import { devdock } from "@chuvenger/devdock/sveltekit";
  
    const modules = import.meta.glob("/src/routes/**/+page.svelte");
  </script>
  
  <div use:devdock={{ modules, onNavigate: goto }}></div>
  ```
  
  As with the React Router adapter, only dev destinations are listed — `/dev` and
  everything under it — with `staticRoutes` for the whole app and `match` to
  scope the results. Paths are derived the way SvelteKit derives URLs: layout
  groups and optional params drop out, non-page files are ignored, and routes
  that need arguments (`[id]`, `[id=int]`, `[...rest]`) are skipped.
  
  `detectRoutes` and `routeFromFile` are exported too, for building your own UI
  or feeding the plain `devdock` action.

## 0.3.0

### Minor Changes

- c65ea8b: The dock now also requires a **dev host**, not just a dev build.
  
  `NODE_ENV !== "production"` can't tell a developer's machine from a development
  build deployed to a real URL — a preview deploy, a staging box, or
  `vite build --mode development` all report the same thing, and the dock would
  show up there for anyone who opened the page. By default it now renders only
  when the page is served from loopback (`localhost`, `127.0.0.1`, `::1`), an
  mDNS `.local` name, or a private LAN address (`10.x`, `172.16–31.x`,
  `192.168.x` — so testing from a phone on the same Wi-Fi still counts).
  
  Pass the new `devHostOnly={false}` to keep the build check but allow any
  hostname:
  
  ```tsx
  <DevDock devHostOnly={false} />
  ```
  
  `enabled` is unchanged and still takes over the gating completely — both checks
  are skipped when it's set.

## 0.2.0

### Minor Changes

- 45cd5f3: The dock now anchors to the **bottom-right** corner by default (was
  bottom-left). Pass `position="bottom-left"` to keep the old placement.
- 45cd5f3: react-router: only auto-detect dev routes by default; static routes are opt-in.
  
  `<ReactRouterDevDock />` used to list every static route in the app, which left
  the dock full of pages you never jump to from it. It now lists only dev
  destinations: routes under `/dev`, and routes marked via React Router's
  `handle` — `{ dev: true }`, `devLabel`, or `devGroup` — plus everything nested
  under either (which also inherits the marked route's `devGroup`).
  
  Pass `staticRoutes` to get the old behavior:
  
  ```tsx
  <ReactRouterDevDock staticRoutes />
  ```
  
  `useDetectedRoutes` now takes `{ match?, staticRoutes? }` (a bare matcher still
  works), and `flattenRoutes` takes a third `{ staticRoutes }` argument.

## 0.1.3

### Patch Changes

- 4747dbd: dock: fix rows not responding to real mouse clicks
  
  Each row re-rendered the whole list on `mouseenter`, which replaced the node
  under the pointer — so the browser kept rebuilding the list at frame rate while
  the pointer rested over it, and `mousedown`/`mouseup` landed on different nodes,
  meaning no `click` was ever dispatched on the row. Clicking a row with a real
  mouse did nothing; keyboard navigation was unaffected. `renderList()` now reuses
  the existing row nodes when the item list is unchanged, and hover/arrow
  navigation only repaints the highlight. Arrow keys also scroll the active row
  into view.

## 0.1.2

### Patch Changes

- fe6aebb: react-router adapter: import from `react-router` instead of `react-router-dom`
  
  React Router 8 dropped the `react-router-dom` package (there is no 8.x of it),
  so `@chuvenger/devdock/react-router` failed to resolve `useNavigate` and
  `UNSAFE_DataRouterContext` on v8. Both symbols have been exported from the
  `react-router` core package since v6, so the adapter now imports from there and
  works unchanged on v6, v7 and v8. The optional peer dep is now `react-router`
  (`>=6`) rather than `react-router-dom`.

## 0.1.1

### Patch Changes

- 8600e72: Add npm version and license badges to the README.
