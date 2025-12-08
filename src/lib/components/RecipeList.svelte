<script lang="ts">
  import { filteredRecipes, loading, error, searchQuery, allTags } from '../stores/recipes'
  import RecipeCard from './RecipeCard.svelte'
  import RecipeForm from './RecipeForm.svelte'

  let showForm = $state(false)
</script>

<div class="recipe-list">
  <header class="list-header">
    <h1>Mes Recettes</h1>
    <button class="btn-primary" onclick={() => showForm = true}>
      + Nouvelle recette
    </button>
  </header>

  <div class="search-bar">
    <input
      type="search"
      placeholder="Rechercher une recette..."
      bind:value={$searchQuery}
    />
  </div>

  {#if $loading}
    <div class="loading">
      <p>Chargement...</p>
    </div>
  {:else if $error}
    <div class="error">
      <p>{$error}</p>
    </div>
  {:else if $filteredRecipes.length === 0}
    <div class="empty">
      {#if $searchQuery}
        <p>Aucune recette ne correspond à "{$searchQuery}"</p>
      {:else}
        <p>Aucune recette pour le moment.</p>
        <p>Commencez par en ajouter une !</p>
      {/if}
    </div>
  {:else}
    <div class="recipes-grid">
      {#each $filteredRecipes as recipe (recipe.id)}
        <RecipeCard {recipe} />
      {/each}
    </div>
  {/if}
</div>

{#if showForm}
  <RecipeForm onclose={() => showForm = false} />
{/if}

<style>
  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .list-header h1 {
    color: #1a1a1a;
    font-size: 1.5rem;
  }

  .btn-primary {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: #059669;
  }

  .search-bar input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
  }

  .search-bar input:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .recipes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .loading,
  .error,
  .empty {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .error {
    color: #dc2626;
  }

  .empty {
    color: #666;
  }
</style>
