# devdock example

A small Vite + React Router app that exercises the library.

```bash
bun install
bun run dev   # http://localhost:5173
```

It consumes the library **straight from `../src`** (via a Vite alias), so edits
to the library are reflected live — no rebuild needed.

## What to try

- Click the green **DEV** button in the bottom-right (or press <kbd>⌘/Ctrl</kbd> + <kbd>.</kbd>).
- Routes marked as dev destinations (`/dashboard`, `/billing`, `/style-guide`)
  are **auto-detected** from the React Router config and grouped via `handle.devGroup`.
- `/settings` carries no marker, so it appears only if you add `staticRoutes` to
  the `<ReactRouterDevDock />` in `src/App.tsx`.
- `/users/:id` (dynamic) and `/secret` (`handle.hidden`) are intentionally **not** listed.
- The **Actions / Links** commands show custom handlers, including a `keepOpen` one.
- The **State** commands are stateful: `Theme: …` has a function label that
  re-reads as you flip it, and `Freeze animations` uses `checked` to render a
  check mark (and really does stop the pulsing dot).
- **Frame rate**, **Theme** and **Session** are custom `views` — React
  components portaled into the popup (`src/dev-views.tsx`). The frame-rate
  meter's `requestAnimationFrame` loop starts when the popup opens and stops
  when it closes; open the panel, close it, and watch the loop stop.
- Those views are styled by the app's own `src/app.css`, which only reaches
  them because the dock is configured with `shadow="inherit"` in `src/App.tsx`.
  Remove that prop and they render unstyled — that's the shadow boundary.

> The dock only renders in development. `bun run build && bun run preview`
> serves a production build where it's hidden — that's expected.
