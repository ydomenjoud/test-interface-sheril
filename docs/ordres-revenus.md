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

`SYSTEME` s'écrit `0_x_y` (comme dans `rapport.xml`, attribut `pos`).

## Règles de traitement côté serveur

- Les budgets d'un même système sont regroupés puis appliqués ensemble : l'ordre des lignes `modifier_budget` n'a pas d'importance, mais le total final du système ne doit pas dépasser 100 % (sinon tout est annulé).
- L'ordre des affectations de gouverneurs n'est pas important ; un seul gouverneur par système, autant que l'on veut en réserve.

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
- Le schéma est validé en entier avant toute insertion : une erreur (table inconnue, nombre de paramètres, système, gouverneur, politique ou budget inconnus, taxe hors 0-5, pourcentage hors 0-100) annule tout et indique l'ordre fautif.
- Coller deux fois le même schéma ajoute deux fois les ordres.
