# @chuvenger/devdock

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
