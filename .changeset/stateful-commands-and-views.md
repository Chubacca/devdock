---
"@chuvenger/devdock": minor
---

Add custom views, stateful commands, and a `shadow: "inherit"` mode.

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
