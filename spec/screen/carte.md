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

#### interaction

lorsque l'utilisateur clique sur une position de la carte, la carte doit afficher les informations de la position
cliquée dans la partie "information".

lorsque l'utilisateur appuis sur une flêche directionnelle ( gauche, droite, haut, bas ), l'affichage de la carte doit
se recalculer et afficher la carte avec le centre décallé de 1 par rapport au précédent centre.
Par exemple si la carte était centrée sur la position "20-40", et que l'utilisateur appuis sur la flêche du haut, la
carte doit se recalculer pour être centrée sur la position "19-40"

Si l'utilisateur appuis sur la touche control en plus de la fleche directionnel, le décallage doit se faire par tranche
de 5.

la partie interraction est divisée en 3 partie :
* à gauche : une mini carte carrée, représentant toute la carte. lorsqu'on clique sur un endroit de cette mini carte, la carte
principale doit se centrer sur le point visé sur la mini carte
* au centre: la partie détail des informations, c'est la plus grande.
* à droite: une liste des actions possibles quand on a sélectionné un élément affiché dans la partie "centre" de l'information.


## données à afficher

les points à afficher sur la grille sont :

* tous les systèmes du joueur et systèmes détectés des autres joueurs
* toutes les flottes du joueur et flottes détectées des autres joueurs

l'affichage de ces points va dépendre de leur caractéristiques.

### système

L'image du système prend toute la case de la grille.

il faudra utiliser une image correspondante à sa propriété "typeEtoile" et utiliser l'image
public/img/etoile{typeEtoile}.png .
Si le système est :

* complètement possédé par le joueur courant, il faut lui faire une bordure verte.
* est possédé par un autre joueur avec lequel on partage une alliance : il faut lui faire une bordure bleu.
* possédé par un autre joueur avec lequel on partage Pacte de Non Agression (PNA) et pas d'alliance : il faut lui faire
  une bordure jaune.
* possédé par un autre joueur qui ne rentre pas dans les autre cas : il faut lui faire une bordure rouge.

### flotte

l'image de la flotte s'affiche en haut à droite de la case de la grille, elle doit donc être affichée en plus petit.

il faudra utiliser une image de vaisseau : public/img/flotte.png .
Si la flotte est :

* complètement possédé par le joueur courant, il faut lui faire une bordure verte.
* est possédé par un autre joueur avec lequel on partage une alliance : il faut lui faire une bordure bleu.
* possédé par un autre joueur avec lequel on partage Pacte de Non Agression (PNA) et pas d'alliance : il faut lui faire
  une bordure jaune.
* possédé par un autre joueur qui ne rentre pas dans les autre cas : il faut lui faire une bordure rouge.

## interaction

Lorsqu'on clique sur une case qui n'est pas vide, la partie information de la page doit se remplir avec les informations
de la case :

* coordonnées
* détail système
* liste des flottes
