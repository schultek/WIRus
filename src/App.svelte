<script>
  import createRouter, {ROUTER_MODE} from '@spaceavocado/svelte-router';
  import RouterView from '@spaceavocado/svelte-router/component/view';

  // View components
  import ConfirmView from './views/Confirm.svelte';
  import SignInView from './views/SignIn.svelte';

  createRouter({
    mode: ROUTER_MODE.HISTORY,
    routes: [
      { 
        path: '/signin',
        name: 'signIn',
        component: SignInView
      },
      {
        path: '/confirm',
        name: 'confirm',
        component: ConfirmView
      }
    ],
  });
</script>

<RouterView />