---
"@chuvenger/devdock": patch
---

Check Vite's `import.meta.env.DEV` first in the default dev gate.

Under Vite-family bundlers (Vite, SvelteKit, React Router 7, Astro…) the build
half of the gate now reads `import.meta.env.DEV`, the flag those bundlers
actually inline, and falls back to `process.env.NODE_ENV !== "production"`
everywhere else (webpack, Next, plain Node, the CJS build). Both tokens are
replaced statically, so a production bundle still collapses the gate to a
constant. The dev-host check is unchanged.
