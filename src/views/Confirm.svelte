<script>
  import { onMount } from "svelte";

  $: status = "loading";

  onMount(async () => {
    let res = await fetch(
      "https://wirus-app.firebaseapp.com/api/confirm" + window.location.search
    );

    if (res.status == 200) {
      console.log("YAY");
      status = "done";
    } else {
      console.log("NEY");
      status = "error";
    }
  });
</script>

<style>
  html,
  body {
    margin: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .background-card {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: -1;
    transform: translate(-50%, -50%);
    background: #00a676;
    box-shadow: 3px 3px 10px -2px rgba(0, 0, 0, 0.2);
    transition: width 1s, height 1s, border-radius 1s, background-color 1s;

    width: 200px;
    height: 200px;
    border-radius: 20px;
  }
  #wrapper.done .background-card {
    width: 200vw;
    height: 200vh;
    border-radius: 100%;
    background-color: #73e2a7;
  }
  #wrapper.error .background-card {
    width: 300px;
    height: 300px;
    max-width: 90vw;
  }

  .loading-wrapper {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: white;
    transition: opacity 0.4s;
  }
  #wrapper.done .loading-wrapper,
  #wrapper.error .loading-wrapper {
    opacity: 0;
  }

  .success-wrapper {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    color: #2e2e2e;
    text-align: center;
    display: flex;
    flex-flow: column;
    align-items: center;
    transition: opacity 0.4s;
  }
  .tagline {
    display: flex;
    align-items: center;
    font-size: 2rem;
    margin-bottom: 30px;
  }
  h2 {
    margin-right: 20px;
    margin-top: 0;
    margin-bottom: 0;
  }
  .subline {
    max-width: 200px;
  }
  #wrapper.done .success-wrapper {
    opacity: 1;
  }

  .error-wrapper {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    color: white;
    text-align: center;
    display: flex;
    flex-flow: column;
    align-items: center;
    transition: opacity 0.4s;
  }
  #wrapper.error .error-wrapper {
    opacity: 1;
  }
</style>

<svelte:head>
  <title>WIRus Action Confirmation</title>
</svelte:head>
<div id="wrapper" class={status}>
  <div class="background-card" />

  <div class="loading-wrapper">
    <i class="fas fa-circle-notch fa-spin fa-4x" />
  </div>

  <div class="success-wrapper">
    <div class="tagline">
      <h2>Danke</h2>
      <i class="em em---1" />
    </div>
    <div class="subline">
      Mit deiner Unterstützung kann sich der
      <b>WIRus</b>
      weiter verbreiten.
    </div>

  </div>

  <div class="error-wrapper">
    <div class="tagline">
      <h2>Ups</h2>
      <i class="em em-confused" />
    </div>
    <div class="subline">Etwas ist schiefgelaufen.</div>

  </div>

</div>
