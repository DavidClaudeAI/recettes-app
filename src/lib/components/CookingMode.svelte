<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getRecipe } from '../services/dataService'
  import type { Recipe } from '../types'

  interface Props {
    recipeId: string
  }

  let { recipeId }: Props = $props()

  let recipe = $state<Recipe | null>(null)
  let loading = $state(true)
  let currentStep = $state(0)
  let showIngredients = $state(false)
  let wakeLock = $state<WakeLockSentinel | null>(null)
  let timers = $state<Map<number, { remaining: number; interval: number }>>(new Map())

  onMount(async () => {
    try {
      recipe = await getRecipe(recipeId) ?? null
      await requestWakeLock()
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
      } else if (e.key === 'Escape') {
        exitCookingMode()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  onDestroy(() => {
    releaseWakeLock()
    // Clear all timers
    timers.forEach(timer => clearInterval(timer.interval))
  })

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen')
      } catch (e) {
        console.log('Wake Lock not available:', e)
      }
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release()
      wakeLock = null
    }
  }

  function nextStep() {
    if (recipe && currentStep < recipe.steps.length - 1) {
      currentStep++
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--
    }
  }

  function goToStep(index: number) {
    currentStep = index
  }

  function exitCookingMode() {
    releaseWakeLock()
    window.location.hash = `/recipes/${recipeId}`
  }

  // Timer functionality
  function parseTimeFromStep(step: string): number | null {
    const patterns = [
      /(\d+)\s*min(?:ute)?s?/i,
      /(\d+)\s*h(?:eure)?s?/i,
      /pendant\s+(\d+)\s*min/i,
      /cuire\s+(\d+)\s*min/i,
      /laisser\s+(\d+)\s*min/i
    ]

    for (const pattern of patterns) {
      const match = step.match(pattern)
      if (match) {
        const value = parseInt(match[1])
        if (pattern.source.includes('h')) {
          return value * 60 // Convert hours to minutes
        }
        return value
      }
    }
    return null
  }

  function startTimer(stepIndex: number, minutes: number) {
    if (timers.has(stepIndex)) return

    let remaining = minutes * 60 // Convert to seconds

    const interval = setInterval(() => {
      remaining--
      timers.set(stepIndex, { remaining, interval })
      timers = new Map(timers) // Trigger reactivity

      if (remaining <= 0) {
        clearInterval(interval)
        timers.delete(stepIndex)
        timers = new Map(timers)
        // Play sound or vibrate
        playAlarm()
      }
    }, 1000)

    timers.set(stepIndex, { remaining, interval })
    timers = new Map(timers)
  }

  function stopTimer(stepIndex: number) {
    const timer = timers.get(stepIndex)
    if (timer) {
      clearInterval(timer.interval)
      timers.delete(stepIndex)
      timers = new Map(timers)
    }
  }

  function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function playAlarm() {
    // Try to vibrate if available
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
    // Could also play a sound here
    alert('Timer terminé !')
  }

  const currentStepTime = $derived(recipe ? parseTimeFromStep(recipe.steps[currentStep]) : null)
  const hasTimerForCurrentStep = $derived(timers.has(currentStep))
</script>

<div class="cooking-mode">
  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if !recipe}
    <div class="error">
      <p>Recette non trouvée</p>
      <a href="#/">Retour</a>
    </div>
  {:else}
    <header class="cooking-header">
      <button class="btn-exit" onclick={exitCookingMode}>
        ← Quitter
      </button>
      <h1>{recipe.title}</h1>
      <button class="btn-ingredients" onclick={() => showIngredients = !showIngredients}>
        🥗 Ingrédients
      </button>
    </header>

    <div class="progress-bar">
      <div class="progress-fill" style="width: {((currentStep + 1) / recipe.steps.length) * 100}%"></div>
    </div>

    <div class="step-indicators">
      {#each recipe.steps as _, i}
        <button
          class="step-dot"
          class:active={i === currentStep}
          class:completed={i < currentStep}
          onclick={() => goToStep(i)}
          aria-label="Étape {i + 1}"
        ></button>
      {/each}
    </div>

    <main class="step-content">
      <span class="step-label">Étape {currentStep + 1} / {recipe.steps.length}</span>
      <p class="step-text">{recipe.steps[currentStep]}</p>

      {#if currentStepTime}
        <div class="timer-section">
          {#if hasTimerForCurrentStep}
            <div class="timer-display">
              <span class="timer-value">{formatTimer(timers.get(currentStep)?.remaining || 0)}</span>
              <button class="btn-timer-stop" onclick={() => stopTimer(currentStep)}>
                Arrêter
              </button>
            </div>
          {:else}
            <button class="btn-timer" onclick={() => startTimer(currentStep, currentStepTime)}>
              ⏱️ Timer {currentStepTime} min
            </button>
          {/if}
        </div>
      {/if}
    </main>

    <nav class="step-navigation">
      <button
        class="btn-nav btn-prev"
        onclick={prevStep}
        disabled={currentStep === 0}
      >
        ← Précédent
      </button>
      <button
        class="btn-nav btn-next"
        onclick={nextStep}
        disabled={currentStep === recipe.steps.length - 1}
      >
        Suivant →
      </button>
    </nav>

    {#if currentStep === recipe.steps.length - 1}
      <div class="completion-message">
        <p>🎉 C'est terminé ! Bon appétit !</p>
        <button class="btn-finish" onclick={exitCookingMode}>
          Fermer le mode cuisine
        </button>
      </div>
    {/if}
  {/if}
</div>

{#if showIngredients && recipe}
  <div class="ingredients-drawer" role="dialog" aria-modal="true">
    <div class="drawer-content">
      <header class="drawer-header">
        <h2>Ingrédients</h2>
        <button class="btn-close" onclick={() => showIngredients = false}>×</button>
      </header>
      <ul class="ingredients-list">
        {#each recipe.ingredients as ingredient}
          <li>
            <span class="qty">{ingredient.quantity} {ingredient.unit}</span>
            <span class="name">{ingredient.name}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<!-- Active timers floating display -->
{#if timers.size > 0}
  <div class="floating-timers">
    {#each [...timers.entries()] as [stepIndex, timer]}
      <div class="floating-timer">
        <span class="timer-step">Étape {stepIndex + 1}</span>
        <span class="timer-time">{formatTimer(timer.remaining)}</span>
        <button onclick={() => stopTimer(stepIndex)}>×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .cooking-mode {
    position: fixed;
    inset: 0;
    background: #1a1a1a;
    color: white;
    display: flex;
    flex-direction: column;
    z-index: 2000;
  }

  .loading, .error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .error a {
    color: #10b981;
  }

  .cooking-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #222;
  }

  .cooking-header h1 {
    font-size: 1.1rem;
    font-weight: 500;
    text-align: center;
    flex: 1;
    margin: 0 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-exit {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    font-size: 0.9rem;
  }

  .btn-ingredients {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    font-size: 1.5rem;
  }

  .progress-bar {
    height: 4px;
    background: #333;
  }

  .progress-fill {
    height: 100%;
    background: #10b981;
    transition: width 0.3s ease;
  }

  .step-indicators {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
  }

  .step-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #444;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .step-dot.active {
    background: #10b981;
    transform: scale(1.3);
  }

  .step-dot.completed {
    background: #065f46;
  }

  .step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }

  .step-label {
    font-size: 0.9rem;
    color: #10b981;
    margin-bottom: 1rem;
  }

  .step-text {
    font-size: 1.5rem;
    line-height: 1.6;
    max-width: 600px;
  }

  @media (min-width: 768px) {
    .step-text {
      font-size: 2rem;
    }
  }

  .timer-section {
    margin-top: 2rem;
  }

  .btn-timer {
    background: #f59e0b;
    color: #1a1a1a;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-size: 1.1rem;
    cursor: pointer;
    font-weight: 600;
  }

  .timer-display {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #f59e0b;
    color: #1a1a1a;
    padding: 1rem 2rem;
    border-radius: 8px;
  }

  .timer-value {
    font-size: 2rem;
    font-weight: bold;
    font-family: monospace;
  }

  .btn-timer-stop {
    background: #dc2626;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .step-navigation {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #222;
  }

  .btn-nav {
    flex: 1;
    padding: 1.25rem;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-prev {
    background: #333;
    color: white;
  }

  .btn-next {
    background: #10b981;
    color: white;
  }

  .btn-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .completion-message {
    position: absolute;
    bottom: 100px;
    left: 0;
    right: 0;
    text-align: center;
    padding: 1rem;
  }

  .completion-message p {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .btn-finish {
    background: #10b981;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
  }

  .ingredients-drawer {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 2100;
    display: flex;
    justify-content: flex-end;
  }

  .drawer-content {
    width: 100%;
    max-width: 350px;
    background: #222;
    height: 100%;
    overflow-y: auto;
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #333;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .btn-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .ingredients-list {
    list-style: none;
    padding: 1rem;
  }

  .ingredients-list li {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid #333;
  }

  .ingredients-list .qty {
    color: #10b981;
    min-width: 80px;
  }

  .ingredients-list .name {
    color: white;
  }

  .floating-timers {
    position: fixed;
    top: 80px;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 2050;
  }

  .floating-timer {
    background: #f59e0b;
    color: #1a1a1a;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
  }

  .floating-timer .timer-step {
    font-weight: 500;
  }

  .floating-timer .timer-time {
    font-family: monospace;
    font-weight: bold;
  }

  .floating-timer button {
    background: none;
    border: none;
    color: #1a1a1a;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0;
  }
</style>
