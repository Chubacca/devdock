---
"@chuvenger/devdock": minor
---

react-router: only auto-detect dev routes by default; static routes are opt-in.

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
