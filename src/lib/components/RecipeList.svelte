<script lang="ts">
  import { filteredRecipes, recipes, loading, error, searchQuery, statusFilter, tagsFilter, minRating, allTags } from '../stores/recipes'
  import RecipeCard from './RecipeCard.svelte'
  import RecipeForm from './RecipeForm.svelte'
  import ImportUrl from './ImportUrl.svelte'
  import type { RecipeStatus } from '../types'

  let showForm = $state(false)
  let showImport = $state(false)
  let showFilters = $state(false)

  const statusOptions: { value: RecipeStatus | null; label: string }[] = [
    { value: null, label: 'Tous' },
    { value: 'to-test', label: 'A tester' },
    { value: 'testing', label: 'En test' },
    { value: 'validated', label: 'Validees' },
    { value: 'archived', label: 'Archivees' }
  ]

  const ratingOptions = [
    { value: null, label: 'Toutes' },
    { value: 1, label: '1+' },
    { value: 2, label: '2+' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
    { value: 5, label: '5' }
  ]

  function toggleTag(tag: string) {
    tagsFilter.update(tags =>
      tags.includes(tag)
        ? tags.filter(t => t !== tag)
        : [...tags, tag]
    )
  }

  function resetFilters() {
    statusFilter.set(null)
    tagsFilter.set([])
    minRating.set(null)
    searchQuery.set('')
  }

  const hasActiveFilters = $derived(
    $statusFilter !== null ||
    $tagsFilter.length > 0 ||
    $minRating !== null ||
    $searchQuery.trim() !== ''
  )
</script>

<div class="recipe-list">
  <header class="list-header">
    <h1>Mes Recettes</h1>
    <div class="header-actions">
      <button class="btn-secondary" onclick={() => showImport = true}>
        🔗 Importer URL
      </button>
      <button class="btn-primary" onclick={() => showForm = true}>
        + Nouvelle recette
      </button>
    </div>
  </header>

  <div class="search-section">
    <div class="search-bar">
      <input
        type="search"
        placeholder="Rechercher dans titres, ingredients, tags..."
        bind:value={$searchQuery}
      />
      <button
        class="btn-filter"
        class:active={showFilters || hasActiveFilters}
        onclick={() => showFilters = !showFilters}
      >
        <span class="filter-icon">&#9776;</span>
        Filtres
        {#if hasActiveFilters}
          <span class="filter-badge"></span>
        {/if}
      </button>
    </div>

    {#if showFilters}
      <div class="filters-panel">
        <div class="filter-group">
          <label>Statut</label>
          <div class="filter-options">
            {#each statusOptions as option}
              <button
                class="filter-chip"
                class:selected={$statusFilter === option.value}
                onclick={() => statusFilter.set(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="filter-group">
          <label>Note minimum</label>
          <div class="filter-options">
            {#each ratingOptions as option}
              <button
                class="filter-chip"
                class:selected={$minRating === option.value}
                onclick={() => minRating.set(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        {#if $allTags.length > 0}
          <div class="filter-group">
            <label>Tags</label>
            <div class="filter-options tags">
              {#each $allTags as tag}
                <button
                  class="filter-chip tag"
                  class:selected={$tagsFilter.includes(tag)}
                  onclick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if hasActiveFilters}
          <button class="btn-reset" onclick={resetFilters}>
            Reinitialiser les filtres
          </button>
        {/if}
      </div>
    {/if}

    <div class="results-count">
      {$filteredRecipes.length} recette{$filteredRecipes.length !== 1 ? 's' : ''}
      {#if hasActiveFilters}
        sur {$recipes.length}
      {/if}
    </div>
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

{#if showImport}
  <ImportUrl onclose={() => showImport = false} />
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

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-secondary {
    background: white;
    color: #10b981;
    border: 1px solid #10b981;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #f0fdf4;
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

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-bar {
    display: flex;
    gap: 0.5rem;
  }

  .search-bar input {
    flex: 1;
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

  .btn-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    position: relative;
    white-space: nowrap;
  }

  .btn-filter:hover,
  .btn-filter.active {
    border-color: #10b981;
    color: #10b981;
  }

  .filter-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 10px;
    height: 10px;
    background: #10b981;
    border-radius: 50%;
  }

  .filters-panel {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-group label {
    font-size: 0.85rem;
    font-weight: 500;
    color: #666;
  }

  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .filter-chip {
    padding: 0.4rem 0.75rem;
    background: #f5f5f5;
    border: 1px solid #e5e5e5;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-chip:hover {
    background: #e5e5e5;
  }

  .filter-chip.selected {
    background: #10b981;
    color: white;
    border-color: #10b981;
  }

  .filter-chip.tag {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #166534;
  }

  .filter-chip.tag.selected {
    background: #10b981;
    color: white;
    border-color: #10b981;
  }

  .btn-reset {
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid #dc2626;
    color: #dc2626;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    align-self: flex-start;
  }

  .btn-reset:hover {
    background: #fef2f2;
  }

  .results-count {
    font-size: 0.85rem;
    color: #666;
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

  @media (max-width: 640px) {
    .header-actions {
      width: 100%;
      flex-direction: column;
    }

    .btn-primary, .btn-secondary {
      width: 100%;
    }
  }
</style>
