<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $: email = "";
  $: emailValid = true;

  const testEmail = () => {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  const dispatchLoginEvent = () => {
    if (testEmail()) {
      dispatch("login", email);
    } else {
      emailValid = false;
    }
  };
</script>

<style>
  .login-wrapper {
    display: flex;
    flex-flow: column;
  }

  button {
    margin-top: 20px;
  }
</style>

<div class="login-wrapper">
  <input bind:value={email} placeholder="Email" class:error={!emailValid} />
  <button on:click={dispatchLoginEvent}>Login</button>
</div>
