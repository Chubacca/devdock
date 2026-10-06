---
"@chuvenger/devdock": minor
---

The dock now also requires a **dev host**, not just a dev build.

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
