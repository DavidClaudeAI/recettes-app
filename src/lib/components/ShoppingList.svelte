<script lang="ts">
  import { onMount } from 'svelte'
  import { v4 as uuidv4 } from 'uuid'
  import {
    getAllShoppingLists,
    saveShoppingList,
    deleteShoppingList,
    type ShoppingList,
    type ShoppingItem,
    type ShoppingListStatus
  } from '../services/dataService'
  import { recipes } from '../stores/recipes'
  import type { RecipeWithMeta } from '../types'

  // View state
  let view = $state<'lists' | 'detail'>('lists')
  let allLists = $state<ShoppingList[]>([])
  let currentList = $state<ShoppingList | null>(null)
  let loading = $state(true)

  // Modal states
  let showRecipeSelector = $state(false)
  let showRenameModal = $state(false)
  let selectedRecipeIds = $state<Set<string>>(new Set())
  let searchQuery = $state('')
  let newListName = $state('')
  let newItemName = $state('')
  let editingName = $state('')

  async function loadAllLists() {
    loading = true
    try {
      const lists = await getAllShoppingLists()

      // Migrate old lists without status
      for (const list of lists) {
        if (!list.status) {
          list.status = 'active'
          await saveShoppingList(list)
        }
      }

      // Sort by date, newest first, active first
      allLists = lists.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (b.status === 'active' && a.status !== 'active') return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    } catch (e) {
      console.error('Erreur chargement listes:', e)
    } finally {
      loading = false
    }
  }

  function openList(list: ShoppingList) {
    currentList = list
    view = 'detail'
  }

  function backToLists() {
    view = 'lists'
    currentList = null
    loadAllLists()
  }

  // Create empty list
  async function createEmptyList() {
    const name = prompt('Nom de la nouvelle liste:')
    if (!name?.trim()) return

    const newList: ShoppingList = {
      id: uuidv4(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      status: 'active',
      items: []
    }

    await saveShoppingList(newList)
    await loadAllLists()
    openList(newList)
  }

  // Recipe selector modal
  function openRecipeSelector() {
    selectedRecipeIds = new Set()
    searchQuery = ''
    newListName = ''
    showRecipeSelector = true
  }

  function toggleRecipeSelection(recipeId: string) {
    const newSet = new Set(selectedRecipeIds)
    if (newSet.has(recipeId)) {
      newSet.delete(recipeId)
    } else {
      newSet.add(recipeId)
    }
    selectedRecipeIds = newSet
  }

  async function generateFromSelectedRecipes() {
    if (selectedRecipeIds.size === 0) return

    showRecipeSelector = false

    const selectedRecipes = $recipes.filter(r => selectedRecipeIds.has(r.id))
    const ingredientMap = new Map<string, { item: ShoppingItem; sources: string[] }>()

    for (const recipe of selectedRecipes) {
      for (const ing of recipe.ingredients) {
        const key = normalizeIngredientName(ing.name)
        const existing = ingredientMap.get(key)

        if (existing) {
          if (existing.item.unit === ing.unit) {
            existing.item.quantity = (existing.item.quantity || 0) + ing.quantity
          }
          if (!existing.sources.includes(recipe.title)) {
            existing.sources.push(recipe.title)
          }
        } else {
          ingredientMap.set(key, {
            item: {
              id: uuidv4(),
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              checked: false,
              category: guessCategory(ing.name),
              fromRecipes: [recipe.title]
            },
            sources: [recipe.title]
          })
        }
      }
    }

    const items: ShoppingItem[] = Array.from(ingredientMap.values()).map(({ item, sources }) => ({
      ...item,
      fromRecipes: sources
    }))

    items.sort((a, b) => (a.category || 'zzz').localeCompare(b.category || 'zzz'))

    const recipeNames = selectedRecipes.map(r => r.title).slice(0, 2).join(', ')
    const suffix = selectedRecipes.length > 2 ? ` +${selectedRecipes.length - 2}` : ''
    const defaultName = newListName.trim() || `${recipeNames}${suffix}`

    const newList: ShoppingList = {
      id: uuidv4(),
      name: defaultName,
      createdAt: new Date().toISOString(),
      status: 'active',
      items
    }

    await saveShoppingList(newList)
    await loadAllLists()
    openList(newList)
  }

  // Rename
  function openRenameModal() {
    if (!currentList) return
    editingName = currentList.name
    showRenameModal = true
  }

  async function saveRename() {
    if (!currentList || !editingName.trim()) return
    currentList.name = editingName.trim()
    currentList.updatedAt = new Date().toISOString()
    await saveShoppingList(currentList)
    // Update local state
    allLists = allLists.map(l => l.id === currentList.id ? currentList : l)
    showRenameModal = false
  }

  // Status
  async function setStatus(status: ShoppingListStatus) {
    if (!currentList) return
    currentList.status = status
    currentList.updatedAt = new Date().toISOString()
    await saveShoppingList(currentList)
    // Update local state
    allLists = allLists.map(l => l.id === currentList.id ? currentList : l)
  }

  // Delete
  async function deleteCurrentList() {
    if (!currentList) return
    if (!confirm(`Supprimer la liste "${currentList.name}" ?`)) return
    const deletedId = currentList.id
    await deleteShoppingList(deletedId)
    // Update local state immediately instead of refetching
    allLists = allLists.filter(l => l.id !== deletedId)
    view = 'lists'
    currentList = null
  }

  // Items management
  async function toggleItem(item: ShoppingItem) {
    if (!currentList) return
    item.checked = !item.checked
    currentList.updatedAt = new Date().toISOString()
    await saveShoppingList(currentList)
  }

  async function addManualItem() {
    if (!newItemName.trim() || !currentList) return

    const newItem: ShoppingItem = {
      id: uuidv4(),
      name: newItemName.trim(),
      checked: false,
      category: guessCategory(newItemName)
    }

    currentList.items = [...currentList.items, newItem]
    currentList.updatedAt = new Date().toISOString()
    await saveShoppingList(currentList)
    newItemName = ''
  }

  async function removeItem(itemId: string) {
    if (!currentList) return
    currentList.items = currentList.items.filter(i => i.id !== itemId)
    currentList.updatedAt = new Date().toISOString()
    await saveShoppingList(currentList)
  }

  async function clearChecked() {
    if (!currentList) return
    currentList.items = currentList.items.filter(i => !i.checked)
    currentList.updatedAt = new Date().toISOString()
    await saveShoppingList(currentList)
  }

  // Helpers
  function normalizeIngredientName(name: string): string {
    return name.toLowerCase().trim()
      .replace(/s$/, '')
      .replace(/^(du|de la|des|le|la|les|un|une|d')\s+/i, '')
  }

  function guessCategory(name: string): string {
    const lower = name.toLowerCase()
    const categories: Record<string, string[]> = {
      'Fruits & Legumes': ['tomate', 'carotte', 'oignon', 'ail', 'pomme', 'banane', 'salade', 'courgette', 'poivron', 'champignon', 'citron', 'orange', 'pomme de terre', 'patate', 'poireau', 'chou', 'brocoli', 'haricot', 'petit pois', 'epinard', 'avocat', 'concombre', 'aubergine', 'celeri', 'fenouil', 'gingembre', 'echalote'],
      'Viandes & Poissons': ['poulet', 'boeuf', 'porc', 'veau', 'agneau', 'canard', 'dinde', 'saumon', 'thon', 'cabillaud', 'crevette', 'poisson', 'viande', 'lardons', 'jambon', 'saucisse', 'merguez', 'steak'],
      'Produits laitiers': ['lait', 'fromage', 'beurre', 'creme', 'yaourt', 'oeuf', 'parmesan', 'mozzarella', 'gruyere', 'chevre'],
      'Epicerie': ['riz', 'pate', 'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'moutarde', 'sauce', 'conserve', 'tomate pelees', 'concentre', 'bouillon', 'epice', 'herbe', 'basilic', 'persil', 'thym', 'romarin', 'curry', 'paprika', 'cumin'],
      'Boulangerie': ['pain', 'baguette', 'brioche', 'croissant'],
      'Boissons': ['eau', 'jus', 'vin', 'biere', 'soda', 'cafe', 'the'],
      'Surgeles': ['glace', 'surgele', 'congele']
    }
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return category
      }
    }
    return 'Autres'
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  function getStatusLabel(status: ShoppingListStatus): string {
    const labels: Record<ShoppingListStatus, string> = {
      active: 'En cours',
      completed: 'Terminee',
      archived: 'Archivee'
    }
    return labels[status]
  }

  function getStatusColor(status: ShoppingListStatus): string {
    const colors: Record<ShoppingListStatus, string> = {
      active: '#10b981',
      completed: '#6b7280',
      archived: '#9ca3af'
    }
    return colors[status]
  }

  const filteredRecipes = $derived(
    $recipes.filter(r =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const groupedItems = $derived(() => {
    if (!currentList) return new Map<string, ShoppingItem[]>()
    const groups = new Map<string, ShoppingItem[]>()
    for (const item of currentList.items) {
      const cat = item.category || 'Autres'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(item)
    }
    return groups
  })

  const checkedCount = $derived(currentList?.items.filter(i => i.checked).length || 0)
  const totalCount = $derived(currentList?.items.length || 0)
  const progress = $derived(totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0)

  onMount(() => {
    loadAllLists()
  })
</script>

{#if view === 'lists'}
  <!-- LISTS VIEW -->
  <div class="shopping-lists">
    <header class="lists-header">
      <h1>Listes de courses</h1>
      <div class="header-actions">
        <button class="btn-primary" onclick={openRecipeSelector}>
          + Depuis recettes
        </button>
        <button class="btn-secondary" onclick={createEmptyList}>
          + Liste vide
        </button>
      </div>
    </header>

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if allLists.length === 0}
      <div class="empty">
        <p>Aucune liste de courses.</p>
        <p>Creez-en une depuis vos recettes ou une liste vide.</p>
      </div>
    {:else}
      <div class="lists-grid">
        {#each allLists as list (list.id)}
          <button class="list-card" onclick={() => openList(list)}>
            <div class="list-card-header">
              <span class="list-name">{list.name}</span>
              <span
                class="list-status"
                style="background: {getStatusColor(list.status)}"
              >
                {getStatusLabel(list.status)}
              </span>
            </div>
            <div class="list-card-meta">
              <span>{list.items.length} article{list.items.length !== 1 ? 's' : ''}</span>
              <span class="list-date">{formatDate(list.createdAt)}</span>
            </div>
            {#if list.items.length > 0}
              {@const checked = list.items.filter(i => i.checked).length}
              {@const pct = Math.round((checked / list.items.length) * 100)}
              <div class="list-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {pct}%"></div>
                </div>
                <span class="progress-text">{pct}%</span>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

{:else}
  <!-- DETAIL VIEW -->
  <div class="shopping-detail">
    <header class="detail-header">
      <button class="btn-back" onclick={backToLists}>&larr; Retour</button>
      <div class="detail-title">
        <h1>{currentList?.name}</h1>
        <button class="btn-icon" onclick={openRenameModal} title="Renommer">&#9998;</button>
      </div>
      <div class="detail-actions">
        <select
          class="status-select"
          value={currentList?.status}
          onchange={(e) => setStatus(e.currentTarget.value as ShoppingListStatus)}
        >
          <option value="active">En cours</option>
          <option value="completed">Terminee</option>
          <option value="archived">Archivee</option>
        </select>
        <button class="btn-danger" onclick={deleteCurrentList} title="Supprimer">
          🗑
        </button>
      </div>
    </header>

    {#if currentList}
      <div class="detail-info">
        <span class="progress-label">{checkedCount} / {totalCount} articles ({progress}%)</span>
        <div class="progress-bar large">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
      </div>

      <div class="add-item">
        <input
          type="text"
          placeholder="Ajouter un article..."
          bind:value={newItemName}
          onkeydown={(e) => e.key === 'Enter' && addManualItem()}
        />
        <button class="btn-add" onclick={addManualItem}>+</button>
      </div>

      {#if checkedCount > 0}
        <button class="btn-clear" onclick={clearChecked}>
          Supprimer les {checkedCount} articles coches
        </button>
      {/if}

      <div class="items-container">
        {#each [...groupedItems().entries()] as [category, items]}
          <div class="category-group">
            <h3 class="category-title">{category}</h3>
            <ul class="items-list">
              {#each items as item (item.id)}
                <li class="item" class:checked={item.checked}>
                  <label class="item-label">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onchange={() => toggleItem(item)}
                    />
                    <span class="item-info">
                      <span class="item-name">
                        {#if item.quantity}
                          <strong>{item.quantity}</strong>
                          {#if item.unit}{item.unit}{/if}
                        {/if}
                        {item.name}
                      </span>
                      {#if item.fromRecipes && item.fromRecipes.length > 0}
                        <span class="item-source">
                          Pour: {item.fromRecipes.join(', ')}
                        </span>
                      {/if}
                    </span>
                  </label>
                  <button class="btn-remove" onclick={() => removeItem(item.id)}>&times;</button>
                </li>
              {/each}
            </ul>
          </div>
        {:else}
          <p class="empty-items">La liste est vide. Ajoutez des articles ci-dessus.</p>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Recipe Selector Modal -->
{#if showRecipeSelector}
  <div class="modal-overlay" onclick={() => showRecipeSelector = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2>Nouvelle liste depuis recettes</h2>
        <button class="btn-close" onclick={() => showRecipeSelector = false}>&times;</button>
      </header>
      <div class="modal-content">
        <input
          type="text"
          placeholder="Nom de la liste (optionnel)"
          bind:value={newListName}
          class="name-input"
        />
        <input
          type="search"
          placeholder="Rechercher une recette..."
          bind:value={searchQuery}
          class="search-input"
        />
        <div class="recipe-list">
          {#each filteredRecipes as recipe}
            <button
              class="recipe-option"
              class:selected={selectedRecipeIds.has(recipe.id)}
              onclick={() => toggleRecipeSelection(recipe.id)}
            >
              {#if recipe.image}
                <img src={recipe.image} alt="" class="recipe-thumb" />
              {:else}
                <div class="recipe-thumb-placeholder"></div>
              {/if}
              <span class="recipe-name">{recipe.title}</span>
              <span class="recipe-check">
                {#if selectedRecipeIds.has(recipe.id)}✓{/if}
              </span>
            </button>
          {:else}
            <p class="no-recipes">Aucune recette trouvee</p>
          {/each}
        </div>
      </div>
      <footer class="modal-footer">
        <span class="selected-count">{selectedRecipeIds.size} recette{selectedRecipeIds.size !== 1 ? 's' : ''}</span>
        <button
          class="btn-confirm"
          onclick={generateFromSelectedRecipes}
          disabled={selectedRecipeIds.size === 0}
        >
          Creer la liste
        </button>
      </footer>
    </div>
  </div>
{/if}

<!-- Rename Modal -->
{#if showRenameModal}
  <div class="modal-overlay" onclick={() => showRenameModal = false}>
    <div class="modal small" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2>Renommer la liste</h2>
        <button class="btn-close" onclick={() => showRenameModal = false}>&times;</button>
      </header>
      <div class="modal-content">
        <input
          type="text"
          bind:value={editingName}
          class="name-input"
          onkeydown={(e) => e.key === 'Enter' && saveRename()}
        />
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" onclick={() => showRenameModal = false}>Annuler</button>
        <button class="btn-confirm" onclick={saveRename}>Enregistrer</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* Lists View */
  .shopping-lists, .shopping-detail {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .lists-header, .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .lists-header h1, .detail-title h1 {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin: 0;
  }

  .header-actions, .detail-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #10b981;
    border: 1px solid #10b981;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-secondary:hover {
    background: #f0fdf4;
  }

  .btn-back {
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-back:hover {
    background: #f5f5f5;
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 200px;
  }

  .btn-icon {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    color: #666;
  }

  .btn-icon:hover {
    color: #10b981;
  }

  .btn-danger {
    padding: 0.5rem 0.75rem;
    background: none;
    border: 1px solid #dc2626;
    color: #dc2626;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-danger:hover {
    background: #fef2f2;
  }

  .status-select {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    background: white;
    cursor: pointer;
  }

  .loading, .empty {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    color: #666;
  }

  /* Lists Grid */
  .lists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .list-card {
    background: white;
    border: 1px solid #eee;
    border-radius: 12px;
    padding: 1rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .list-card:hover {
    border-color: #10b981;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  }

  .list-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .list-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: #1a1a1a;
    line-height: 1.3;
  }

  .list-status {
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    color: white;
    font-weight: 500;
    white-space: nowrap;
  }

  .list-card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #666;
  }

  .list-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar.large {
    height: 10px;
    border-radius: 5px;
  }

  .progress-fill {
    height: 100%;
    background: #10b981;
    transition: width 0.3s;
  }

  .progress-text {
    font-size: 0.8rem;
    color: #10b981;
    font-weight: 600;
    min-width: 35px;
    text-align: right;
  }

  /* Detail View */
  .detail-info {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-label {
    font-weight: 500;
    color: #10b981;
  }

  .add-item {
    display: flex;
    gap: 0.5rem;
  }

  .add-item input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
  }

  .add-item input:focus {
    outline: none;
    border-color: #10b981;
  }

  .btn-add {
    padding: 0.75rem 1rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.25rem;
    cursor: pointer;
  }

  .btn-clear {
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid #dc2626;
    color: #dc2626;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    align-self: flex-start;
  }

  .btn-clear:hover {
    background: #fef2f2;
  }

  .items-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .category-group {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .category-title {
    padding: 0.75rem 1rem;
    background: #f9fafb;
    font-size: 0.9rem;
    font-weight: 600;
    color: #666;
    border-bottom: 1px solid #eee;
    margin: 0;
  }

  .items-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .item {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.15s;
  }

  .item:last-child {
    border-bottom: none;
  }

  .item:hover {
    background: #f9fafb;
  }

  .item.checked {
    background: #f5f5f5;
  }

  .item.checked .item-name {
    text-decoration: line-through;
    color: #999;
  }

  .item-label {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
  }

  .item-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    accent-color: #10b981;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .item-name {
    font-size: 1rem;
  }

  .item-name strong {
    color: #10b981;
  }

  .item-source {
    font-size: 0.75rem;
    color: #999;
    font-style: italic;
  }

  .btn-remove {
    background: none;
    border: none;
    color: #999;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .item:hover .btn-remove {
    opacity: 1;
  }

  .btn-remove:hover {
    color: #dc2626;
  }

  .empty-items {
    padding: 2rem;
    text-align: center;
    color: #666;
    background: white;
    border-radius: 8px;
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

  .modal.small {
    max-width: 400px;
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
    flex: 1;
  }

  .name-input, .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .name-input:focus, .search-input:focus {
    outline: none;
    border-color: #10b981;
  }

  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
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

  .recipe-option.selected {
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

  .recipe-check {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #10b981;
    font-weight: bold;
  }

  .no-recipes {
    text-align: center;
    color: #666;
    padding: 2rem;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid #eee;
    gap: 1rem;
  }

  .selected-count {
    color: #666;
    font-size: 0.9rem;
  }

  .btn-confirm {
    padding: 0.75rem 1.5rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
  }

  .btn-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-confirm:not(:disabled):hover {
    background: #059669;
  }

  @media (max-width: 640px) {
    .lists-header, .detail-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      flex-direction: column;
    }

    .detail-title {
      order: -1;
    }
  }
</style>
