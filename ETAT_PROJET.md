# État du projet Recettes App

## Architecture
- **Emplacement code** : `C:/dev/recettes-app`
- **Stockage données** : IndexedDB (local dans le navigateur)
- **Framework** : Svelte 5 avec runes ($state, $derived, $props)
- **Build** : Vite + vite-plugin-pwa

## Travail terminé

### Infrastructure
- Setup Svelte + Vite + TypeScript + PWA configuré
- IndexedDB via `idb` library
- Routing hash-based (#/recipes/:id, #/cooking/:id)

### Composants créés
- `Navigation.svelte` - Barre de navigation
- `RecipeList.svelte` - Grille de recettes avec recherche
- `RecipeCard.svelte` - Carte recette
- `RecipeForm.svelte` - Formulaire création
- `RecipeFormEdit.svelte` - Formulaire édition
- `RecipeView.svelte` - Vue détaillée avec métadonnées
- `StarRating.svelte` - Notation étoiles 1-5
- `TagInput.svelte` - Saisie tags avec autocomplétion
- `CookingMode.svelte` - Mode cuisine plein écran avec timers
- `ImportUrl.svelte` - Import depuis URL

### Services
- `storage.ts` - CRUD IndexedDB (AVEC JSON.parse/stringify pour éviter DataCloneError Svelte 5)
- `recipeParser.ts` - Parse schema.org/Recipe depuis HTML

### Bug corrigé
**DataCloneError** : Svelte 5 utilise des Proxy pour $state. IndexedDB ne peut pas cloner les Proxy.
Solution : `JSON.parse(JSON.stringify(data))` avant chaque `db.put()`

## Travail terminé récemment

### Récupération d'images lors de l'import URL ✓

1. **Type Recipe** : Champ `image?: string` ajouté ✓
2. **recipeParser.ts** : Fonction `fetchImageAsBase64()` ajoutée, convertit l'image en base64 ✓
3. **ImportUrl.svelte** : Passe `parsedRecipe.image` lors de la création ✓
4. **RecipeCard.svelte** : Affiche l'image en haut de la carte ✓
5. **RecipeView.svelte** : Affiche l'image en haut de la vue détaillée ✓

## Commandes utiles

```bash
cd C:/dev/recettes-app
npm run dev          # Lancer le serveur de dev
npm run build        # Build production
npm run preview      # Preview du build
```

## Pour reprendre

1. Ouvrir le projet dans `C:/dev/recettes-app`
2. Lire ce fichier ETAT_PROJET.md
3. Continuer l'implémentation des images (voir section "Travail en cours")
4. Ensuite : Phase 8 Planning, Phase 9 Liste de courses
