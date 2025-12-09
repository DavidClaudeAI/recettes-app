<script lang="ts">
  import { onMount } from 'svelte'
  import { loadRecipes } from './lib/stores/recipes'
  import RecipeList from './lib/components/RecipeList.svelte'
  import RecipeView from './lib/components/RecipeView.svelte'
  import RecipeFormEdit from './lib/components/RecipeFormEdit.svelte'
  import CookingMode from './lib/components/CookingMode.svelte'
  import WeekPlanner from './lib/components/WeekPlanner.svelte'
  import ShoppingList from './lib/components/ShoppingList.svelte'
  import Settings from './lib/components/Settings.svelte'
  import Navigation from './lib/components/Navigation.svelte'

  // Simple hash-based routing
  let currentRoute = $state(window.location.hash.slice(1) || '/')
  let editingRecipeId = $state<string | null>(null)

  // Parse routes
  const recipeMatch = $derived(currentRoute.match(/^\/recipes\/([a-f0-9-]+)$/))
  const cookingMatch = $derived(currentRoute.match(/^\/cooking\/([a-f0-9-]+)$/))
  const recipeId = $derived(recipeMatch ? recipeMatch[1] : null)
  const cookingRecipeId = $derived(cookingMatch ? cookingMatch[1] : null)

  onMount(() => {
    loadRecipes()

    const handleHashChange = () => {
      currentRoute = window.location.hash.slice(1) || '/'
      editingRecipeId = null
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  })

  function handleEdit() {
    if (recipeId) {
      editingRecipeId = recipeId
    }
  }

  function closeEdit() {
    editingRecipeId = null
    loadRecipes()
  }
</script>

{#if cookingRecipeId}
  <CookingMode recipeId={cookingRecipeId} />
{:else}
  <div class="app">
    <Navigation {currentRoute} />

    <main class="main-content">
      {#if recipeId}
        <RecipeView {recipeId} onEdit={handleEdit} />
      {:else if currentRoute === '/' || currentRoute === '/recipes'}
        <RecipeList />
      {:else if currentRoute === '/planning'}
        <WeekPlanner />
      {:else if currentRoute === '/shopping'}
        <ShoppingList />
      {:else if currentRoute === '/settings'}
        <Settings />
      {:else}
        <div class="placeholder">
          <h2>Page non trouvée</h2>
          <p><a href="#/">Retour à l'accueil</a></p>
        </div>
      {/if}
    </main>
  </div>

  {#if editingRecipeId}
    <RecipeFormEdit recipeId={editingRecipeId} onclose={closeEdit} />
  {/if}
{/if}

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
