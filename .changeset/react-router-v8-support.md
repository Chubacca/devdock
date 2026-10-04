---
"@chuvenger/devdock": patch
---

react-router adapter: import from `react-router` instead of `react-router-dom`

React Router 8 dropped the `react-router-dom` package (there is no 8.x of it),
so `@chuvenger/devdock/react-router` failed to resolve `useNavigate` and
`UNSAFE_DataRouterContext` on v8. Both symbols have been exported from the
`react-router` core package since v6, so the adapter now imports from there and
works unchanged on v6, v7 and v8. The optional peer dep is now `react-router`
(`>=6`) rather than `react-router-dom`.
