<script lang="ts">
  import { onMount } from 'svelte'
  import { loadRecipes } from './lib/stores/recipes'
  import RecipeList from './lib/components/RecipeList.svelte'
  import Navigation from './lib/components/Navigation.svelte'

  // Simple hash-based routing
  let currentRoute = $state(window.location.hash.slice(1) || '/')

  onMount(() => {
    loadRecipes()

    const handleHashChange = () => {
      currentRoute = window.location.hash.slice(1) || '/'
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  })
</script>

<div class="app">
  <Navigation {currentRoute} />

  <main class="main-content">
    {#if currentRoute === '/' || currentRoute.startsWith('/recipes')}
      <RecipeList />
    {:else if currentRoute === '/planning'}
      <div class="placeholder">
        <h2>Planning hebdomadaire</h2>
        <p>Bientôt disponible...</p>
      </div>
    {:else if currentRoute === '/shopping'}
      <div class="placeholder">
        <h2>Liste de courses</h2>
        <p>Bientôt disponible...</p>
      </div>
    {:else}
      <div class="placeholder">
        <h2>Page non trouvée</h2>
        <p><a href="#/">Retour à l'accueil</a></p>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background-color: #f5f5f5;
    color: #1a1a1a;
    line-height: 1.5;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    padding: 1rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .placeholder {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .placeholder h2 {
    color: #10b981;
    margin-bottom: 0.5rem;
  }

  .placeholder a {
    color: #10b981;
  }
</style>
