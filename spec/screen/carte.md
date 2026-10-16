# Carte

La carte est un des écrans les plus complexe. il permettra d'afficher les informations de la carte : systèmes, flottes,
portée de détection

## composition

La carte est décomposée en 2 partie :

* la carte principale qui affichera une carte cadrillée avec le placement de "points" et de "zones"
* la partie "information" contiendra des informations sur la sélection actuelle

### carte principale

#### affichage

la carte est quadrillée comme une grille, avec en entête de colonne le numéro de la colonne et en entête de ligne le
numéro de la ligne.
les coordonnées de la grille se font sur la colonne et la ligne, pas sur l'intersection des droites qui la composent.
Ces entêtes (lignes et colonnes) devront toujours être visibles.
la carte est représentée par un canvas. Par défaut elle est centrée sur la capitale du joueur.
la carte est de fond noir avec le quadrillage en gris clair.
Toutes les 5 colonnes/lignes, la séparation doit être rouge foncé.
Toutes les 20 colonnes/lignes, la séparation doit être bleu foncé.
dans le système de positionnement global : la première coordonnée (X) représente l'axe vertical et la deuxième
coordonnée (Y) représente l'axe horizontal.
les coordonnées commencent en haut à gauche en 1-1

La taille des cases de la grille de la carte doit pouvoir être modifiée par l'utilisateur dans une partie "
configuration".
Elle sont forcément carrée.

Les bornes actuelles de la carte sont : 0 > X > 40 et 0 > Y > 40. Ces données doivent être centralisées pour être
modifiable par la suite.

La carte représente un univers "torique" en forme de donuts. Il faut donc que lorsque la carte n'a rien à afficher d'un
côté, que l'on complete l'affichage avec les données de l'autre côté.

Exemple :

si la borne max Y est 40 : les coordonnées représentée vont de 33 à 12 en passant par la borne max Y : 40.

| 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|----|----|----|----|----|----|----|----|---|---|---|---|---|---|---|---|---|----|----|----|

si la borne max X est 40 : les coordonnées représentée vont de 33 à 12 en passant par la borne max X : 40.

|    |
|----|
| 33 |
| 34 |
| 35 |
| 36 |
| 37 |
| 38 |
| 39 |
| 40 |
| 1  |
| 2  |
| 3  |
| 4  |

La carte occupe toute la hauteur disponible (pas de scroll vertical de la page), la grille se redimensionne en
conséquence.

Une légende compacte des couleurs de possession (moi / alliance / PNA / ennemi / neutre / flotte) est affichée en
bas à gauche de la carte, en mode de couleur "Alliés/Ennemis".

Les portées radar (systèmes et flottes) sont désactivées par défaut pour ne pas voiler la carte ; elles peuvent
être activées dans les Filtres.

#### interaction

- Clic: lorsqu'on clique sur une position de la carte, la carte affiche les informations de la position cliquée dans la
  partie "information".
- Survol (sans clic) : la case sous le curseur est surlignée et un encart récapitulatif s'affiche à proximité du
  curseur (coordonnées, nom du système, possesseurs, nombre de flottes).
- Clavier: flèches directionnelles (gauche, droite, haut, bas) déplacent le centre d'une case; avec Ctrl, déplacement
  par pas de 5 cases.
- Drag souris: en maintenant le bouton gauche, on peut "panner" la carte; le centre se décale au rythme d'un pas de
  case dès qu'un multiple de la taille de case est parcouru, puis s'arrête au relâchement.
- Mini-carte:
  - La mini-carte représente l'univers complet et est toujours centrée sur le centre courant de la carte principale.
  - Un rectangle (bleu clair) y affiche le viewport courant (zones visibles de la carte principale); gestion du wrap
    torique lorsque le viewport chevauche un bord.
  - Un clic sur la mini-carte recadre la carte principale autour du point visé (par offset relatif au centre).
  - Un bouton "Minimap" dans la barre d'outils (et une case à cocher dans les Filtres) permet de l'afficher/masquer ;
    elle est affichée par défaut.
- Header: un bouton "Capitale" recentre la carte principale sur la capitale du joueur.

### données à afficher

les points à afficher sur la grille sont :

* tous les systèmes du joueur et systèmes détectés des autres joueurs
* toutes les flottes du joueur et flottes détectées des autres joueurs

l'affichage de ces points va dépendre de leur caractéristiques.

#### système

L'image du système prend toute la case de la grille.

il faut utiliser une image correspondante à sa propriété "typeEtoile" et utiliser l'image
public/img/etoile{typeEtoile}.gif (images pack étoiles).
Si le système est :

* complètement possédé par le joueur courant, il faut lui faire une bordure verte.
* possédé par un autre joueur avec lequel on partage une alliance : bordure bleue.
* possédé par un autre joueur avec lequel on partage Pacte de Non Agression (PNA) et pas d'alliance : bordure jaune.
* possédé par un autre joueur qui ne rentre pas dans les autres cas : bordure rouge.
* sans propriétaire connu: bordure grise.

#### flotte

l'image de la flotte s'affiche en haut à droite de la case de la grille, elle est donc plus petite que la case.

il faut utiliser une image de vaisseau : public/img/flotte.png.
Si la flotte est :

* complètement possédée par le joueur courant: bordure verte.
* alliance: bordure bleue.
* PNA: bordure jaune.
* autre: bordure rouge.

Pour les flottes du joueur uniquement: si l'attribut "direction" est défini (format "galaxie_Y_X"), afficher une flèche
orange allant du centre de la case actuelle vers le centre de la case cible (visible), en tenant compte du viewport.

### partie information

Lorsqu'on clique sur une case, la partie information affiche d'abord un récapitulatif de la case en tête de
panneau : il permet de voir l'essentiel en un coup d'œil.

- coordonnées (+ tour d'où viennent les données, et avertissement si les données sont d'un tour précédent)
- récapitulatif :
  - nom du système, liste des propriétaires (numéro de commandant), nombre de planètes, population
  - si le système est possédé par le joueur : lien "détails" vers l'écran de détail du système (planètes, bâtiments,
    populations, minerai, points de construction)
  - nombre de flottes sur la case et total de vaisseaux

Le reste des informations est organisé en sections, chacune n'étant affichée que s'il y a du contenu sur la case ;
une case sans aucun contenu (ni système, ni flotte, ni combat, ni zone) affiche simplement "Case vide.".

- liste des flottes de la case (et dernières flottes observées si la case n'a pas été vue au tour affiché)
  - propriétaire
  - nombre de vaisseaux
  - puissance
- mes flottes : les flottes du joueur situées sur la case, puis les plus proches atteignables ce tour ; la liste
  complète (tri par nom ou distance, position) s'affiche sur demande
- combats sur la case (cartes dépliables avec les détails)
- zones couvrant la case (éditables)
- notes de la case (le formulaire d'ajout est replié derrière un bouton)
