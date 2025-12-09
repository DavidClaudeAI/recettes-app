<script lang="ts">
  interface Props {
    currentRoute: string
  }

  let { currentRoute }: Props = $props()

  const navItems = [
    { path: '/', label: 'Recettes', icon: '🍳' },
    { path: '/planning', label: 'Planning', icon: '📅' },
    { path: '/shopping', label: 'Courses', icon: '🛒' },
    { path: '/settings', label: 'Parametres', icon: '⚙️' }
  ]

  function isActive(path: string): boolean {
    if (path === '/') {
      return currentRoute === '/' || currentRoute.startsWith('/recipes')
    }
    return currentRoute.startsWith(path)
  }
</script>

<nav class="nav">
  <div class="nav-brand">
    <a href="#/">
      <span class="brand-icon">🍽️</span>
      <span class="brand-text">Mes Recettes</span>
    </a>
  </div>

  <div class="nav-links">
    {#each navItems as item}
      <a
        href="#{item.path}"
        class="nav-link"
        class:active={isActive(item.path)}
      >
        <span class="nav-icon">{item.icon}</span>
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>

<style>
  .nav {
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 0 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .nav-brand a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: #10b981;
    font-weight: 600;
    font-size: 1.2rem;
    padding: 1rem 0;
  }

  .brand-icon {
    font-size: 1.5rem;
  }

  .nav-links {
    display: flex;
    gap: 0.5rem;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: #666;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .nav-link:hover {
    background: #f0fdf4;
    color: #10b981;
  }

  .nav-link.active {
    background: #10b981;
    color: white;
  }

  .nav-icon {
    font-size: 1.2rem;
  }

  @media (max-width: 640px) {
    .nav {
      flex-direction: column;
      padding: 0.5rem;
    }

    .nav-brand {
      width: 100%;
      text-align: center;
    }

    .brand-text {
      display: none;
    }

    .nav-links {
      width: 100%;
      justify-content: center;
    }

    .nav-label {
      display: none;
    }

    .nav-link {
      padding: 0.75rem;
    }
  }
</style>
