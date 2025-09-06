# Liste des technologies

Afficher une liste détaillée et recherchable des technologies de l'univers sous forme de tableau, avec pagination,
tri et filtres.

## Colonnes
- Connu (oui/non)
- Type (Bâtiment ou Composant)
- Nom: afficher le nom suivi du niveau en chiffres romains, calculé à partir de `niv` (0-based) + 1 et borné à X.
  - Exemple: niv=0 => "I", niv=4 => "V", max "X".
- Recherche (coût)
- Description: rendu HTML (innerHTML) car le contenu est du HTML sécurisé.
- Caractéristiques: liste sous forme de badges "Nom: valeur"
  - Le nom de la caractéristique provient de:
    - `CARACTERISTIQUES_BATIMENT` pour les technologies de type Bâtiment (0)
    - `CARACTERISTIQUES_COMPOSANT` pour les technologies de type Composant (1)
- Parents: afficher le nom (avec niveau romain) des technologies parentes au lieu de leur code, chaque parent est
  cliquable et ajoute un filtre pour ne montrer que cette technologie (des badges filtrants sont visibles et supprimables).

## Tri
- Tri possible sur chaque colonne du tableau (par défaut: Nom).

## Filtres
- Connu: Tous, Connues, Inconnues.
- Type: Tous, Bâtiment, Composant.
- Nom/code: filtre texte insensible à la casse (porte sur nom et code).
- Parents: cliquer sur un parent ajoute un filtre par parent (accumulable), avec badges de filtres affichés.

## Pagination
- Choix du nombre d'éléments par page: 10, 20, 50 (valeur par défaut: 20).
- Navigation page précédente/suivante et début/fin.
