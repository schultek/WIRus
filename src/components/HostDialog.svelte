<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $: host = "";
  $: hostValid = true;

  const testEmail = () => {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(host).toLowerCase());
  };

  const dispatchEvent = () => {
    if (testEmail()) {
      dispatch("close", host);
    } else {
      hostValid = false;
    }
  };
</script>

<style>
  .dialog-wrapper {
    display: flex;
    flex-flow: column;
    align-items: center;
    background: white;
    border-radius: 20px;
    box-shadow: 0 0 10px -4px rgba(0,0,0,.2);
    padding: 20px 40px 40px 40px;
  }

  .action-title {
    font-weight: 600;
    font-size: 18px;
    margin-top: 10px;
    margin-bottom: 50px;
    text-align: center;
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

  button {
    margin-top: 20px;
    width: 100%;
  }
</style>

<div class="dialog-wrapper">
  <div class="action-title">Host Email</div>
  <input bind:value={host} placeholder="Email" class:error={!hostValid} />
  <button on:click={dispatchEvent}>Weiter</button>

</div>

  <div class="info">
      Manche Aktionen haben einen Host, der diese managed oder derjenige, der die Hilfeleistung empfängt. 
      Hosts können Mails empfangen, um nach der Bestätigung für einen Helfer gefragt zu werden.<br/>
      Dazu musst du die Aktion starten und über die App die Bestätigung anfragen.<br/><br/>

      (Trage zum testen deine eigene Email ein.  Bitte gehe verantwortungsvoll damit um und trage keine fremde Email ein!)
  </div>