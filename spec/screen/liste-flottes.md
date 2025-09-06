# Liste des flottes

Afficher une liste paginée, triable et filtrable des flottes (joueur et détectées).

## Colonnes
- Position (X-Y)
- Nom
- Direction (flottes du joueur uniquement; utilisée pour tracer une flèche sur la carte depuis la position actuelle vers la destination)
- Directive
- Vitesse
- Force spatiale (AS)
- Force planétaire (AP)
- Nombre de vaisseaux
- Propriétaire (numéro du commandant)

## Tri
- Tri sur chaque colonne (par défaut: Nom).

## Filtres
- Nom: filtre texte insensible à la casse.
- Commandants: sélection multiple de propriétaires (conserver les flottes dont le propriétaire appartient à la sélection).
  - Si aucune valeur n'est sélectionnée, aucun filtrage par propriétaire n'est appliqué.

## Pagination
- Choix: 10, 20, 50 par page (défaut: 20) avec contrôles de navigation.
