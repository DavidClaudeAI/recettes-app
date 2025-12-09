<script lang="ts">
  import { onMount } from 'svelte'
  import { v4 as uuidv4 } from 'uuid'
  import { getPlanningForWeek, savePlanningEntry, deletePlanningEntry } from '../services/dataService'
  import { secureImageUrl } from '../services/recipeParser'
  import { recipes } from '../stores/recipes'
  import type { PlanningEntry, MealSlot, RecipeWithMeta } from '../types'

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const SLOTS: { key: MealSlot; label: string }[] = [
    { key: 'lunch', label: 'Midi' },
    { key: 'dinner', label: 'Soir' }
  ]

  let currentWeekStart = $state(getMonday(new Date()))
  let planning = $state<PlanningEntry[]>([])
  let loading = $state(true)
  let showRecipeSelector = $state(false)
  let selectedDay = $state<number | null>(null)
  let selectedSlot = $state<MealSlot | null>(null)
  let searchQuery = $state('')

  // Get Monday of the week for a given date
  function getMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function formatWeekStart(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  function formatDateRange(start: Date): string {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    return `${start.toLocaleDateString('fr-FR', opts)} - ${end.toLocaleDateString('fr-FR', opts)}`
  }

  function getDayDate(dayIndex: number): string {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + dayIndex)
    return date.toLocaleDateString('fr-FR', { day: 'numeric' })
  }

  async function loadPlanning() {
    loading = true
    try {
      planning = await getPlanningForWeek(formatWeekStart(currentWeekStart))
    } catch (e) {
      console.error('Erreur chargement planning:', e)
    } finally {
      loading = false
    }
  }

  function goToPreviousWeek() {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() - 7)
    currentWeekStart = newDate
  }

  function goToNextWeek() {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + 7)
    currentWeekStart = newDate
  }

  function goToCurrentWeek() {
    currentWeekStart = getMonday(new Date())
  }

  function getMealForSlot(day: number, slot: MealSlot): PlanningEntry | undefined {
    return planning.find(p => p.day === day && p.slot === slot)
  }

  function getRecipeById(id: string): RecipeWithMeta | undefined {
    return $recipes.find(r => r.id === id)
  }

  function openRecipeSelector(day: number, slot: MealSlot) {
    selectedDay = day
    selectedSlot = slot
    searchQuery = ''
    showRecipeSelector = true
  }

  async function selectRecipe(recipeId: string) {
    if (selectedDay === null || selectedSlot === null) return

    const entry: PlanningEntry = {
      id: uuidv4(),
      weekStart: formatWeekStart(currentWeekStart),
      day: selectedDay,
      slot: selectedSlot,
      recipeId
    }

    await savePlanningEntry(entry)
    planning = [...planning, entry]
    showRecipeSelector = false
  }

  async function removeMeal(entry: PlanningEntry) {
    await deletePlanningEntry(entry.id)
    planning = planning.filter(p => p.id !== entry.id)
  }

  const filteredRecipes = $derived(
    $recipes.filter(r =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  $effect(() => {
    loadPlanning()
  })

  onMount(() => {
    loadPlanning()
  })
</script>

<div class="week-planner">
  <header class="planner-header">
    <h1>Planning de la semaine</h1>
    <div class="week-nav">
      <button class="btn-nav" onclick={goToPreviousWeek}>&larr;</button>
      <span class="week-label">{formatDateRange(currentWeekStart)}</span>
      <button class="btn-nav" onclick={goToNextWeek}>&rarr;</button>
      <button class="btn-today" onclick={goToCurrentWeek}>Aujourd'hui</button>
    </div>
  </header>

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else}
    <div class="planner-grid">
      <div class="grid-header">
        <div class="slot-label"></div>
        {#each DAYS as day, i}
          <div class="day-header">
            <span class="day-name">{day}</span>
            <span class="day-date">{getDayDate(i)}</span>
          </div>
        {/each}
      </div>

      {#each SLOTS as slot}
        <div class="grid-row">
          <div class="slot-label">{slot.label}</div>
          {#each DAYS as _, dayIndex}
            {@const meal = getMealForSlot(dayIndex, slot.key)}
            {@const recipe = meal ? getRecipeById(meal.recipeId) : undefined}
            <div class="meal-cell">
              {#if meal && recipe}
                <div class="meal-card">
                  {#if recipe.image}
                    <img src={secureImageUrl(recipe.image)} alt="" class="meal-image" />
                  {/if}
                  <span class="meal-title">{recipe.title}</span>
                  <button
                    class="btn-remove"
                    onclick={() => removeMeal(meal)}
                    title="Retirer"
                  >
                    &times;
                  </button>
                </div>
              {:else}
                <button
                  class="btn-add-meal"
                  onclick={() => openRecipeSelector(dayIndex, slot.key)}
                >
                  +
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showRecipeSelector}
  <div class="modal-overlay" onclick={() => showRecipeSelector = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2>Choisir une recette</h2>
        <button class="btn-close" onclick={() => showRecipeSelector = false}>&times;</button>
      </header>
      <div class="modal-content">
        <input
          type="search"
          placeholder="Rechercher..."
          bind:value={searchQuery}
          class="search-input"
        />
        <div class="recipe-list">
          {#each filteredRecipes as recipe}
            <button class="recipe-option" onclick={() => selectRecipe(recipe.id)}>
              {#if recipe.image}
                <img src={secureImageUrl(recipe.image)} alt="" class="recipe-thumb" />
              {:else}
                <div class="recipe-thumb-placeholder"></div>
              {/if}
              <span class="recipe-name">{recipe.title}</span>
            </button>
          {:else}
            <p class="no-recipes">Aucune recette trouvee</p>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .week-planner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .planner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .planner-header h1 {
    font-size: 1.5rem;
    color: #1a1a1a;
  }

  .week-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-nav {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-nav:hover {
    background: #f5f5f5;
  }

  .week-label {
    font-weight: 500;
    min-width: 180px;
    text-align: center;
  }

  .btn-today {
    padding: 0.5rem 1rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 8px;
  }

  .planner-grid {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .grid-header {
    display: grid;
    grid-template-columns: 60px repeat(7, 1fr);
    background: #f9fafb;
    border-bottom: 1px solid #eee;
  }

  .day-header {
    padding: 0.75rem 0.5rem;
    text-align: center;
    border-left: 1px solid #eee;
  }

  .day-name {
    display: block;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .day-date {
    display: block;
    font-size: 0.75rem;
    color: #666;
  }

  .grid-row {
    display: grid;
    grid-template-columns: 60px repeat(7, 1fr);
    border-bottom: 1px solid #eee;
  }

  .grid-row:last-child {
    border-bottom: none;
  }

  .slot-label {
    padding: 0.75rem 0.5rem;
    font-weight: 500;
    font-size: 0.8rem;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
  }

  .meal-cell {
    min-height: 80px;
    border-left: 1px solid #eee;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .meal-card {
    width: 100%;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    padding: 0.5rem;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meal-image {
    width: 100%;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }

  .meal-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: #166534;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .btn-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .meal-card:hover .btn-remove {
    opacity: 1;
  }

  .btn-add-meal {
    width: 40px;
    height: 40px;
    background: #f5f5f5;
    border: 2px dashed #ddd;
    border-radius: 8px;
    font-size: 1.5rem;
    color: #999;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add-meal:hover {
    background: #f0fdf4;
    border-color: #10b981;
    color: #10b981;
  }

  /* Modal */
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
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
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
    padding: 1rem 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .recipe-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: none;
    border: 1px solid #eee;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .recipe-option:hover {
    background: #f0fdf4;
    border-color: #10b981;
  }

  .recipe-thumb {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 6px;
  }

  .recipe-thumb-placeholder {
    width: 50px;
    height: 50px;
    background: #f5f5f5;
    border-radius: 6px;
  }

  .recipe-name {
    flex: 1;
    font-weight: 500;
  }

  .no-recipes {
    text-align: center;
    color: #666;
    padding: 2rem;
  }

  @media (max-width: 768px) {
    .planner-grid {
      overflow-x: auto;
    }

    .grid-header,
    .grid-row {
      min-width: 600px;
    }

    .day-name {
      font-size: 0.75rem;
    }
  }
</style>
