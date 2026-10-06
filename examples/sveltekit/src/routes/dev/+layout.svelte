<script lang="ts">
  let { children } = $props();
</script>

<!-- A layout, not a page — the detector only lists +page files. -->
{@render children()}
