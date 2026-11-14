# Ordres de la planification des revenus

Source : `sheril-old-java/php/ordres` (formulaires `fr/choix/*.txt`, affichage `fr/affiche/*.txt`), schéma SQL `divers/base_sheril.sql`, traitement Java `ReceptionOrdres.java`.

Chaque ordre est une ligne d'une table dont les colonnes (après `NUMERO`, le commandant) sont les paramètres `v0`, `v1`… dans l'ordre ci-dessous.

| Table d'ordre | Paramètres dans l'ordre des colonnes | Notes |
|---|---|---|
| `modifier_taxation_systeme` | `SYSTEME`, `TAXE` | taxation (0 à 5) de **toutes** les planètes du système |
| `modifier_taxation_planete` | `SYSTEME`, `TAXE`, `PLANETE` | attention : la taxe est avant la planète ; `PLANETE` est l'index à partir de 0 (affiché +1) |
| `modifier_politique` | `SYSTEME`, `POLITIQUE` | code de politique de `data.xml` (`<politiques>`) ; coûte 10 centaures par changement |
| `modifier_budget` | `SYSTEME`, `BUDGET`, `POURCENTAGE` | `BUDGET` : 0 = technologique, 1 = services spéciaux, 2 = contre-espionnage (`Const.DOMAINES_BUDGET_*`) |
| `affecter_gouverneur` | `NOM`, `POSITION` | `NOM` = nom du lieutenant ; `POSITION` = `0_x_y`, ou `0_0_0` pour « en réserve » |
| `terraformer_systeme` | `SYSTEME` | toutes les planètes du système ; une planète ne se terraforme qu'une fois par tour |
| `terraformer_planete` | `SYSTEME`, `PLANETE` | index à partir de 0 |
| `changer_capitale` | `SYSTEME` | coûte 100 centaures (`Const.COUT_CHANGER_CAPITALE`) ; un seul par tour ; le système doit appartenir au commandant |

`SYSTEME` s'écrit `0_x_y` (comme dans `rapport.xml`, attribut `pos`).

## Règles de traitement côté serveur

- Les budgets d'un même système sont regroupés puis appliqués ensemble : l'ordre des lignes `modifier_budget` n'a pas d'importance, mais le total final du système ne doit pas dépasser 100 % (sinon tout est annulé).
- L'ordre des affectations de gouverneurs n'est pas important ; un seul gouverneur par système, autant que l'on veut en réserve.
- `changer_capitale` est résolu avec les ordres (n° 11 de `Const.NOMS_TABLES_ORDRES`), avant l'évolution de stabilité de fin de tour : la nouvelle capitale compte dès ce tour.

## Changement de capitale

La distance (Tchebyshev sur le tore, `Position.distance`) entre la capitale et un système donne son modificateur de stabilité par tour : ligne `<evostab t="position">` du rapport, barème `<modificateur_stabilite>` de `data.xml` (moteur : `Const.MODIFICATEUR_STABILITE_CAPITALE`, calcul dans `Possession.getEvolutionStabilite`).

| Distance | 0 | 1-2 | 3-4 | 5 | 6 | 7 | 8-9 | 10 | 11+ ou pas de capitale |
|---|---|---|---|---|---|---|---|---|---|
| Modificateur | +3 | +2 | +1 | 0 | −1 | −3 | −6 | −9 | −16 |

Les seuils sont exclusifs : pour une distance `d > 0`, on prend le palier qui suit le dernier seuil strictement inférieur à `d` (`utils/capitale.ts`, vérifié sur les 12 systèmes de `sample/rapport.xml`).

Dans l'écran Revenus (panneau « Capitale ») :
- Tant que la capitale n'est pas changée, rien ne change : la ligne « position » du rapport est reprise telle quelle.
- Une nouvelle capitale remplace, pour chaque système, la ligne « position » par le modificateur recalculé (colonne de variation de stabilité, détail au survol).
- Aide au choix : chaque système du joueur est classé selon la somme des modificateurs « position » de tout l'empire s'il devenait la capitale (Σ, écart avec la capitale actuelle, nombre de systèmes en malus) ; la meilleure est proposée avec un bouton « Choisir ».
- La capitale du rapport n'est retenue que si elle fait partie des systèmes du joueur (sans capitale, le parseur renvoie 1_1 par défaut) ; sinon elle est considérée absente (−16 partout).
- Le coût de 100 centaures est affiché, pas déduit du bénéfice.
- Pas d'ajustement automatique de la taxation.

## Schéma de l'écran « Planification des Revenus »

Bouton « Copier le schéma des ordres ». Même principe que les schémas de construction et de recherche :

```
base64( UTF-8( ordre %#!% ordre %#!% … ) )      avec  ordre = table:param:param…
```

Exemple décodé :

```
modifier_taxation_systeme:0_10_9:3%#!%modifier_budget:0_10_9:0:70%#!%modifier_budget:0_10_9:1:5%#!%affecter_gouverneur:Berat:0_0_0
```

Seuls les écarts avec le rapport sont émis (comme la liste « Modifications »). Pas d'ordre « sans terraformation » : le rapport ne contient jamais de terraformation en cours.

### Import côté console de jeu

Traité dans `sheril-old-java/php/ordres` : `schema_revenus.php` (fonction `importerSchemaRevenus`). Le champ de saisie est sur la **page d'accueil des ordres**, sous « Bonne chance, Commandant ! » (`fr/depart.htm`), qui traite aussi l'envoi du formulaire (`tache=revenus`). `fonctions.txt` y est chargé en `include_once`, et `list_ordres.php` aussi, pour éviter une double déclaration des fonctions.

- Les ordres du schéma **s'ajoutent** aux ordres déjà passés : rien n'est supprimé (contrairement au schéma de recherche, qui remplace tout).
- Exception : `changer_capitale` (un seul par tour). Celui du schéma **remplace** l'ordre `changer_capitale` déjà passé, qui n'est retiré qu'une fois tout le schéma validé.
- Le schéma est validé en entier avant toute insertion : une erreur (table inconnue, nombre de paramètres, système, gouverneur, politique ou budget inconnus, taxe hors 0-5, pourcentage hors 0-100, plusieurs `changer_capitale` dans le même schéma) annule tout et indique l'ordre fautif.
- Coller deux fois le même schéma ajoute deux fois les ordres (sauf le changement de capitale, remplacé).
