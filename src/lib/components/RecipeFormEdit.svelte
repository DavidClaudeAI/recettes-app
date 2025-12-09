<script lang="ts">
  import { onMount } from 'svelte'
  import { updateRecipe } from '../stores/recipes'
  import { getRecipe } from '../services/dataService'
  import ImageUpload from './ImageUpload.svelte'
  import type { Ingredient, Recipe } from '../types'

  interface Props {
    recipeId: string
    onclose: () => void
  }

  let { recipeId, onclose }: Props = $props()

  let title = $state('')
  let source = $state('')
  let image = $state<string | undefined>(undefined)
  let prepTime = $state<number | undefined>(undefined)
  let cookTime = $state<number | undefined>(undefined)
  let servings = $state(4)
  let notes = $state('')
  let ingredients = $state<Ingredient[]>([])
  let steps = $state<string[]>([])
  let loading = $state(true)
  let saving = $state(false)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      const recipe = await getRecipe(recipeId)
      if (recipe) {
        title = recipe.title
        source = recipe.source || ''
        image = recipe.image
        prepTime = recipe.prepTime
        cookTime = recipe.cookTime
        servings = recipe.servings
        notes = recipe.notes || ''
        ingredients = [...recipe.ingredients]
        steps = [...recipe.steps]
      } else {
        error = 'Recette non trouvée'
      }
    } catch (e) {
      error = 'Erreur lors du chargement'
      console.error(e)
    } finally {
      loading = false
    }
  })

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

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = null

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

    if (validSteps.length === 0) {
      error = 'Au moins une étape est requise'
      return
    }

    saving = true

    try {
      await updateRecipe(recipeId, {
        title: title.trim(),
        source: source.trim() || undefined,
        image: image || undefined,
        prepTime,
        cookTime,
        servings,
        ingredients: validIngredients,
        steps: validSteps,
        notes: notes.trim() || undefined
      })
      onclose()
    } catch (e) {
      error = 'Erreur lors de la sauvegarde'
      console.error(e)
    } finally {
      saving = false
    }
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <header class="modal-header">
      <h2>Modifier la recette</h2>
      <button class="btn-close" onclick={onclose}>×</button>
    </header>

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else}
      <form onsubmit={handleSubmit}>
        {#if error}
          <div class="form-error">{error}</div>
        {/if}

        <div class="form-group">
          <label for="title">Titre *</label>
          <input type="text" id="title" bind:value={title} placeholder="Ex: Poulet rôti aux herbes" />
        </div>

        <div class="form-group">
          <label for="source">Source (URL)</label>
          <input type="url" id="source" bind:value={source} placeholder="https://..." />
        </div>

        <div class="form-group">
          <label>Photo de la recette</label>
          <ImageUpload value={image} onchange={(v) => image = v} />
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
          <label>Ingrédients *</label>
          {#each ingredients as ingredient, i}
            <div class="ingredient-row">
              <input
                type="number"
                bind:value={ingredient.quantity}
                min="0"
                step="0.1"
                placeholder="Qté"
                class="input-qty"
              />
              <input
                type="text"
                bind:value={ingredient.unit}
                placeholder="Unité"
                class="input-unit"
              />
              <input
                type="text"
                bind:value={ingredient.name}
                placeholder="Ingrédient"
                class="input-name"
              />
              <button type="button" class="btn-remove" onclick={() => removeIngredient(i)}>×</button>
            </div>
          {/each}
          <button type="button" class="btn-add" onclick={addIngredient}>+ Ajouter un ingrédient</button>
        </div>

        <div class="form-group">
          <label>Étapes *</label>
          {#each steps as step, i}
            <div class="step-row">
              <span class="step-number">{i + 1}.</span>
              <textarea
                bind:value={steps[i]}
                placeholder="Décrivez cette étape..."
                rows="2"
              ></textarea>
              <button type="button" class="btn-remove" onclick={() => removeStep(i)}>×</button>
            </div>
          {/each}
          <button type="button" class="btn-add" onclick={addStep}>+ Ajouter une étape</button>
        </div>

        <div class="form-group">
          <label for="notes">Notes personnelles</label>
          <textarea id="notes" bind:value={notes} placeholder="Vos notes, astuces, variantes..." rows="3"></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" onclick={onclose}>Annuler</button>
          <button type="submit" class="btn-submit" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    {/if}
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
    overflow-x: hidden;
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
    padding: 0.25rem;
    line-height: 1;
  }

  .loading {
    padding: 3rem;
    text-align: center;
    color: #666;
  }

  form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-error {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
    color: #333;
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
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .ingredient-row, .step-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .input-qty { width: 70px; flex-shrink: 0; }
  .input-unit { width: 80px; flex-shrink: 0; }
  .input-name { flex: 1; min-width: 150px; }

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
  }

  .btn-add:hover {
    background: #f0fdf4;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .btn-cancel {
    background: none;
    border: 1px solid #ddd;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-submit {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-submit:hover:not(:disabled) {
    background: #059669;
  }

  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
