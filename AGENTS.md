# AGENT.md — Guide du projet test-interface-sheril

## Vue d'ensemble

Application React (SPA) servant d'interface de visualisation et de planification pour **Sheril**, un jeu de stratégie spatiale 4X au tour par tour (PBEM — Play By Email). L'application est un outil compagnon purement frontend qui consomme les rapports XML du serveur de jeu.

- **URL de déploiement** : https://ydomenjoud.github.io/test-interface-sheril (GitHub Pages)
- **Serveur de jeu** : https://sheril.pbem-france.net

## Stack technique

- **React 19** + **TypeScript 4.9** (Create React App)
- **React Router DOM 7** (HashRouter pour compatibilité GitHub Pages)
- **IndexedDB** pour le stockage persistant multi-tour
- **LocalStorage** pour les préférences UI et annotations utilisateur
- **Canvas 2D** pour le rendu de la carte galactique
- Pas de backend — tout est client-side

## Structure du projet

```
src/
├── App.tsx                    # Configuration des routes
├── index.tsx                  # Point d'entrée (HashRouter)
├── types.ts                   # Définitions TypeScript centrales
├── context/
│   └── ReportContext.tsx       # État global (rapport, données, tours, viewport)
├── screens/                   # Pages principales (11 écrans)
│   ├── Carte.tsx              # Carte galactique interactive + tiroir des ordres de déplacement
│   ├── Planification.tsx      # File de construction (bâtiments + vaisseaux)
│   ├── PlanificationRevenu.tsx # Planification des revenus (taxes, politique, budgets, gouverneurs…)
│   ├── RechercheTechnologique.tsx  # Allocation de recherche
│   ├── Transferts.tsx         # Transferts de bâtiments/marchandises/minerai entre systèmes
│   ├── Transferts.css         # Styles de l'écran Transferts (classes .transferts-*)
│   ├── ListeSystemes.tsx      # Liste des systèmes
│   ├── ListeTechnologies.tsx  # Catalogue des technologies
│   ├── ListeFlottes.tsx       # Liste des flottes
│   ├── ListePlans.tsx         # Plans de vaisseaux
│   ├── CreatePlan.tsx         # Concepteur de plans
│   ├── ArbreTechnologies.tsx  # Arbre technologique visuel
│   └── PlayerSystemDetail.tsx # Détail d'un système
├── components/
│   ├── Header.tsx             # Navigation + upload de fichiers
│   ├── MainLayout.tsx         # Layout avec Outlet
│   ├── Map/                   # Sous-système carte
│   │   ├── CanvasMap.tsx      # Rendu canvas (~2100 lignes)
│   │   ├── MiniMap.tsx        # Miniature de la galaxie
│   │   ├── InfoPanel.tsx      # Panneau d'info de la case sélectionnée (flottes à portée, notes, combats)
│   │   ├── FleetPicker.tsx    # Popup « Flottes sur la case » : source du glisser-déposer des flottes
│   │   ├── ZoneDialog.tsx     # Dialogue d'édition de zones
│   │   ├── ZoneEditor.tsx     # Interface de dessin de zones
│   │   ├── MapHelp.tsx        # Aide / raccourcis clavier
│   │   └── GotoDialog.tsx     # Dialogue de saut aux coordonnées
│   ├── TechTree/
│   │   └── TechTreeCanvas.tsx # Visualisation de l'arbre tech
│   ├── icons/Icons.tsx        # Icônes SVG
│   ├── utils/                 # Composants utilitaires (Modal, Position, Commandant, SearchableSelect)
│   └── multiselect.tsx
├── parsers/                   # Parsing des données de jeu
│   ├── parseRapport.ts        # Rapport joueur (XML)
│   ├── parseData.ts           # Données globales (XML)
│   ├── parsePublicCombats.ts  # Combats publics (scraping HTML)
│   ├── parseCombatMessages.ts # Messages de combat
│   └── parseManualSystems.ts  # Saisie manuelle de systèmes
├── storage/
│   ├── rapportStore.ts        # Couche d'abstraction IndexedDB
│   ├── deplacementOrdersStorage.ts # Ordres de déplacement par tour (localStorage)
│   ├── transfertsStorage.ts   # Ordres de transfert par tour (localStorage)
│   └── radarsAlliesStorage.ts # Portées radar importées des alliés
└── utils/                     # Fonctions utilitaires
    ├── position.ts            # Coordonnées toroïdales (wrapping), bornes de la galaxie
    ├── global.ts              # Formatage, couleurs, lookup joueurs
    ├── zones.ts               # Calculs de zones
    ├── keyboard.ts            # Gestion clavier
    ├── fleetHistory.ts        # Historique des positions de flottes
    ├── systemHistory.ts       # Dernier système vu sur une case (tours précédents)
    ├── presence.ts            # Couche « présence » de la carte (poids décroissant avec l'âge)
    ├── mapTheme.ts            # Palette de la carte (fond sombre / clair)
    ├── ordreSchema.ts         # Format commun des schémas d'ordres (type|base64)
    ├── ordreDeplacement.ts    # Schéma d'ordres de déplacement (table deplacer_flotte)
    ├── pdc.ts                 # PDC ajustés (politique, gouverneur, stock de robots)
    ├── reparation.ts          # Capacité de réparation d'un système
    ├── planificationRevenuStorage.ts # Choix de l'écran Revenus, par tour
    ├── capitale.ts            # Modificateur de stabilité selon la distance à la capitale, aide au choix de la capitale
    ├── combatMarkers.ts       # Marqueurs de combat sur la carte
    ├── puissance.ts           # Calcul de puissance
    ├── planet.ts              # Infos planétaires
    ├── races.ts               # Races du jeu
    ├── sectors.ts             # Secteurs galactiques
    └── commandant.ts          # Utilitaires commandant
```

## Flux de données

```
Serveur de jeu (sheril.pbem-france.net)
    ↓  XML (rapport.xml + data.xml)
Header.tsx (upload fichier ou fetch)
    ↓
Parsers (parseRapport.ts / parseData.ts)
    ↓
ReportContext (état global React Context)
    ↓
IndexedDB (historique multi-tour)
    ↓
Écrans (Carte, Systèmes, Flottes, etc.)
```

1. L'utilisateur uploade son `rapport.xml` via le Header
2. Le parser extrait les données (systèmes, flottes, techs, combats)
3. Le rapport est stocké dans IndexedDB et fusionné avec les rapports précédents
4. Le dernier tour s'affiche automatiquement
5. Les données globales (`data.xml`) sont récupérées depuis le serveur ou les exemples locaux

## Concepts clés du domaine

### Univers toroïdal
La galaxie est une grille (par défaut **60×60**) avec wrapping sur les bords (un vaisseau qui sort à droite réapparaît à gauche). Les fonctions `wrapX()`, `wrapY()`, `torusDelta()` et `getTorusDistance()` dans `utils/position.ts` gèrent cette logique. `BOUNDS` (`{minX, maxX, minY, maxY}`) est recalculé à partir des positions des données chargées : ne pas supposer 60 en dur.

### Entités de jeu
- **Rapport** : données complètes d'un tour pour un joueur
- **SystemeJoueur / SystemeDetecte** : systèmes stellaires (possédés vs détectés)
- **FlotteJoueur / FlotteDetectee** : flottes militaires
- **Technologie** : entrées de l'arbre tech (base + niveau = code unique)
- **PlanVaisseau** : blueprints de vaisseaux
- **Lieutenant** : héros (type 0, affecté à une flotte) ou gouverneur (type 1, affecté à un système) — voir `docs/lieutenants.md`
- **Alliance / PNA** : relations diplomatiques

### Convention de nommage
- Tout le code utilise le **français** (variables, commentaires, UI)
- Suffixe `Joueur` = possédé par le joueur, `Detecte` = détecté (pas possédé)
- Format de position : `"galaxie_X_Y"` (clé string pour les coordonnées)

## Stockage persistant

### IndexedDB (base "sheril", v3)
- Store `rapports` : rapports par tour (clé = numéro de tour)
- Store `flottes` : résumé léger des flottes par tour (dernières flottes vues sur une case)
- Store `systemes` : résumé léger des systèmes par tour (dernier système vu sur une case)
- Permet l'analyse historique multi-tour

### LocalStorage
- `carte_*` : préférences de la carte (couches visibles, thème, présence/influence, zones, filtres, radars alliés…)
- `mapNotes` : annotations utilisateur sur la carte
- `deplacements_tour_*` : ordres de déplacement saisis sur la carte, par tour
- `recherche-technologique-tour-*` / `recherche-technologique-budget-tour-*` : allocation et budget de recherche par tour
- `planification_*` : files de construction et préférences de l'écran Planification
- `planification_show_en_cours` : prise en compte des constructions en cours dans l'écran Planification
- `planification_en_cours_annulees_tour_*` : constructions en cours retirées à la main (simulation d'annulation), par tour
- `planification_revenu_tour_*` : choix de l'écran Revenus, par tour
- `planification_revenu_capitale_tour_*` : nouvelle capitale choisie dans l'écran Revenus (ordre changer_capitale), par tour
- `transferts_tour_*` : ordres de transfert entre systèmes, par tour
- `transferts_colonne_gauche` / `transferts_colonne_droite` : systèmes affichés dans les colonnes de l'écran Transferts
- `sheril_detected_systems_v1` : systèmes saisis manuellement

## Commandes

```bash
npm start       # Serveur de dev sur localhost:3000
npm test        # Tests Jest
npm run build   # Build de production dans /build
```

## Qualité du code

**Le build doit passer sans erreur ni warning.** Après toute modification de code, lancer `CI=true npm run build` et corriger tout ce qui est signalé avant de considérer la tâche terminée. Le CI de déploiement traite les warnings ESLint comme des erreurs ; `CI=true` reproduit ce comportement.

- `npx tsc --noEmit` ne suffit pas : il ne vérifie pas les règles ESLint de react-scripts (`react-hooks/exhaustive-deps`, variables et imports inutilisés, etc.).
- Cas fréquent : une dépendance devenue inutile dans un `useMemo` / `useEffect` après un retrait de code, ou un import ou une variable orphelins.

## Contributions

Le projet reçoit beaucoup de contributions : chaque utilisateur doit pouvoir garder l'interface qu'il connaît.

- **Tout nouvel ajout est paramétrable et désactivé par défaut.** Une nouvelle fonctionnalité, couche, colonne, couleur, mise en évidence ou un changement de comportement d'une fonctionnalité existante passe par une option (case à cocher, menu…) que l'utilisateur active lui-même. Sans action de sa part, l'interface reste identique à avant l'ajout.
- **Les paramètres sont stockés dans la mémoire du navigateur (localStorage)**, comme les filtres de la carte : valeur lue à l'initialisation du `useState`, valeur par défaut « désactivé » si la clé est absente, écriture dans un `useEffect` à chaque changement. Exemple existant : `carte_show_fleet_badges` dans `Carte.tsx`.
- **Clés préfixées par l'écran** (`carte_*`, `planification_*`…) ; ajouter toute nouvelle clé à la liste de la section « LocalStorage » ci-dessus.
- **Option rangée avec les réglages existants de l'écran** (ex. le panneau Filtres de la carte), avec un libellé qui dit ce qu'elle change.

## Écrans principaux

| Écran | Fichier | Description |
|-------|---------|-------------|
| Carte galactique | `Carte.tsx` + `Map/` | Carte interactive canvas avec pan/zoom, zones, combats, historique |
| Planification | `Planification.tsx` | File de construction multi-systèmes avec calcul de coûts |
| Revenus | `PlanificationRevenu.tsx` | Simulation des revenus par système et génération des ordres |
| Recherche | `RechercheTechnologique.tsx` | Répartition du budget de recherche |
| Transferts | `Transferts.tsx` | Transferts entre systèmes (ordre charger_cargo) |
| Systèmes | `ListeSystemes.tsx` | Liste triable/filtrable des systèmes |
| Technologies | `ListeTechnologies.tsx` | Catalogue des technologies avec statut |
| Flottes | `ListeFlottes.tsx` | Liste des flottes joueur et détectées |
| Plans | `ListePlans.tsx` | Blueprints de vaisseaux |
| Créer un plan | `CreatePlan.tsx` | Concepteur visuel de vaisseaux |
| Arbre tech | `ArbreTechnologies.tsx` | Visualisation des prérequis |
| Détail système | `PlayerSystemDetail.tsx` | Vue détaillée d'un système |

### Carte
- **Couches** : systèmes, radars (propres, flottes, alliés), secteurs, zones dessinées, influence (couleur des systèmes du commandant), présence (pondérée par la force et la distance du jeu), combats, fond sombre ou clair.
- **Ordres de déplacement** : glisser-déposer d'une flotte depuis `FleetPicker` vers une case, ou bouton « → » de « Mes flottes » dans `InfoPanel`. Les ordres (cible, directive, stratégie de combat, précision n° planète/commandant) s'éditent dans le tiroir « Déplacements » en bas de la carte, qui copie le schéma d'ordres (`utils/ordreDeplacement.ts`). Flèche émeraude = cible à portée, rouge = hors de portée.
- **Échange entre alliés** : « Exporter systèmes » produit un texte (systèmes + radars) qu'un allié colle dans « Importer systèmes » (`storage/radarsAlliesStorage.ts`).

### Construction et revenus
- **Revenus** (`PlanificationRevenu.tsx`) : par système, taxation (système ou planète), politique, budgets (technologique, services spéciaux, contre-espionnage), terraformation et affectation des gouverneurs ; changement de capitale (panneau « Capitale », avec aide au choix — `utils/capitale.ts`). Recalcule stabilité, croissance de population (détail par race), revenu, revenu technologique et bénéfice, avec infobulles détaillées ; les valeurs différentes du rapport sont marquées. Génère le schéma d'ordres (types dans l'ordre de résolution du tour) et peut envoyer le budget tech vers l'écran Recherche. Règles : `docs/gouverneurs-politiques-stocks.md`, `docs/ordres-revenus.md`.
- **Construction** (`Planification.tsx`) : lit en lecture seule les choix de l'écran Revenus du même tour pour ajuster les PDC (politique, gouverneur, stock de robots — `utils/pdc.ts`). « Action multiple » (Alt+A) ajoute le maximum possible d'une construction dans chaque système, avec option pour se limiter aux systèmes ayant un chantier naval. Copie et import du schéma de construction. L'option « Constructions en cours » (bloc `<constructions>` du rapport XML) déduit de chaque système leurs PDC restants, puis le minerai et les marchandises de leur sortie — `docs/constructions-en-cours.md`.

### Transferts
- Deux colonnes côte à côte, chacune avec son système (et sa planète, facultative) : un objet (minerai, bâtiment, marchandise) se glisse d'une colonne vers l'autre, ou s'envoie avec ses boutons → / ←, pour créer un ordre `charger_cargo`. Chaque ligne affiche le stock du rapport, l'effet des transferts, le stock après transferts et la production du tour.
- La liste des ordres se réordonne (↑/↓) ; la limite de transferts par tour est matérialisée et les ordres au-delà sont marqués ignorés. Un bilan par système donne stock avant, transferts, après transferts, production et fin de tour. Règles : `docs/transferts.md`.

## Patterns et conventions

- **État global** via React Context (`ReportContext`) — pas de Redux
- **Rendu canvas** pour la carte (performances sur grille 60×60)
- **Raccourcis clavier** gérés via `useEffect` + `isTypingTarget()` pour éviter les conflits avec les champs de saisie
- **Gestion d'erreurs silencieuse** : les erreurs de parsing XML retournent des données vides, IndexedDB indisponible se rabat sur localStorage
- **Migration legacy** : ancien format `rapportXml` dans localStorage migré automatiquement vers IndexedDB
- **Données d'exemple** : `public/examples/` contient des fichiers XML de test pour le développement offline
- **Styles en feuille de style, pas inline** : un écran a sa feuille `src/screens/<Ecran>.css`, importée par le composant, avec des classes préfixées par le nom de l'écran (ex. `.transferts-table`) pour ne pas déborder sur les autres écrans. Pas de `style={{…}}` répété ligne par ligne : les variantes (état de glisser-déposer, couleur d'un ajout/retrait, statut d'un ordre) passent par des classes modificatrices (`depot`, `ajout`, `statut-erreur`…). L'inline reste réservé aux valeurs vraiment calculées (position, taille, couleur issue des données). Appliqué à l'écran Transferts ; les autres écrans gardent leur style inline tant qu'ils ne sont pas repris.

## Fichiers d'exemple

- `public/examples/rapport.xml` : exemple de rapport joueur (structure `rapport > commandant > …`).
- `public/examples/data.xml` : exemple de données globales (`data > …`).

## Documentation des connaissances

Toute connaissance apprise sur le jeu ou sur le format des fichiers (règles, formats XML, formules, correspondances de codes…) doit être consignée dans `docs/` (un fichier par thème, ex. `docs/lieutenants.md`), pas seulement dans la conversation. Mettre à jour la doc existante plutôt que d'en créer une en double.
