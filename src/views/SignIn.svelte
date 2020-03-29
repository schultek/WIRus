<script>

  import { onMount } from 'svelte';
  import firebase from "../lib/firebase";
  import {parseQuery, testEmail} from "../lib/utils";

  let query = parseQuery(window.location.search);
  //window.history.replaceState({}, document.title, window.location.pathname);

  $: platform = null;

  onMount(async () => {

    if (query.platform && query.token) {

      fetch(`https://wirus-app.firebaseapp.com/api/platform/get/${query.platform}`, {
        headers: {
          Authorization: `Bearer ${query.token}` 
        }
      })
        .then(res => {
          if (res.status == 200) {
            return res.json();
          } else {
            return res.text().then(body => { throw new Error(body); });
          }
        })
        .then(data => platform = data)
        .catch(err => console.warn(err));

    }
  })

  $: email = "";
  $: emailValid = true;
  $: password = "";
  $: credValid = true;

  const signin = () => {
    if (!testEmail(email)) {
      emailValid = false;
    } else {
      console.log("LOGIN");
      firebase.auth().signInWithEmailAndPassword(email, password)
        .then(credential => {
          return credential.user.getIdToken().then(token => {
            window.location = `https://wirus-app.firebaseapp.com/api/app/user/${credential.user.uid}/goto/${query.platform}?authorization=${token}&method=app`;
          })
        })
        .catch(err => {
          console.warn(err);
          credValid = false;
        })
    }
  };


</script>

<style>
  .signin-wrapper {
    display: flex;
    flex-flow: column;
    align-items: center;
    background: white;
    border-radius: 20px;
    box-shadow: 0 0 10px -4px rgba(0, 0, 0, 0.2);
    padding: 20px 40px 40px 40px;
  }

  input {
    margin-bottom: 10px;
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

  .platform-info {
    display: flex;
    flex-flow: column;
    align-items: center;
    margin-bottom: 20px;
  }
  .platform-info img {
    width: 100px;
  }
  .platform-info h4 {
    margin-bottom: 0;
  }
  .platform-info p {
    max-width: 200px;
    font-size: .7em;
    line-height: 1.5em;
    text-align: center;
  }
</style>

<svelte:head>
  <title>SignIn mit WIRus</title>
</svelte:head>

<div class="main">
  <div class="signin-wrapper">
    <h2>SignIn mit WIRus</h2>
    {#if platform}
      <div class="platform-info">
        <img src={platform.logo} alt={platform.name}/>
        <h4>{platform.name}</h4>
        <p>
          {platform.name} erhält Zugriff auf deinen Namen und Wohnort. 
          Deine Aktivitäten auf der Platform werden dir automatisch 
          in der App angezeigt.
        </p>
      </div>
    {/if}
    <input bind:value={email} placeholder="Email" class:error={!emailValid || !credValid} />
    <input bind:value={password} placeholder="Passwort" type="password" class:error={!credValid} />
    <button on:click={signin}>Login</button>
  </div>

  <div class="info">
    Mit "SignIn mit WIRus" kannst du dich mit einem zentralen Account bei allen
    unserer Partner-Plattformen einloggen.
  </div>
</div>
