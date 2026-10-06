# devdock + SvelteKit example

A minimal SvelteKit app that uses the `use:devdock` action from
`@chuvenger/devdock/sveltekit`, with its dev routes auto-detected.

```bash
bun install
bun run dev   # http://localhost:5173
```

It consumes the library **straight from `../../src`** via a Vite alias, so
edits to the library are live.

## What to try

- Click the green **DEV** button in the bottom-right (or press <kbd>⌘/Ctrl</kbd> + <kbd>.</kbd>).
- The **Routes** section lists `/dev`, `/dev/flags` and `/dev/inspector` —
  detected from `import.meta.glob("/src/routes/**/+page.svelte")` in
  `src/routes/+layout.svelte`. Nothing was registered by hand.
- `/` and `/billing` are ordinary pages, so they stay out (pass
  `staticRoutes: true` to list them too), and `/users/[id]` is skipped because
  it needs an argument.
- Selecting a route navigates through SvelteKit's `goto`, so there's no full
  page load.
