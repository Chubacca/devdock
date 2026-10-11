# @chuvenger/devdock

## 0.8.0

### Minor Changes

- c2d7cea: dock: default the toggle hotkey to `alt+shift+d` (⌥⇧D on Mac)
  
  The dock now claims a shortcut without being asked. Alt+Shift+letter keeps it
  off the contested ⌘/Ctrl ground — ⌘K is Firefox's search bar and most apps'
  own palette, ⌘⇧I is devtools — so the default doesn't take a key something
  else already wanted. Rebind with `hotkey`, or pass `hotkey: null` for no key at
  all.
  
  `matchHotkey` now falls back to `event.code` for Alt combos, since macOS hands
  the browser the composed character (⌥⇧D arrives as "Î", not "d").
  
  Because the default is deliberately unguessable, the popup's heading names it:
  a `<kbd>` on the right, styleable as the new `hotkeyHint` part
  (`.devdock-hotkey-hint`), hidden when `hotkey` is `null`. The floating button's
  tooltip names it too, for when the popup is shut. `formatHotkey(spec)` and
  `DEFAULT_HOTKEY` are exported for rendering a hint of your own.
  
  One note for themers: `.devdock-title` is now `display: flex` (it holds the
  title and the hint), where before it was a plain block of text.

## 0.7.0

### Minor Changes

- f3207f1: dock: theme with custom properties, restyle any part with `classNames`, and drop the 480px height cap
  
  The popup's `max-height` was `min(70vh, 480px)`, so it stopped growing at
  480px on any screen taller than ~690px. It's now `70vh`, uncapped.
  
  The dock's own styling moves from inline styles to a stylesheet it injects
  itself (still nothing to import). Colours, radii, the font and the popup's
  size now read from `--devdock-*` custom properties, which inherit *through*
  the shadow boundary — so theming needs no change to the isolation, no classes
  and no stylesheet of yours reaching in:
  
  ```css
  :root {
    --devdock-bg: #ffffff;
    --devdock-fg: #0f172a;
    --devdock-accent: #a855f7;
    --devdock-radius: 16px;
  }
  ```
  
  For anything the properties don't cover, the new `classNames` option merges
  your classes into any of the dock's 20 parts:
  
  ```tsx
  <DevDock
    classNames={{
      panel: "w-96 bg-white text-slate-900",
      button: "bg-emerald-600 rounded-md",
      rowActive: "bg-emerald-100 text-emerald-900",
    }}
  />
  ```
  
  Each entry takes anything [`cn`](https://www.npmjs.com/package/cn) takes —
  `panel: ["bg-red-100", props.className]`, `row: ["px-3", compact && "py-1",
  { "opacity-50": muted }]` — so a wrapper can forward its own props through
  without a helper. Merging is `cn`'s, so conflicting Tailwind classes collapse
  to the last one: `rowActive: "text-emerald-900"` beats `row: "text-slate-700"`
  instead of leaving the winner to Tailwind's sheet order.
  
  `cn` is the package's first runtime dependency (zero deps of its own, ~11 kB
  gzipped, and only pulled in where the dock is).
  
  Your class is merged onto the part's own (`.devdock-panel`, …) and wins
  without `!important`: the sheet sits in a `devdock` cascade layer declared
  after Tailwind's `base` and before its `utilities`, and each rule is worth
  exactly one class. Passing `classNames` switches the `shadow` default to
  `"inherit"` so your stylesheet reaches the dock. New `cssLayer` option: a
  name of your own ships no layer-order statement (you place it), `false` drops
  the layer for an unlayered page like Tailwind v3.

## 0.6.0

### Minor Changes

- 2a34728: react-router: read `handle` from lazy route modules with `loadHandles`
  
  In React Router framework mode every route is lazy, so `handle` lives in the
  route module rather than on the route object the adapter reads — `handle.dev`,
  `devLabel`, `devGroup` and `hidden` were silently ignored there, leaving dev
  routes to be detected by the `/dev/*` path convention alone. Pass
  `loadHandles` to `ReactRouterDevDock` (or `useDetectedRoutes`) to import the
  lazy modules and read their `handle`; it also covers `lazy: () => import(...)`
  routes in a plain data router. Opt-in, since it imports every lazy route's
  module.
  
  Detection now also follows the route tree as the router grows it, so routes
  resolved or discovered after the first render (framework mode's lazy route
  discovery, `router.patchRoutes`) show up on their own instead of being frozen
  at whatever the first render saw.

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
