<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { devdock } from "@chuvenger/devdock/sveltekit";
  import type { DevCommand } from "@chuvenger/devdock/sveltekit";

  let { children } = $props();

  // The glob has to live in your app — Vite resolves it at build time. Every
  // `+page.svelte` under src/routes comes back as a key; the dock keeps the
  // ones under /dev.
  const modules = import.meta.glob("/src/routes/**/+page.svelte");

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
      label: "Log the current path (stays open)",
      group: "Actions",
      keepOpen: true,
      run: () => console.log("at:", $page.url.pathname),
    },
  ];

  const options = $derived({
    title: "SvelteKit Dev Menu",
    hotkey: "mod+.",
    modules,
    commands,
    // Client-side navigation instead of a full page load.
    onNavigate: (path: string) => goto(path),
  });
</script>

<nav>
  <a href="/">Home</a>
  <a href="/billing">Billing</a>
</nav>

{@render children()}

<!-- The action mounts the dock; this element is just an anchor. -->
<div use:devdock={options}></div>

<style>
  :global(body) {
    font-family: ui-sans-serif, system-ui, sans-serif;
    margin: 0;
    color: #1a1a1a;
  }
  nav {
    display: flex;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid #e5e5e5;
  }
  :global(main) {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 24px;
    line-height: 1.6;
  }
</style>
