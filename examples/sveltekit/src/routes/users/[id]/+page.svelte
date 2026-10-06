<script lang="ts">
  import { page } from "$app/stores";
</script>

<main>
  <h1>User {$page.params.id}</h1>
  <p>
    A dynamic route. The dock skips these — they need an argument. To reach one,
    add a command that navigates to a known id.
  </p>
</main>
