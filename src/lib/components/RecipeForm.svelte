<script lang="ts">
  import { createRecipe } from '../stores/recipes'
  import ImageUpload from './ImageUpload.svelte'
  import type { Ingredient } from '../types'

  interface Props {
    onclose: () => void
  }

  let { onclose }: Props = $props()

  let title = $state('')
  let source = $state('')
  let image = $state<string | undefined>(undefined)
  let prepTime = $state<number | undefined>(undefined)
  let cookTime = $state<number | undefined>(undefined)
  let servings = $state(4)
  let notes = $state('')
  let ingredients = $state<Ingredient[]>([{ name: '', quantity: 1, unit: '' }])
  let steps = $state<string[]>([''])
  let saving = $state(false)
  let error = $state<string | null>(null)

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
      // Ensure ingredients have proper numeric quantities
      const cleanIngredients = validIngredients.map(i => ({
        name: i.name.trim(),
        quantity: Number(i.quantity) || 1,
        unit: i.unit?.trim() || ''
      }))

      await createRecipe({
        title: title.trim(),
        source: source.trim() || undefined,
        image: image || undefined,
        prepTime: prepTime ? Number(prepTime) : undefined,
        cookTime: cookTime ? Number(cookTime) : undefined,
        servings: Number(servings) || 4,
        ingredients: cleanIngredients,
        steps: validSteps.map(s => s.trim()),
        notes: notes.trim() || undefined
      })
      onclose()
    } catch (e) {
      console.error('Erreur sauvegarde:', e)
      error = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde'
    } finally {
      saving = false
    }
  }
</script>

<div class="modal-overlay">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <header class="modal-header">
      <h2>Nouvelle recette</h2>
      <button class="btn-close" onclick={onclose}>×</button>
    </header>

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
