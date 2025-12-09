<script lang="ts">
  import { fetchAndParseRecipe, type ParsedRecipe } from '../services/recipeParser'
  import { createRecipe } from '../stores/recipes'
  import type { Ingredient } from '../types'

  interface Props {
    onclose: () => void
  }

  let { onclose }: Props = $props()

  let url = $state('')
  let loading = $state(false)
  let loadingStep = $state('')
  let error = $state<string | null>(null)
  let parsedRecipe = $state<ParsedRecipe | null>(null)

  // Editable fields from parsed recipe
  let title = $state('')
  let prepTime = $state<number | undefined>(undefined)
  let cookTime = $state<number | undefined>(undefined)
  let servings = $state(4)
  let ingredients = $state<Ingredient[]>([])
  let steps = $state<string[]>([])

  async function handleAnalyze() {
    if (!url.trim()) {
      error = 'Veuillez entrer une URL'
      return
    }

    loading = true
    loadingStep = 'Démarrage...'
    error = null
    parsedRecipe = null

    try {
      const recipe = await fetchAndParseRecipe(url.trim(), (step) => {
        loadingStep = step
      })
      parsedRecipe = recipe

      // Pre-fill editable fields
      title = recipe.title
      prepTime = recipe.prepTime
      cookTime = recipe.cookTime
      servings = recipe.servings
      ingredients = [...recipe.ingredients]
      steps = [...recipe.steps]
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur lors de l\'analyse'
    } finally {
      loading = false
      loadingStep = ''
    }
  }

  function addIngredient() {
    ingredients = [...ingredients, { name: '', quantity: 1, unit: '' }]
  }

  function removeIngredient(index: number) {
    ingredients = ingredients.filter((_, i) => i !== index)
  }

  function addStep() {
    steps = [...steps, '']
  }

  function removeStep(index: number) {
    steps = steps.filter((_, i) => i !== index)
  }

  async function handleSave() {
    if (!title.trim()) {
      error = 'Le titre est requis'
      return
    }

    const validIngredients = ingredients.filter(i => i.name.trim())
    const validSteps = steps.filter(s => s.trim())

    if (validIngredients.length === 0) {
      error = 'Au moins un ingrédient est requis'
      return
    }

    loading = true
    error = null

    try {
      await createRecipe({
        title: title.trim(),
        source: url.trim(),
        image: parsedRecipe?.image,
        prepTime,
        cookTime,
        servings,
        ingredients: validIngredients,
        steps: validSteps
      })
      onclose()
    } catch (e) {
      error = 'Erreur lors de la sauvegarde'
    } finally {
      loading = false
    }
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" onclick={onclose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <header class="modal-header">
      <h2>Importer une recette</h2>
      <button class="btn-close" onclick={onclose}>×</button>
    </header>

    <div class="modal-content">
      {#if !parsedRecipe}
        <div class="url-input-section">
          <p class="hint">
            Collez l'URL d'une recette depuis un site de cuisine (Marmiton, 750g, etc.)
          </p>

          <div class="url-form">
            <input
              type="url"
              bind:value={url}
              placeholder="https://www.marmiton.org/recettes/..."
              disabled={loading}
            />
            <button
              class="btn-analyze"
              onclick={handleAnalyze}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Analyse...' : 'Analyser'}
            </button>
          </div>

          {#if loading}
            <div class="loading-indicator">
              <div class="spinner"></div>
              <span class="loading-text">{loadingStep}</span>
            </div>
          {/if}

          {#if error}
            <div class="error-message">{error}</div>
          {/if}

          <div class="supported-sites">
            <p>Sites supportés :</p>
            <ul>
              <li>Marmiton, 750g, Cuisine AZ</li>
              <li>Ricardo, Tasty, AllRecipes</li>
              <li>Et tout site utilisant schema.org/Recipe</li>
            </ul>
          </div>
        </div>
      {:else}
        <form class="recipe-preview" onsubmit={(e) => { e.preventDefault(); handleSave() }}>
          {#if error}
            <div class="error-message">{error}</div>
          {/if}

          <div class="form-group">
            <label for="title">Titre</label>
            <input type="text" id="title" bind:value={title} />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="prepTime">Préparation (min)</label>
              <input type="number" id="prepTime" bind:value={prepTime} min="0" />
            </div>
            <div class="form-group">
              <label for="cookTime">Cuisson (min)</label>
              <input type="number" id="cookTime" bind:value={cookTime} min="0" />
            </div>
            <div class="form-group">
              <label for="servings">Portions</label>
              <input type="number" id="servings" bind:value={servings} min="1" />
            </div>
          </div>

          <div class="form-group">
            <label>Ingrédients ({ingredients.length})</label>
            <div class="ingredients-list">
              {#each ingredients as ingredient, i}
                <div class="ingredient-row">
                  <input
                    type="number"
                    bind:value={ingredient.quantity}
                    min="0"
                    step="0.1"
                    class="input-qty"
                  />
                  <input
                    type="text"
                    bind:value={ingredient.unit}
                    placeholder="unité"
                    class="input-unit"
                  />
                  <input
                    type="text"
                    bind:value={ingredient.name}
                    class="input-name"
                  />
                  <button type="button" class="btn-remove" onclick={() => removeIngredient(i)}>×</button>
                </div>
              {/each}
            </div>
            <button type="button" class="btn-add" onclick={addIngredient}>
              + Ajouter un ingrédient
            </button>
          </div>

          <div class="form-group">
            <label>Étapes ({steps.length})</label>
            <div class="steps-list">
              {#each steps as step, i}
                <div class="step-row">
                  <span class="step-number">{i + 1}.</span>
                  <textarea bind:value={steps[i]} rows="2"></textarea>
                  <button type="button" class="btn-remove" onclick={() => removeStep(i)}>×</button>
                </div>
              {/each}
            </div>
            <button type="button" class="btn-add" onclick={addStep}>
              + Ajouter une étape
            </button>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-back" onclick={() => parsedRecipe = null}>
              ← Retour
            </button>
            <button type="submit" class="btn-save" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer la recette'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  }

  .modal-content {
    padding: 1.5rem;
  }

  .url-input-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .hint {
    color: #666;
    font-size: 0.95rem;
  }

  .url-form {
    display: flex;
    gap: 0.5rem;
  }

  .url-form input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .url-form input:focus {
    outline: none;
    border-color: #10b981;
  }

  .btn-analyze {
    padding: 0.75rem 1.5rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    white-space: nowrap;
  }

  .btn-analyze:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #f0fdf4;
    border-radius: 8px;
    border: 1px solid #bbf7d0;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #bbf7d0;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    color: #166534;
    font-size: 0.9rem;
  }

  .error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .supported-sites {
    background: #f9fafb;
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .supported-sites p {
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .supported-sites ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #666;
  }

  .recipe-preview {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  input, textarea {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: #10b981;
  }

  .ingredients-list, .steps-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .ingredient-row {
    display: flex;
    gap: 0.5rem;
  }

  .input-qty { width: 70px; }
  .input-unit { width: 80px; }
  .input-name { flex: 1; }

  .step-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .step-number {
    padding: 0.75rem 0;
    color: #10b981;
    font-weight: 600;
    min-width: 24px;
  }

  .step-row textarea {
    flex: 1;
  }

  .btn-remove {
    background: none;
    border: none;
    color: #dc2626;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.5rem;
  }

  .btn-add {
    background: none;
    border: 1px dashed #10b981;
    color: #10b981;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .btn-back {
    background: none;
    border: 1px solid #ddd;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-save {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
