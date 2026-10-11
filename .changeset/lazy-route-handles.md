---
"@chuvenger/devdock": minor
---

react-router: read `handle` from lazy route modules with `loadHandles`

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
