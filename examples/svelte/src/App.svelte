<script lang="ts">
  import { devdock } from "@chuvenger/devdock/svelte";
  import type { DevRoute, DevCommand } from "@chuvenger/devdock/svelte";

  // Plain Svelte has no router, so we model "navigation" as local state.
  let page = $state("/");

  const routes: DevRoute[] = [
    { path: "/", label: "Home" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/settings", label: "Settings", group: "Internal" },
    { path: "/billing", label: "Billing", group: "Internal" },
  ];

  const commands: DevCommand[] = [
    {
      label: "Reset demo state",
      group: "Actions",
      run: () => {
        localStorage.clear();
        alert("Local storage cleared.");
      },
    },
    {
      label: "Log a timestamp (stays open)",
      group: "Actions",
      keepOpen: true,
      run: () => console.log("tick:", new Date().toISOString()),
    },
    {
      label: "Open Svelte docs",
      group: "Links",
      run: () => window.open("https://svelte.dev", "_blank"),
    },
  ];

  // Reactive options: the action's update() fires whenever this changes.
  const options = $derived({
    title: "Svelte Dev Menu",
    hotkey: "mod+.",
    routes,
    commands,
    onNavigate: (p: string) => (page = p),
  });
</script>

<main>
  <h1>devdock + Svelte</h1>
  <p>Current page: <code>{page}</code></p>
  <p>
    Open the green <strong>DEV</strong> button in the bottom-right (or press
    <kbd>⌘/Ctrl</kbd> + <kbd>.</kbd>). Selecting a route updates the page state
    via <code>onNavigate</code>; commands run their handlers.
  </p>
  <p>The dock is the same core used by the React adapter — no React here.</p>
</main>

<!-- The action mounts the dock; this element is just an anchor. -->
<div use:devdock={options}></div>

<style>
  main {
    font-family: ui-sans-serif, system-ui, sans-serif;
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 24px;
    line-height: 1.6;
    color: #1a1a1a;
  }
</style>
