---
"@chuvenger/devdock": minor
---

dock: theme with custom properties, restyle any part with `classNames`, and drop the 480px height cap

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
