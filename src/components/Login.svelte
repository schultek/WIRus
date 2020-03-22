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
    align-items: center;
    background: white;
    border-radius: 20px;
    box-shadow: 0 0 10px -4px rgba(0,0,0,.2);
    padding: 20px 40px 40px 40px;
  }

  button {
    margin-top: 20px;
    width: 100%;
  }

  h2 {
      margin-bottom: 30px;
  }

  .info {
      text-align: center;
      max-width: 280px;
      line-height: 1.5em;
      margin: 0 auto;
      font-size: 12px;
      margin-top: 20px;
      color: #333;
  }
</style>

<div class="login-wrapper">
    <h2>Demo Platform</h2>
  <input bind:value={email} placeholder="Email" class:error={!emailValid} />
  <button on:click={dispatchLoginEvent}>Login</button>
</div>

    <div class="info">
    Das ist eine Demo einer Helfer-Platform, um zu zeigen, wie eine 
    Platform mit der App integriert werden kann. Aktivitäten, die du über 
    diese Platform machst werden automatisch in deiner App angezeigt und 
    zu deinem Score hinzugefügt.
    </div>
