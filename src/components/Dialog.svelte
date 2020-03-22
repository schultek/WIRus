<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let action;

  const onOverlayClickHandler = () => {
    dispatch("close");
  };

  export let host;
</script>

<style>
  .dialog-wrapper {
    position: absolute;
    z-index: 3;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 20px;
    box-shadow: 0 0 20px 5px rgba(0, 0, 0, 0.2);
    padding: 40px 40px 20px 40px;
    display: flex;
    flex-flow: column;
    align-items: center;
  }

  .action-tag {
    background: #ff8811;
    color: white;
    font-weight: 500;
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 14px;
  }

  .action-title {
    font-weight: 600;
    font-size: 18px;
    margin-top: 10px;
    margin-bottom: 50px;
    text-align: center;
  }

  .action-hint {
    font-size: 12px;
    padding-top: 15px;
  }

  .overlay {
    position: absolute;
    z-index: 2;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: black;
    opacity: 0.1;
  }
</style>

<div class="overlay" on:click={onOverlayClickHandler} />
<div class="dialog-wrapper">
  <div class="action-tag">Action</div>
  <div class="action-title">{action.title}</div>

  {#if action.confirmable}
    <button on:click={() => dispatch('signup')}>Eintragen</button>
    <span class="action-hint">
        Du erhälst punkte, sobald die Aktion abgeschlossen ist und dein Host {host} dies bestätigt hat.
    </span>
  {:else}
    <button on:click={() => dispatch('complete')}>Jetzt helfen</button>
    <span class="action-hint">Du erhälst sofort punkte.</span>
  {/if}

</div>
