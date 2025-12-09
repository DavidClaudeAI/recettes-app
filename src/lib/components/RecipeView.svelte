<script lang="ts">
  import { onMount } from 'svelte'
  import { getRecipeWithMeta } from '../services/dataService'
  import { deleteRecipe, updateMetadata, addHistoryEntry } from '../stores/recipes'
  import { secureImageUrl } from '../services/recipeParser'
  import type { RecipeWithMeta, RecipeStatus } from '../types'
  import StarRating from './StarRating.svelte'
  import TagInput from './TagInput.svelte'

  interface Props {
    recipeId: string
    onEdit: () => void
  }

  let { recipeId, onEdit }: Props = $props()

  let recipe = $state<RecipeWithMeta | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showDeleteConfirm = $state(false)
  let adjustedServings = $state<number | null>(null)
  let saving = $state(false)

  const statusOptions: { value: RecipeStatus; label: string; color: string }[] = [
    { value: 'to-test', label: 'À tester', color: '#f59e0b' },
    { value: 'testing', label: 'En test', color: '#3b82f6' },
    { value: 'validated', label: 'Validée', color: '#10b981' },
    { value: 'archived', label: 'Archivée', color: '#6b7280' }
  ]

  onMount(async () => {
    try {
      recipe = await getRecipeWithMeta(recipeId) ?? null
      if (recipe) {
        adjustedServings = recipe.servings
      }
    } catch (e) {
      error = 'Erreur lors du chargement de la recette'
      console.error(e)
    } finally {
      loading = false
    }
  })

  function formatTime(minutes?: number): string {
    if (!minutes) return '-'
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m}` : `${h}h`
  }

  function adjustQuantity(quantity: number): string {
    if (!recipe || !adjustedServings) return quantity.toString()
    const ratio = adjustedServings / recipe.servings
    const adjusted = quantity * ratio
    // Arrondi intelligent
    if (adjusted < 1) return adjusted.toFixed(2).replace(/\.?0+$/, '')
    if (adjusted < 10) return adjusted.toFixed(1).replace(/\.?0+$/, '')
    return Math.round(adjusted).toString()
  }

  async function handleStatusChange(e: Event) {
    const select = e.target as HTMLSelectElement
    const newStatus = select.value as RecipeStatus
    if (recipe && !saving) {
      saving = true
      try {
        await updateMetadata(recipe.id, { status: newStatus })
        // Create new object to trigger Svelte 5 reactivity
        recipe = {
          ...recipe,
          metadata: { ...recipe.metadata, status: newStatus }
        }
      } catch (e) {
        console.error('Error saving status:', e)
        alert('Erreur lors de la sauvegarde du statut')
        // Revert select to original value
        select.value = recipe.metadata.status
      } finally {
        saving = false
      }
    }
  }

  async function handleRatingChange(rating: number) {
    if (recipe && !saving) {
      saving = true
      try {
        await updateMetadata(recipe.id, { rating })
        recipe = {
          ...recipe,
          metadata: { ...recipe.metadata, rating }
        }
      } catch (e) {
        console.error('Error saving rating:', e)
        alert('Erreur lors de la sauvegarde de la note')
      } finally {
        saving = false
      }
    }
  }

  async function handleTagsChange(tags: string[]) {
    if (recipe && !saving) {
      saving = true
      try {
        await updateMetadata(recipe.id, { tags })
        recipe = {
          ...recipe,
          metadata: { ...recipe.metadata, tags }
        }
      } catch (e) {
        console.error('Error saving tags:', e)
        alert('Erreur lors de la sauvegarde des tags')
      } finally {
        saving = false
      }
    }
  }

  async function handleDelete() {
    if (recipe) {
      await deleteRecipe(recipe.id)
      window.location.hash = '/'
    }
  }

  async function handleMadeIt() {
    const notes = prompt('Notes sur cette réalisation (optionnel):')
    if (recipe) {
      await addHistoryEntry(recipe.id, notes || undefined)
      recipe.metadata.history = [...recipe.metadata.history, { date: new Date().toISOString(), notes: notes || undefined }]
    }
  }

  const totalTime = $derived((recipe?.prepTime || 0) + (recipe?.cookTime || 0))
</script>

<div class="recipe-view">
  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if error || !recipe}
    <div class="error">
      <p>{error || 'Recette non trouvée'}</p>
      <a href="#/">Retour à la liste</a>
    </div>
  {:else}
    <header class="recipe-header">
      <a href="#/" class="back-link">← Retour</a>

      <div class="header-actions">
        <button class="btn-icon" onclick={onEdit} title="Modifier">✏️</button>
        <button class="btn-icon" onclick={() => showDeleteConfirm = true} title="Supprimer">🗑️</button>
      </div>
    </header>

    <div class="recipe-content">
      <div class="recipe-main">
        {#if recipe.image}
          <div class="recipe-image">
            <img src={secureImageUrl(recipe.image)} alt={recipe.title} />
          </div>
        {/if}

        <h1>{recipe.title}</h1>

        {#if recipe.source}
          <a href={recipe.source} target="_blank" rel="noopener" class="source-link">
            🔗 Voir la recette originale
          </a>
        {/if}

        <div class="recipe-meta">
          <div class="meta-item">
            <span class="meta-label">Préparation</span>
            <span class="meta-value">{formatTime(recipe.prepTime)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Cuisson</span>
            <span class="meta-value">{formatTime(recipe.cookTime)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total</span>
            <span class="meta-value">{formatTime(totalTime)}</span>
          </div>
        </div>

        <section class="ingredients-section">
          <div class="section-header">
            <h2>Ingrédients</h2>
            <div class="servings-adjust">
              <label>
                Pour
                <input
                  type="number"
                  bind:value={adjustedServings}
                  min="1"
                  max="100"
                />
                portions
              </label>
              {#if adjustedServings !== recipe.servings}
                <button class="btn-reset" onclick={() => adjustedServings = recipe?.servings ?? null}>
                  Réinitialiser
                </button>
              {/if}
            </div>
          </div>

          <ul class="ingredients-list">
            {#each recipe.ingredients as ingredient}
              <li>
                <span class="ingredient-qty">{adjustQuantity(ingredient.quantity)}</span>
                <span class="ingredient-unit">{ingredient.unit}</span>
                <span class="ingredient-name">{ingredient.name}</span>
              </li>
            {/each}
          </ul>
        </section>

        <section class="steps-section">
          <h2>Préparation</h2>
          <ol class="steps-list">
            {#each recipe.steps as step, i}
              <li>
                <span class="step-number">{i + 1}</span>
                <p>{step}</p>
              </li>
            {/each}
          </ol>
        </section>

        {#if recipe.notes}
          <section class="notes-section">
            <h2>Notes</h2>
            <p>{recipe.notes}</p>
          </section>
        {/if}
      </div>

      <aside class="recipe-sidebar">
        <div class="sidebar-section">
          <label class="sidebar-label">Statut {saving ? '...' : ''}</label>
          <select value={recipe.metadata.status} onchange={handleStatusChange} disabled={saving}>
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <div class="sidebar-section">
          <label class="sidebar-label">Note</label>
          <StarRating rating={recipe.metadata.rating || 0} onchange={handleRatingChange} />
        </div>

        <div class="sidebar-section">
          <label class="sidebar-label">Tags</label>
          <TagInput tags={recipe.metadata.tags} onchange={handleTagsChange} />
        </div>

        <div class="sidebar-section">
          <label class="sidebar-label">Historique ({recipe.metadata.history.length})</label>
          <button class="btn-made-it" onclick={handleMadeIt}>
            ✓ J'ai fait cette recette
          </button>
          {#if recipe.metadata.history.length > 0}
            <ul class="history-list">
              {#each recipe.metadata.history.slice(-5).reverse() as entry}
                <li>
                  <span class="history-date">
                    {new Date(entry.date).toLocaleDateString('fr-FR')}
                  </span>
                  {#if entry.notes}
                    <span class="history-notes">{entry.notes}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="sidebar-section">
          <a href="#/cooking/{recipe.id}" class="btn-cooking">
            👨‍🍳 Mode Cuisine
          </a>
        </div>
      </aside>
    </div>
  {/if}
</div>

{#if showDeleteConfirm}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal-confirm">
      <h3>Supprimer cette recette ?</h3>
      <p>Cette action est irréversible.</p>
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => showDeleteConfirm = false}>Annuler</button>
        <button class="btn-delete" onclick={handleDelete}>Supprimer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .recipe-view {
    max-width: 1000px;
    margin: 0 auto;
  }

  .loading, .error {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 8px;
  }

  .error a {
    color: #10b981;
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .back-link {
    color: #666;
    text-decoration: none;
  }

  .back-link:hover {
    color: #10b981;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-icon {
    background: white;
    border: 1px solid #ddd;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
  }

  .btn-icon:hover {
    background: #f5f5f5;
  }

  .recipe-content {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .recipe-content {
      grid-template-columns: 1fr;
    }

    .recipe-sidebar {
      order: -1;
    }
  }

  .recipe-main {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .recipe-image {
    width: 100%;
    max-height: 300px;
    overflow: hidden;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .recipe-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .recipe-main h1 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    color: #1a1a1a;
  }

  .source-link {
    display: inline-block;
    color: #10b981;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .recipe-meta {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 0;
    border-bottom: 1px solid #eee;
    margin-bottom: 1.5rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
  }

  .meta-label {
    font-size: 0.8rem;
    color: #666;
  }

  .meta-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #10b981;
  }

  section {
    margin-bottom: 2rem;
  }

  section h2 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    color: #333;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .servings-adjust {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .servings-adjust input {
    width: 60px;
    padding: 0.25rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
  }

  .btn-reset {
    background: none;
    border: none;
    color: #10b981;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .ingredients-list {
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }

  .ingredients-list li {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 6px;
  }

  .ingredient-qty {
    font-weight: 600;
    min-width: 50px;
    color: #10b981;
  }

  .ingredient-unit {
    color: #666;
    min-width: 60px;
  }

  .ingredient-name {
    flex: 1;
  }

  .steps-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .steps-list li {
    display: flex;
    gap: 1rem;
  }

  .step-number {
    width: 28px;
    height: 28px;
    background: #10b981;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .steps-list p {
    flex: 1;
    line-height: 1.6;
  }

  .notes-section {
    background: #fffbeb;
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #f59e0b;
  }

  .notes-section h2 {
    color: #92400e;
  }

  .recipe-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sidebar-section {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .sidebar-label {
    display: block;
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .sidebar-section select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .btn-made-it {
    width: 100%;
    padding: 0.75rem;
    background: #f0fdf4;
    color: #10b981;
    border: 1px solid #10b981;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-made-it:hover {
    background: #10b981;
    color: white;
  }

  .history-list {
    list-style: none;
    margin-top: 0.75rem;
    font-size: 0.85rem;
  }

  .history-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
  }

  .history-date {
    color: #666;
  }

  .history-notes {
    display: block;
    color: #333;
    font-style: italic;
  }

  .btn-cooking {
    display: block;
    width: 100%;
    padding: 1rem;
    background: #10b981;
    color: white;
    text-align: center;
    text-decoration: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .btn-cooking:hover {
    background: #059669;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-confirm {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    max-width: 400px;
  }

  .modal-confirm h3 {
    margin-bottom: 0.5rem;
  }

  .modal-confirm p {
    color: #666;
    margin-bottom: 1.5rem;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .btn-cancel, .btn-delete {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-cancel {
    background: none;
    border: 1px solid #ddd;
  }

  .btn-delete {
    background: #dc2626;
    color: white;
    border: none;
  }
</style>
