<script lang="ts">
  import type { RecipeWithMeta } from '../types'

  interface Props {
    recipe: RecipeWithMeta
  }

  let { recipe }: Props = $props()

  const statusLabels = {
    'to-test': 'À tester',
    'testing': 'En test',
    'validated': 'Validée',
    'archived': 'Archivée'
  }

  const statusColors = {
    'to-test': '#f59e0b',
    'testing': '#3b82f6',
    'validated': '#10b981',
    'archived': '#6b7280'
  }

  function formatTime(minutes?: number): string {
    if (!minutes) return ''
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m}` : `${h}h`
  }

  const totalTime = $derived((recipe.prepTime || 0) + (recipe.cookTime || 0))
</script>

<article class="recipe-card">
  <div class="card-header">
    <span
      class="status-badge"
      style="background-color: {statusColors[recipe.metadata.status]}"
    >
      {statusLabels[recipe.metadata.status]}
    </span>
    {#if recipe.metadata.rating}
      <span class="rating">
        {'★'.repeat(recipe.metadata.rating)}{'☆'.repeat(5 - recipe.metadata.rating)}
      </span>
    {/if}
  </div>

  <h3 class="card-title">{recipe.title}</h3>

  <div class="card-meta">
    {#if totalTime > 0}
      <span class="meta-item">⏱️ {formatTime(totalTime)}</span>
    {/if}
    <span class="meta-item">👥 {recipe.servings} portions</span>
    <span class="meta-item">🥘 {recipe.ingredients.length} ingrédients</span>
  </div>

  {#if recipe.metadata.tags.length > 0}
    <div class="card-tags">
      {#each recipe.metadata.tags.slice(0, 3) as tag}
        <span class="tag">{tag}</span>
      {/each}
      {#if recipe.metadata.tags.length > 3}
        <span class="tag more">+{recipe.metadata.tags.length - 3}</span>
      {/if}
    </div>
  {/if}

  <div class="card-actions">
    <a href="#/recipes/{recipe.id}" class="btn-view">Voir</a>
  </div>
</article>

<style>
  .recipe-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .recipe-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: white;
    font-weight: 500;
  }

  .rating {
    color: #f59e0b;
    font-size: 0.9rem;
  }

  .card-title {
    font-size: 1.1rem;
    color: #1a1a1a;
    margin: 0;
    line-height: 1.3;
  }

  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: #666;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: #f0fdf4;
    color: #10b981;
    border-radius: 4px;
  }

  .tag.more {
    background: #f5f5f5;
    color: #666;
  }

  .card-actions {
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid #f0f0f0;
  }

  .btn-view {
    display: block;
    text-align: center;
    padding: 0.5rem;
    background: #10b981;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .btn-view:hover {
    background: #059669;
  }
</style>
