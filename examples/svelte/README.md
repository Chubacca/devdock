# devdock + Svelte example

A minimal Vite + Svelte 5 app that uses the `use:devdock` action.

```bash
bun install
bun run dev   # http://localhost:5173
```

It consumes the library **straight from `../../src`** via a Vite alias, so
edits to the library are live.

## What to try

- Click the green **DEV** button in the bottom-right (or press <kbd>⌘/Ctrl</kbd> + <kbd>.</kbd>).
- Selecting a route calls `onNavigate`, which updates local page state (plain
  Svelte has no router).
- The **Actions / Links** commands run their handlers, including a `keepOpen` one.

The dock here is rendered by the exact same framework-agnostic core the React
adapter uses — there's no React in this app.
