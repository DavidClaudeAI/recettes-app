<script lang="ts">
  import { onMount } from 'svelte'
  import {
    getGitHubConfig,
    saveGitHubConfig,
    clearGitHubConfig,
    testGitHubConnection,
    isGitHubConfigured,
    initializeDataFolder,
    type GitHubConfig
  } from '../services/githubStorage'
  import {
    migrateToGitHub,
    clearLocalData,
    exportLocalData,
    getStorageMode,
    getAllRecipes,
    saveRecipe
  } from '../services/dataService'

  let token = $state('')
  let owner = $state('')
  let repo = $state('')
  let branch = $state('main')

  let testing = $state(false)
  let testResult = $state<{ success: boolean; error?: string } | null>(null)
  let migrating = $state(false)
  let migrateResult = $state<{ success: boolean; error?: string; count?: number } | null>(null)

  let isConfigured = $state(false)
  let storageMode = $state<'local' | 'github'>('local')
  let localDataCount = $state(0)

  let repairing = $state(false)
  let repairResult = $state<{ success: boolean; fixed: number; error?: string } | null>(null)

  onMount(async () => {
    const config = getGitHubConfig()
    if (config) {
      token = config.token
      owner = config.owner
      repo = config.repo
      branch = config.branch || 'main'
    }
    isConfigured = isGitHubConfigured()
    storageMode = getStorageMode()

    // Count local data
    try {
      const localData = await exportLocalData()
      localDataCount = localData.recipes.length +
        localData.metadata.length +
        localData.planning.length +
        localData.shoppingLists.length
    } catch {
      localDataCount = 0
    }
  })

  async function testConnection() {
    testing = true
    testResult = null

    const config: GitHubConfig = {
      token,
      owner,
      repo,
      branch
    }

    testResult = await testGitHubConnection(config)
    testing = false
  }

  async function saveConfig() {
    const config: GitHubConfig = {
      token,
      owner,
      repo,
      branch
    }

    // Test first
    testing = true
    testResult = await testGitHubConnection(config)
    testing = false

    if (!testResult.success) {
      return
    }

    // Initialize data folder
    try {
      await initializeDataFolder(config)
    } catch (e) {
      console.error('Error initializing data folder:', e)
    }

    saveGitHubConfig(config)
    isConfigured = true
    storageMode = 'github'

    alert('Configuration GitHub sauvegardee !')
  }

  async function migrate() {
    if (!confirm('Migrer toutes les donnees locales vers GitHub ?')) return

    migrating = true
    migrateResult = null

    const result = await migrateToGitHub()
    migrateResult = result

    if (result.success) {
      // Ask to clear local data
      if (confirm('Migration reussie ! Voulez-vous supprimer les donnees locales ?')) {
        await clearLocalData()
        localDataCount = 0
      }
    }

    migrating = false
  }

  function disconnect() {
    if (!confirm('Deconnecter GitHub ? Les donnees locales seront utilisees.')) return

    clearGitHubConfig()
    token = ''
    owner = ''
    repo = ''
    branch = 'main'
    isConfigured = false
    storageMode = 'local'
    testResult = null
    migrateResult = null
  }

  function createTokenUrl() {
    // Fine-grained tokens (limited to specific repos)
    return 'https://github.com/settings/personal-access-tokens/new'
  }

  async function repairIngredients() {
    if (!confirm('Reparer les ingredients de toutes les recettes ? (corrige les unites manquantes)')) return

    repairing = true
    repairResult = null

    try {
      const recipes = await getAllRecipes()
      let fixedCount = 0

      for (const recipe of recipes) {
        let modified = false

        for (const ingredient of recipe.ingredients) {
          // If unit equals name, it's the old bug - clear the unit
          if (ingredient.unit && ingredient.unit === ingredient.name) {
            ingredient.unit = ''
            modified = true
          }
        }

        if (modified) {
          await saveRecipe(recipe)
          fixedCount++
        }
      }

      repairResult = { success: true, fixed: fixedCount }
    } catch (e) {
      repairResult = { success: false, fixed: 0, error: e instanceof Error ? e.message : 'Erreur inconnue' }
    } finally {
      repairing = false
    }
  }
</script>

<div class="settings">
  <header class="settings-header">
    <h1>Parametres</h1>
  </header>

  <section class="section">
    <h2>Stockage des donnees</h2>

    <div class="storage-status">
      <div class="status-item">
        <span class="status-label">Mode actuel:</span>
        <span class="status-value" class:github={storageMode === 'github'}>
          {storageMode === 'github' ? 'GitHub' : 'Local (IndexedDB)'}
        </span>
      </div>
      {#if localDataCount > 0 && storageMode === 'local'}
        <div class="status-item">
          <span class="status-label">Donnees locales:</span>
          <span class="status-value">{localDataCount} elements</span>
        </div>
      {/if}
    </div>
  </section>

  <section class="section">
    <h2>Configuration GitHub</h2>
    <p class="section-desc">
      Stockez vos recettes dans un repository GitHub pour y acceder depuis plusieurs appareils.
    </p>

    <div class="form-group">
      <label for="token">Token GitHub</label>
      <input
        type="password"
        id="token"
        bind:value={token}
        placeholder="ghp_xxxxxxxxxxxx"
      />
      <a href={createTokenUrl()} target="_blank" rel="noopener" class="help-link">
        Creer un token (Fine-grained, limite a ce repo)
      </a>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="owner">Proprietaire</label>
        <input
          type="text"
          id="owner"
          bind:value={owner}
          placeholder="votre-username"
        />
      </div>

      <div class="form-group">
        <label for="repo">Repository</label>
        <input
          type="text"
          id="repo"
          bind:value={repo}
          placeholder="mes-recettes"
        />
      </div>
    </div>

    <div class="form-group">
      <label for="branch">Branche</label>
      <input
        type="text"
        id="branch"
        bind:value={branch}
        placeholder="main"
      />
    </div>

    {#if testResult}
      <div class="result" class:success={testResult.success} class:error={!testResult.success}>
        {#if testResult.success}
          Connexion reussie !
        {:else}
          Erreur: {testResult.error}
        {/if}
      </div>
    {/if}

    <div class="button-row">
      <button class="btn-secondary" onclick={testConnection} disabled={testing || !token || !owner || !repo}>
        {testing ? 'Test...' : 'Tester la connexion'}
      </button>

      {#if isConfigured}
        <button class="btn-danger" onclick={disconnect}>
          Deconnecter
        </button>
      {/if}

      <button class="btn-primary" onclick={saveConfig} disabled={testing || !token || !owner || !repo}>
        Sauvegarder
      </button>
    </div>
  </section>

  {#if isConfigured && localDataCount > 0}
    <section class="section">
      <h2>Migration des donnees</h2>
      <p class="section-desc">
        Vous avez {localDataCount} elements stockes localement. Migrez-les vers GitHub.
      </p>

      {#if migrateResult}
        <div class="result" class:success={migrateResult.success} class:error={!migrateResult.success}>
          {#if migrateResult.success}
            Migration reussie !
          {:else}
            Erreur: {migrateResult.error}
          {/if}
        </div>
      {/if}

      <button class="btn-primary" onclick={migrate} disabled={migrating}>
        {migrating ? 'Migration en cours...' : 'Migrer vers GitHub'}
      </button>
    </section>
  {/if}

  {#if isConfigured}
    <section class="section">
      <h2>Maintenance</h2>
      <p class="section-desc">
        Repare les recettes dont les ingredients ont ete mal importes (unite = nom).
      </p>

      {#if repairResult}
        <div class="result" class:success={repairResult.success} class:error={!repairResult.success}>
          {#if repairResult.success}
            {repairResult.fixed} recette(s) reparee(s) !
          {:else}
            Erreur: {repairResult.error}
          {/if}
        </div>
      {/if}

      <button class="btn-secondary" onclick={repairIngredients} disabled={repairing}>
        {repairing ? 'Reparation en cours...' : 'Reparer les ingredients'}
      </button>
    </section>
  {/if}

  <section class="section">
    <h2>Instructions</h2>
    <ol class="instructions">
      <li>
        <strong>Creez un repository GitHub</strong> (public ou prive) pour stocker vos recettes
      </li>
      <li>
        <strong>Generez un Fine-grained token</strong> sur
        <a href={createTokenUrl()} target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a>
        <ul>
          <li>Repository access: Only select repositories → votre repo</li>
          <li>Permissions: Contents → Read and write</li>
        </ul>
      </li>
      <li>
        <strong>Remplissez le formulaire</strong> ci-dessus et testez la connexion
      </li>
      <li>
        <strong>Migrez vos donnees</strong> existantes vers GitHub
      </li>
      <li>
        <strong>Deployez sur GitHub Pages</strong> pour acceder a l'app depuis n'importe ou
      </li>
    </ol>
  </section>
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
  }

  .settings-header h1 {
    font-size: 1.5rem;
    color: #1a1a1a;
  }

  .section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .section h2 {
    font-size: 1.1rem;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
  }

  .section-desc {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .storage-status {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
  }

  .status-item:last-child {
    border-bottom: none;
  }

  .status-label {
    color: #666;
  }

  .status-value {
    font-weight: 600;
    color: #666;
  }

  .status-value.github {
    color: #10b981;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: #10b981;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .help-link {
    display: inline-block;
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: #10b981;
  }

  .result {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .result.success {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .result.error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .button-row {
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

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #dc2626;
    border: 1px solid #dc2626;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-danger:hover {
    background: #fef2f2;
  }

  .instructions {
    padding-left: 1.25rem;
    color: #666;
    font-size: 0.9rem;
  }

  .instructions li {
    margin-bottom: 0.75rem;
  }

  .instructions a {
    color: #10b981;
  }

  .instructions ul {
    margin-top: 0.25rem;
    padding-left: 1.25rem;
    font-size: 0.85rem;
  }

  .instructions ul li {
    margin-bottom: 0.25rem;
  }

  @media (max-width: 480px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .button-row {
      flex-direction: column;
    }

    .button-row button {
      width: 100%;
    }
  }
</style>
