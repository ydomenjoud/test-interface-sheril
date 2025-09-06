# Liste des systèmes

Afficher une liste paginée, triable et filtrable des systèmes (du joueur et détectés).

## Colonnes
- Image étoile (public/img/etoile{typeEtoile}.gif)
- Position (X-Y)
- Nom
- Nombre de planètes
- Commandants (liste des propriétaires connus)
- Politique
- Entretien
- Revenu
- Portée détection (hscan)
- Contre-espionnage (bcont)
- Espionnage (besp)
- Technologique (btech)
- Bâtiments: somme des bâtiments (tous types) sur l'ensemble des planètes du système (si données disponibles)

## Tri
- Tri sur chaque colonne (par défaut: Nom).

## Filtres
- Possédé: Tous, Possédés (par le joueur courant), Non possédés.
- Politique: liste des politiques présentes.
- Nom: filtre texte insensible à la casse.
- Commandants: sélection multiple (conserver les systèmes qui ont au moins un propriétaire dans la sélection).

## Pagination
- Choix: 10, 20, 50 par page (défaut: 20) avec contrôles de navigation.
