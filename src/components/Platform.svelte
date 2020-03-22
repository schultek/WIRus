<script>
  import Dialog from "./Dialog.svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let user;
  export let host;

  const actions = [
    {
      title: "Spargel ernten",
      description:
        "Wir brauchen motivierte und ausdauernde Arbeitskräfte für die Spargelernte",
      points: 50,
      confirmable: true
    },
    {
      title: "Für Oma einkaufen",
      description: "Bitte geh für deine Oma einkaufen. Sie braucht dich. <3",
      points: 10,
      confirmable: false
    },
    {
      title: "SpendeZeit - Telefonat mit Susi",
      description:
        "Führe ein Telefonat mit Susi damit sie nicht so einsam ist.",
      points: 15,
      confirmable: false
    },
    {
      title: "Internetzugang für Bauer Peter",
      description:
        "Peter braucht Internet, aber weiß nicht wie man einen Zugang einrichtet. Hilf ihm.",
      points: 8,
      confirmable: true
    }
  ];

  const postAction = (action, completed) => {

    let body = {
      ...action,
      platform: 'demo',
      user: user,
      completed: completed
    }

    fetch("https://wirus-app.web.app/api/platform/demo/action?token=1234", {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  }

  const logoutHandler = () => {
    dispatch("logout");
  };

  $: completed = false;
  $: receivedPoints = undefined;

  const showCompleteDialog = points => {
    completed = true;
    receivedPoints = points;
    setTimeout(() => completed = false, 2000);
  }

  const showDialogForAction = action => {
    console.log(action);
    let dialog = new Dialog({
      target: document.getElementById("dialog-container"),
      props: { action, host }
    });
    dialog.$on("close", () => {
      dialog.$destroy();
    });
    dialog.$on("complete", () => {
      postAction(action, true)
      showCompleteDialog(action.points)
      dialog.$destroy();
    })
    dialog.$on("signup", () => {
      postAction(action, false)
      showCompleteDialog()
      dialog.$destroy();
    })
  };
</script>

<style>
  .platform-wrapper {
    display: flex;
    flex-flow: column;
    padding: 50px;
  }
  .user-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: #00a676;
    color: white;
    border-radius: 20px;
    padding: 10px 10px;
    box-sizing: border-box;
    box-shadow: 3px 3px 10px -2px rgba(0,0,0,.2);
  }

  .user-wrapper > div {
    display: flex;
    align-items: center;
  }

  .user-wrapper button:hover {
    border-color: white;
  }
  .user-info {
    margin: 0 5px 0 10px;
    font-size: 0.8rem;
  }
  .actions-list {
    margin-top: 20px;
    padding: 30px 0;
    display: flex;
    flex-flow: column;
    min-width: 50vw;
  }
  .action {
    border-radius: 20px;
    box-shadow: 4px 4px 10px -2px rgba(0, 0, 0, 0.2);
    background: white;
    padding: 20px 40px;
    margin-bottom: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background-color 0.3s;
  }
  .action:hover {
    background: #eee;
  }
  .action-content {
    display: flex;
    flex-flow: column;
  }
  .action-title {
    font-size: 18px;
    font-weight: 600;
  }
  .action-desc {
    font-size: 14px;
    max-width: 100%;
  }
  .action-points-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: 20px;
    font-size: 14px;
    font-weight: 600;
    z-index: 1;
    position: relative;
  }

  .action-points-wrapper::before {
    content: "";
    display: block;
    position: absolute;
    border-radius: 100%;
    z-index: -1;
    width: 130%;
    height: 130%;
    background: #ff8811;
    opacity: 0.2;
  }
  .action-points {
    width: 30px;
    height: 30px;
    border-radius: 100%;
    background: #ff8811;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .logout {
    font-size: 0.8rem;
    padding: 3px 10px;
    margin-left: 5px;
  }

  .overlay {
    position: absolute;
    z-index: 2;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: black;
    opacity: .2;
  }

  .completed-wrapper {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 40px;
    border-radius: 20px;
    display: flex;
    flex-flow: column;
    align-items: center;
  }

  .received-points-wrapper {
    font-size: 15px;
    margin-top: 25px;
  }
  .received-points-wrapper i {
    font-size: 12px;
  }
</style>

<div class="platform-wrapper">
  <div class="user-wrapper">
<div>
 <div class="user-info">
      Host: 
      {host}
    </div>
</div>
<div>
    <div class="user-info">
      <i class="fas fa-user fa-sm" />
      {user}
    </div>

    <button class="logout" on:click={logoutHandler}>Logout</button></div>
  </div>
  <div class="actions-list">
    {#each actions as action}
      <div class="action" on:click={() => showDialogForAction(action)}>
        <div class="action-content">
          <div class="action-title">{action.title}</div>
          <div class="action-desc">{action.description}</div>
        </div>
        <div class="action-points-wrapper">
          <div class="action-points">{action.points}</div>
        </div>
      </div>
    {/each}
  </div>
</div>

<div id="dialog-container" />

{#if completed}
  <div class="overlay"></div>
  <div class="completed-wrapper">
    <i class="far fa-check-circle fa-3x" style="color: #00a676"></i>
    {#if receivedPoints}
      <div class="received-points-wrapper">
        <i class="em em-tada"></i><span style="padding: 0 8px">+{receivedPoints} points</span><i class="em em-tada" ></i>
      </div>
    {/if}
  </div>
{/if}
