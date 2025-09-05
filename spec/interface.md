# Interface

Le but de cette interface est de proposer une visualisation des informations du joueur dans un univers de jeu 4x
spatial.

Elle permettra de charger un fichier XML qui contient les informations du joueur ainsi qu'un fichier global XML externe
qui contiendra
les informations globales de l'univers

## schéma global

l'interface se décompose en 2 parties toujours visibles

* une partie "header"
* une partie "centrale"

L'interface ne doit pas être scrollable, les éléments doivent prendre tout l'espace en hauteur et largeur

### HEADER

le header affichera les informations globales du joueur : Nom, race, réputation, statut, puissance, argent,
capitale, ... ainsi que la navigation entre les différentes parties de l'interface.
Cette partie fera 50px de hauteur et sera affiché en haut

### CENTRALE

la partie centrale permettra d'afficher les différents "écrans" décris dans le dossier "screens"
Cette partie fera tout le reste de l'écran.
