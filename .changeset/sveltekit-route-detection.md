---
"@chuvenger/devdock": minor
---

Add a SvelteKit route detector at `@chuvenger/devdock/sveltekit`.

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
