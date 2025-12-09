# Plan de développement - App Recettes PWA

## Vue d'ensemble du projet

Application de gestion de recettes personnelle en Svelte 5/PWA avec stockage 100% local.

### Architecture de stockage
- **Code source** : C:/dev/recettes-app (gere avec Git/GitHub)
- **Donnees utilisateur** : IndexedDB (stockage navigateur local)
- **Backup** : Export/Import JSON manuel vers nimporte quel dossier

> **Note** : Le stockage direct sur Google Drive a ete abandonne car npm ne fonctionne pas sur les dossiers synchronises.

### Stack technique
- Svelte 5 avec runes ($state, $derived, $props)
- Vite + vite-plugin-pwa
- TypeScript
- IndexedDB via idb
- Routing hash-based

---

## Phase 1 : Fondations (Setup & Structure)

### 1.1 Initialisation du projet
- [x] Créer le projet Svelte avec Vite
- [x] Configurer TypeScript
- [x] Installer et configurer le plugin PWA (vite-plugin-pwa)
- [x] Configurer le manifest.json (icônes, nom, couleurs, display standalone)
- [x] Mettre en place le service worker pour le cache offline

### 1.2 Structure du projet
```
src/
├── lib/
│   ├── components/     # Composants réutilisables
│   ├── stores/         # Stores Svelte (état global)
│   ├── services/       # Logique métier (storage, parser, etc.)
│   ├── utils/          # Fonctions utilitaires
│   └── types/          # Types TypeScript
├── routes/             # Pages de l'application
└── app.html
```

### 1.3 Configuration du stockage
- [x] Définir les types TypeScript pour les recettes et métadonnées
- [x] Créer le service de stockage IndexedDB (via idb)
- [x] Implémenter l'export/import JSON complet
- [ ] Implémenter l'export/import Markdown par recette

---

## Phase 2 : Modèle de données

### 2.1 Structure d'une recette (TypeScript)
```typescript
interface Recipe {
  id: string;                    // UUID unique
  title: string;
  source?: string;               // URL d'origine
  prepTime?: number;             // minutes
  cookTime?: number;             // minutes
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  group?: string;               // ex: "pour la sauce"
}
```

### 2.2 Métadonnées (index.json)
```typescript
interface RecipeMetadata {
  id: string;
  status: 'to-test' | 'testing' | 'validated' | 'archived';
  rating?: number;              // 1-5
  tags: string[];
  history: HistoryEntry[];      // réalisations passées
}

interface HistoryEntry {
  date: Date;
  notes?: string;
}
```

### 2.3 Format Markdown
- [ ] Définir le template front-matter YAML
- [ ] Créer parser Markdown → Recipe
- [ ] Créer serializer Recipe → Markdown

---

## Phase 3 : CRUD Recettes

### 3.1 Création de recette
- [ ] Formulaire de création complet
  - Champs texte : titre, source, notes
  - Champs numériques : temps prep/cuisson, portions
  - Liste dynamique d'ingrédients (ajout/suppression)
  - Liste dynamique d'étapes (ajout/suppression/réordonnement)
- [ ] Validation des données
- [x] Sauvegarde en IndexedDB

### 3.2 Liste des recettes
- [x] Composant carte recette (thumbnail, titre, temps, rating)
- [x] Vue grille responsive
- [x] Pagination ou scroll infini

### 3.3 Vue détaillée d'une recette
- [x] Affichage complet de la recette
- [ ] Actions : éditer, supprimer, mode cuisine, ajouter au planning
- [x] Affichage du statut, rating, tags

### 3.4 Édition de recette
- [ ] Pré-remplissage du formulaire
- [x] Sauvegarde des modifications
- [ ] Gestion des conflits (date de modification)

### 3.5 Suppression
- [x] Confirmation avant suppression
- [ ] Suppression soft (archivage) ou hard

---

## Phase 4 : Import depuis URL

### 4.1 Parser schema.org/Recipe
- [x] Extraire le JSON-LD de la page
- [ ] Parser les champs Recipe :
  - name → title
  - recipeIngredient → ingredients (parser quantité/unité/nom)
  - recipeInstructions → steps
  - prepTime/cookTime (format ISO 8601 duration)
  - recipeYield → servings
  - image → thumbnail
- [ ] Gérer les différents formats (array, string, HowToStep)

### 4.2 Interface d'import
- [x] Champ URL
- [x] Bouton "Analyser"
- [ ] Prévisualisation des données extraites
- [ ] Possibilité de modifier avant sauvegarde
- [x] Gestion des erreurs (page inaccessible, pas de schema)

### 4.3 Parser d'ingrédients
- [x] Regex/NLP basique pour extraire :
  - Quantité (nombres, fractions)
  - Unité (g, kg, ml, cl, L, c. à soupe, etc.)
  - Nom de l'ingrédient
- [ ] Table de correspondance des unités FR/EN

---

## Phase 5 : Organisation & Métadonnées

### 5.1 Système de statuts
- [ ] Sélecteur de statut sur la fiche recette
- [x] Badges visuels par statut
- [x] Filtrage par statut dans la liste

### 5.2 Notation par étoiles
- [ ] Composant étoiles cliquables (1-5)
- [x] Affichage dans les cartes et fiches
- [ ] Tri/filtre par note

### 5.3 Système de tags
- [ ] Input avec autocomplétion (tags existants)
- [ ] Création de nouveaux tags à la volée
- [x] Affichage en chips/badges
- [ ] Filtre multi-tags

### 5.4 Historique des réalisations
- [ ] Bouton "J'ai fait cette recette"
- [ ] Popup pour ajouter date + notes
- [ ] Liste des réalisations sur la fiche
- [ ] Compteur "fait X fois"

---

## Phase 6 : Recherche & Filtres

### 6.1 Recherche textuelle
- [x] Barre de recherche globale
- [ ] Recherche dans : titre, ingrédients, tags, notes
- [ ] Debounce pour performance
- [ ] Highlight des résultats

### 6.2 Recherche par ingrédients
- [ ] Input multi-ingrédients ("j'ai: poulet, courgettes, riz")
- [ ] Algorithme de matching :
  - Recettes avec TOUS les ingrédients
  - Recettes avec CERTAINS ingrédients (score)
- [ ] Affichage "ingrédients manquants"

### 6.3 Filtres combinés
- [ ] Panel de filtres (sidebar ou modal)
- [ ] Filtres : statut, rating min, tags, temps max
- [ ] Combinaison ET entre filtres
- [ ] Compteur de résultats
- [ ] Bouton "réinitialiser filtres"

---

## Phase 7 : Mode Cuisine

### 7.1 Interface dédiée
- [ ] Plein écran / mode immersif
- [ ] Grande police, contraste élevé
- [x] Navigation par swipe ou boutons large
- [x] Indicateur de progression (étape 3/8)

### 7.2 Wake Lock API
- [ ] Activer wake lock à l'entrée du mode
- [ ] Désactiver à la sortie
- [ ] Fallback si non supporté (message)

### 7.3 Navigation étape par étape
- [ ] Vue étape courante (texte large)
- [ ] Boutons précédent/suivant
- [ ] Liste miniature des étapes (navigation directe)
- [ ] Animation de transition

### 7.4 Ingrédients accessibles
- [ ] Panel latéral ou drawer avec liste ingrédients
- [ ] Possibilité de cocher les ingrédients utilisés

### 7.5 Timers intégrés
- [ ] Détection des durées dans le texte ("cuire 15 min")
- [ ] Bouton timer à côté de l'étape
- [x] Timer flottant avec alarme sonore
- [ ] Multiple timers simultanés possibles

---

## Phase 8 : Planning Hebdomadaire

### 8.1 Interface calendrier
- [ ] Vue semaine (7 jours)
- [ ] Créneaux : midi / soir (ou personnalisables)
- [ ] Navigation semaine précédente/suivante

### 8.2 Affectation des recettes
- [ ] Drag & drop depuis liste de recettes
- [ ] Ou bouton "+" pour rechercher et ajouter
- [ ] Affichage miniature de la recette planifiée

### 8.3 Gestion du planning
- [ ] Déplacer une recette planifiée
- [ ] Supprimer du planning
- [ ] Dupliquer un repas

### 8.4 Persistance
- [ ] Stockage du planning en IndexedDB
- [ ] Structure : { weekStart: Date, meals: { day, slot, recipeId }[] }

---

## Phase 9 : Liste de Courses

### 9.1 Génération automatique
- [ ] Sélection de recettes manuelles
- [ ] Ou génération depuis le planning de la semaine
- [ ] Bouton "Générer la liste"

### 9.2 Cumul intelligent
- [ ] Regrouper les ingrédients identiques
- [ ] Additionner les quantités (même unité)
- [ ] Convertir si unités compatibles (100g + 200g = 300g)
- [ ] Afficher la provenance ("pour: Poulet rôti, Gratin")

### 9.3 Organisation de la liste
- [ ] Tri par rayon/catégorie (fruits, légumes, viandes, etc.)
- [ ] Cases à cocher
- [ ] Barrer les items cochés

### 9.4 Ajouts manuels
- [ ] Input pour ajouter un item libre
- [ ] Quantité optionnelle
- [ ] Catégorisation manuelle

### 9.5 Persistance
- [ ] Sauvegarder la liste courante
- [ ] Historique des listes passées (optionnel)

---

## Phase 10 : Outils Pratiques

### 10.1 Conversion d'unités
- [ ] Modal/page de conversion
- [ ] Sélecteurs : quantité, unité source, unité cible
- [ ] Optionnel : type d'ingrédient (pour cups → g)
- [ ] Table de conversion :
  - Volume : ml, cl, L, c. à café, c. à soupe, tasse
  - Poids : g, kg
  - Cups US vers grammes (selon ingrédient)

### 10.2 Ajustement des portions
- [ ] Input nombre de portions sur la fiche recette
- [ ] Recalcul automatique des quantités
- [ ] Garder les valeurs originales visibles
- [ ] Arrondi intelligent

---

## Phase 11 : Export & Partage

### 11.1 Export de recette
- [ ] Export Markdown (téléchargement fichier)
- [ ] Export JSON
- [ ] Copier en texte formaté (presse-papier)
- [ ] Génération PDF (via html2pdf ou similaire)
- [ ] Génération image (via html2canvas)

### 11.2 Lien partageable
- [ ] Encoder la recette dans l'URL (base64 ou paramètres)
- [ ] Ou génération de lien court (nécessite backend)
- [ ] Page de visualisation pour destinataire

### 11.3 Export liste de courses
- [ ] Copier en texte formaté (liste à puces)
- [ ] Format Google Keep (checkboxes)
- [ ] Partage via Web Share API

### 11.4 Sync Google Drive
- [ ] Export complet (zip de tous les fichiers)
- [ ] Import depuis fichiers existants
- [ ] Optionnel : intégration Google Drive API
  - Authentification OAuth
  - Lecture/écriture directe

---

## Phase 12 : UI/UX & Polish

### 12.1 Design System
- [ ] Palette de couleurs cohérente
- [ ] Typographie (police lisible, hiérarchie)
- [ ] Composants de base : boutons, inputs, cards, modals
- [ ] Icônes (Heroicons, Lucide, ou autre)

### 12.2 Thème sombre/clair
- [ ] Détection préférence système
- [ ] Toggle manuel
- [ ] Persistance du choix
- [ ] Variables CSS pour les couleurs

### 12.3 Responsive Design
- [ ] Mobile-first
- [ ] Breakpoints : mobile < 640px, tablet < 1024px, desktop
- [ ] Navigation adaptative (bottom nav mobile, sidebar desktop)

### 12.4 Animations & Transitions
- [ ] Transitions de page fluides
- [ ] Micro-interactions (hover, focus, click)
- [ ] Loading states (skeletons)

### 12.5 Accessibilité
- [ ] Labels ARIA
- [ ] Navigation clavier
- [ ] Contraste suffisant
- [ ] Focus visible

---

## Phase 13 : Optimisation & Finalisation

### 13.1 Performance
- [ ] Audit Lighthouse (viser score > 90)
- [ ] Lazy loading des images
- [ ] Code splitting par route
- [ ] Optimisation du bundle (tree shaking)

### 13.2 PWA Compliance
- [ ] Vérifier installabilité
- [ ] Tester mode offline complet
- [ ] Icônes toutes tailles
- [ ] Splash screen

### 13.3 Tests
- [ ] Tests unitaires (fonctions critiques)
- [ ] Tests composants (Vitest + Testing Library)
- [ ] Tests E2E basiques (Playwright)

### 13.4 Documentation
- [ ] README avec instructions d'installation
- [ ] Guide utilisateur basique
- [ ] Documentation technique (architecture)

---

## Dépendances recommandées

### Core
- `svelte` + `@sveltejs/kit` (ou Vite seul)
- `vite-plugin-pwa`
- `typescript`

### Stockage
- `idb` ou `dexie` (IndexedDB simplifié)

### UI
- `tailwindcss` (optionnel mais recommandé)
- `lucide-svelte` (icônes)

### Parsing
- `gray-matter` (front-matter YAML)
- `marked` ou `unified` (Markdown)

### Export
- `html2pdf.js` (PDF)
- `html2canvas` (images)

### Utilitaires
- `date-fns` (dates)
- `uuid` (génération IDs)

---

## Estimation de complexité par phase

| Phase | Complexité | Priorité |
|-------|------------|----------|
| 1. Fondations | Moyenne | Critique |
| 2. Modèle de données | Faible | Critique |
| 3. CRUD Recettes | Moyenne | Critique |
| 4. Import URL | Haute | Haute |
| 5. Organisation | Moyenne | Haute |
| 6. Recherche | Moyenne | Haute |
| 7. Mode Cuisine | Moyenne | Moyenne |
| 8. Planning | Moyenne | Moyenne |
| 9. Liste courses | Haute | Moyenne |
| 10. Outils | Faible | Basse |
| 11. Export/Partage | Moyenne | Basse |
| 12. UI/UX | Moyenne | Continue |
| 13. Optimisation | Faible | Finale |

---

## Prochaine étape

Quand tu es prêt, on commence par la **Phase 1 : Setup du projet Svelte + PWA**.
