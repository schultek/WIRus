<script>
  import Platform from "./components/Platform.svelte";
  import Login from "./components/Login.svelte";
  import HostDialog from "./components/HostDialog.svelte"

  $: userEmail = "";
  $: userIsLoggedIn = false;
  $: host = "";

  let loginHandler = event => {

    userEmail = event.detail;
    userIsLoggedIn = true;

    fetch("https://wirus-app.web.app/api/platform/demo/verify?email="+userEmail+"&token=1234")
  };

  let hostHandler = event => {
    host = event.detail;
  }

  const logoutHandler = event => {
    userIsLoggedIn = false;
    userEmail = "";
    host = "";
  }
</script>

<style>

</style>

<div class="main">
  {#if userIsLoggedIn && host}
    <Platform user={userEmail} host={host} on:logout={logoutHandler} />
  {:else if !userEmail}
    <Login on:login={loginHandler} />
  {:else}
    <HostDialog on:close={hostHandler}/>
  {/if}
</div>
