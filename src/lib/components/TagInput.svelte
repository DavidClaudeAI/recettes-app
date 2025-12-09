<script lang="ts">
  import { allTags } from '../stores/recipes'

  interface Props {
    tags: string[]
    onchange: (tags: string[]) => void
  }

  let { tags, onchange }: Props = $props()

  let inputValue = $state('')
  let showSuggestions = $state(false)

  const suggestions = $derived(
    $allTags
      .filter(t => !tags.includes(t))
      .filter(t => t.toLowerCase().includes(inputValue.toLowerCase()))
      .slice(0, 5)
  )

  function addTag(tag: string) {
    const normalized = tag.trim().toLowerCase()
    if (normalized && !tags.includes(normalized)) {
      onchange([...tags, normalized])
    }
    inputValue = ''
    showSuggestions = false
  }

  function removeTag(tag: string) {
    onchange(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }
</script>

<div class="tag-input">
  <div class="tags-container">
    {#each tags as tag}
      <span class="tag">
        {tag}
        <button type="button" onclick={() => removeTag(tag)}>×</button>
      </span>
    {/each}
    <input
      type="text"
      bind:value={inputValue}
      onkeydown={handleKeyDown}
      onfocus={() => showSuggestions = true}
      onblur={() => setTimeout(() => showSuggestions = false, 200)}
      placeholder={tags.length === 0 ? 'Ajouter un tag...' : ''}
    />
  </div>

  {#if showSuggestions && (suggestions.length > 0 || inputValue)}
    <ul class="suggestions">
      {#each suggestions as suggestion}
        <li>
          <button type="button" onclick={() => addTag(suggestion)}>
            {suggestion}
          </button>
        </li>
      {/each}
      {#if inputValue && !suggestions.includes(inputValue.toLowerCase())}
        <li class="new-tag">
          <button type="button" onclick={() => addTag(inputValue)}>
            + Créer "{inputValue}"
          </button>
        </li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .tag-input {
    position: relative;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    min-height: 42px;
  }

  .tags-container:focus-within {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #f0fdf4;
    color: #10b981;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .tag button {
    background: none;
    border: none;
    color: #10b981;
    cursor: pointer;
    padding: 0;
    font-size: 1rem;
    line-height: 1;
  }

  .tag button:hover {
    color: #059669;
  }

  .tags-container input {
    flex: 1;
    min-width: 100px;
    border: none;
    outline: none;
    font-size: 0.9rem;
    padding: 0.25rem;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    margin-top: 4px;
    list-style: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .suggestions li button {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .suggestions li button:hover {
    background: #f0fdf4;
  }

  .new-tag button {
    color: #10b981;
    font-weight: 500;
  }
</style>
