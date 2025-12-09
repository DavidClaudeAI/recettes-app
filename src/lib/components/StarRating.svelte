<script lang="ts">
  interface Props {
    rating: number
    onchange: (rating: number) => void
    readonly?: boolean
  }

  let { rating, onchange, readonly = false }: Props = $props()

  let hoverRating = $state<number | null>(null)

  function handleClick(value: number) {
    if (!readonly) {
      onchange(value)
    }
  }

  function handleMouseEnter(value: number) {
    if (!readonly) {
      hoverRating = value
    }
  }

  function handleMouseLeave() {
    hoverRating = null
  }

  const displayRating = $derived(hoverRating ?? rating)
</script>

<div class="star-rating" class:readonly role="group" aria-label="Note">
  {#each [1, 2, 3, 4, 5] as value}
    <button
      type="button"
      class="star"
      class:filled={value <= displayRating}
      onclick={() => handleClick(value)}
      onmouseenter={() => handleMouseEnter(value)}
      onmouseleave={handleMouseLeave}
      disabled={readonly}
      aria-label="{value} étoile{value > 1 ? 's' : ''}"
    >
      {value <= displayRating ? '★' : '☆'}
    </button>
  {/each}
</div>

<style>
  .star-rating {
    display: flex;
    gap: 0.25rem;
  }

  .star {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    color: #d1d5db;
    transition: transform 0.1s;
  }

  .star.filled {
    color: #f59e0b;
  }

  .star:hover:not(:disabled) {
    transform: scale(1.2);
  }

  .star:disabled {
    cursor: default;
  }

  .readonly .star {
    cursor: default;
  }
</style>
