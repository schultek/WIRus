<script>
  import Platform from "./components/Platform.svelte";
  import Login from "./components/Login.svelte";

  $: userEmail = "";
  $: userIsLoggedIn = false;

  let loginHandler = event => {

    userEmail = event.detail;
    userIsLoggedIn = true;

    fetch("https://wirus-app.web.app/api/platform/demo/verify?email="+userEmail)
  };
</script>

<style>

</style>

<div class="main">
  {#if userIsLoggedIn}
    <Platform user={userEmail} on:logout={() => (userIsLoggedIn = false)} />
  {:else}
    <Login on:login={loginHandler} />
  {/if}
</div>
