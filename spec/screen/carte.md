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

Les bornes de la carte sont centralisées dans `src/utils/position.ts` (`BOUNDS`, coordonnées 1-based : 1..maxX /
 1..maxY). Le jeu ne donne nulle part la taille de la galaxie : les bornes sont donc recalculées au chargement d'un
 rapport à partir du maximum des coordonnées observées (systèmes, systèmes détectés, flottes, capitale), chaque axe
 arrondi à la dizaine supérieure (47→50, 53→60, 60→60 ; ex. un rapport 40×40 donne une galaxie 40×40). En l'absence de
 rapport, les systèmes publics de data.xml servent de base ; la valeur par défaut avant tout chargement est 60×60.
 Les couches issues de l'extérieur du rapport (systèmes publics de data.xml, combats publics) ne sont affichées que si
 leurs coordonnées rentrent dans le tore affiché : sinon elles proviendraient d'une autre galaxie et seraient dessinées
 enroulées sur une mauvaise case.

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

Une légende compacte (couleurs de possession moi / alliance / PNA / ennemi / neutre, marqueur flotte, et
« réparation » = bordure blanche du disque) est affichée en bas à gauche de la carte, au ras du bord, en mode
de couleur "Par diplo".

Les portées radar (systèmes et flottes) sont désactivées par défaut pour ne pas voiler la carte ; elles peuvent
être activées par les boutons ◎ et ◉ de la barre d'outils (filtres rapides).

#### barre d'outils

La barre d'outils (en haut de l'écran) est regroupée : vue (taille des cases, position), filtres rapides,
historique (tours) et actions (import).

Le groupe de filtres rapides est une barre d'icônes discrète (raccourcis en doublon des cases à cocher du
panneau "Filtres", qui garde la même liste complète) :

* ✦ : afficher / masquer les systèmes
* ◎ : portée radar des systèmes (désactivée par défaut)
* ◉ : portée radar des flottes (désactivée par défaut)
* ▣ : afficher / masquer la mini-carte (affichée par défaut)
* ⇢ : ouvre / replie le tiroir des déplacements de flottes (avec leur nombre en attente)
* ⚙ : ouvre / ferme le panneau "Filtres" (options avancées, fermé par défaut ; le panneau n'est monté que
  lorsqu'il est ouvert, sans onglet permanent sur la carte) : Commandants, Tags, Afficher
  systèmes, Carte galactique, Secteurs, Influence (+ opacité), Minimap, Mode de couleur, Badges (combats /
  propriétaires / flottes), Zones manuelles, Portées Radar (systèmes / flottes), Distance Capitale (zones de
  stabilité et choix du système de référence)
* ? : aide et raccourcis (touche `?`)

#### interaction

- Clic: lorsqu'on clique sur une position de la carte, la carte affiche les informations de la position cliquée dans la
  partie "information".
- Survol (sans clic) : la case sous le curseur est surlignée et un encart récapitulatif s'affiche à proximité du
  curseur (coordonnées, nom du système, possesseurs — chaque nom affiché à sa couleur de race, le neutre affiché
  "Neutre (0)" —, nombre de flottes).
- Le même récapitulatif s'ancre sur la case sélectionnée (cadre jaune) quand on la déplace avec Maj + flèches ou
  quand on la sélectionne au clic : au-dessus du cadre, en dessous s'il n'y a pas de place ; il suit la case
  pendant le pan et disparaît si la case sort de la zone visible.
- Clavier: flèches directionnelles (gauche, droite, haut, bas) déplacent le centre d'une case; avec Ctrl, déplacement
  par pas de 5 cases. Maj + flèches déplace la case sélectionnée (cadre jaune) d'une case, avec Ctrl : pas de 5 cases.
- Drag souris: en maintenant le bouton gauche, on peut "panner" la carte; le centre se décale au rythme d'un pas de
  case dès qu'un multiple de la taille de case est parcouru, puis s'arrête au relâchement.
- Mini-carte:
  - La mini-carte représente l'univers complet et est toujours centrée sur le centre courant de la carte principale.
  - Un rectangle (bleu clair) y affiche le viewport courant (zones visibles de la carte principale); gestion du wrap
    torique lorsque le viewport chevauche un bord.
  - Un clic sur la mini-carte recadre la carte principale autour du point visé (par offset relatif au centre).
  - L'icône ▣ dans les filtres rapides de la barre d'outils (et une case à cocher dans les Filtres) permet de
    l'afficher/masquer ; elle est affichée par défaut.
- Header: un bouton "Capitale" recentre la carte principale sur la capitale du joueur.
- Panneau d'informations : repliable via un bouton dédié dans la barre d'outils, le raccourci Alt + I ou le bouton de fermeture dans l'en-tête, offrant une vue pleine largeur à la carte (colonne à 0 px ; le ré-ouvre depuis la barre d'outils ou Alt + I, pas de bouton en double sur la carte). L'intérieur est organisé en onglets rapides (Tout / Système / Flottes / Tactique) avec badges de comptage évitant le défilement vertical infini.

### données à afficher

les points à afficher sur la grille sont :

* tous les systèmes du joueur et systèmes détectés des autres joueurs
* toutes les flottes du joueur et flottes détectées des autres joueurs

l'affichage de ces points va dépendre de leur caractéristiques.

#### système

L'image du système prend toute la case de la grille.

La taille du disque varie avec le nombre de planètes (10 planètes : 50 % de la case, 20 planètes et plus :
100 %, linéaire entre les deux) ; les systèmes connus uniquement de la carte galactique (jamais détectés)
s'affichent à moitié taille.

Un système dont la capacité de réparation par tour est > 0 (somme des caractéristiques « capacité réparation
vaisseaux » des bâtiments de ses planètes) reçoit une bordure blanche épaisse autour de son disque, pour le
repérer d'un coup d'œil (entrée « réparation » de la légende).

il faut utiliser une image correspondante à sa propriété "typeEtoile" et utiliser l'image
public/img/etoile{typeEtoile}.gif (images pack étoiles).
Si le système est :

* complètement possédé par le joueur courant, il faut lui faire une bordure verte.
* possédé par un autre joueur avec lequel on partage une alliance : bordure bleue.
* possédé par un autre joueur avec lequel on partage Pacte de Non Agression (PNA) et pas d'alliance : bordure jaune.
* possédé par un autre joueur qui ne rentre pas dans les autres cas : bordure rouge.
* sans propriétaire connu: bordure grise.

Trois modes de couleur existent (boutons "Par diplo" / "par race" / "par joueur", mode par défaut "Par diplo") :

* Par diplo : les règles ci-dessus ; un système à plusieurs propriétaires de couleurs différentes est partagé
  en parts.
* par race : chaque système est coloré à la couleur de la race de son propriétaire (le même code couleur que les
  noms de joueurs) ; les systèmes du joueur courant restent verts. La mini-carte et les flottes suivent le même mode.
* par joueur : même logique qu'Par diplo, mais toujours basé sur le joueur courant (pas de bascule dynamique).

#### flotte

une flotte s'affiche par un disque blanc au centre de la case de la grille, cerclé de la couleur de possession.

Si la flotte est :

* possédée par le joueur courant: cerclage vert.
* alliance: cerclage bleu.
* PNA: cerclage jaune.
* autre: cerclage rouge.

Plusieurs flottes sur la même case n'affichent qu'un seul marqueur : l'étiquette au centre du disque indique le
nombre total de flottes sur la case (toujours un nombre, pour rester lisible d'un coup d'œil).

Pour les flottes du joueur uniquement: si l'attribut "direction" est défini (format "galaxie_Y_X"), afficher une
flèche orange allant du centre de la case actuelle vers le centre de la case cible (visible), en tenant compte du
viewport.

### partie information

Lorsqu'on clique sur une case, la partie information affiche d'abord un récapitulatif de la case en tête de
panneau : il permet de voir l'essentiel en un coup d'œil.

- coordonnées (+ tour d'où viennent les données, et avertissement si les données sont d'un tour précédent)
- récapitulatif du système (affiché uniquement s'il y a un système sur la case) :
  - nom du système, liste des propriétaires (numéro de commandant), nombre de planètes, population
  - capacité de réparation par tour (sommée sur les bâtiments des planètes : caractéristique « capacité
    réparation vaisseaux » de data.xml — p. ex. chantier naval +20, centre de réparation spatial I +100, II +400,
    III +1350, IV +3200, V +6250) ; affichée uniquement si le système a des planètes connues
  - si le système est possédé par le joueur : lien "détails" vers l'écran de détail du système (planètes, bâtiments,
    populations, minerai, points de construction)
  - si le système n'est plus dans les données du tour affiché (vu dans un tour précédent) : les dernières
    informations connues — le tour le plus récent stocké où il a été détecté — sont affichées, avec
    "information tour X" en tête de panneau et l'avertissement ⚠ de données obsolètes

Le reste des informations est organisé en sections, chacune n'étant affichée que s'il y a du contenu sur la case ;
une case sans aucun contenu (ni système, ni flotte, ni combat, ni zone) affiche simplement "Case vide.".

- liste des flottes de la case (et dernières flottes observées si la case n'a pas été vue au tour affiché)
  - propriétaire
  - nombre de vaisseaux
  - puissance
- mes flottes : une seule liste de toutes les flottes du joueur, avec des colonnes triables (Nom, Distance,
  Vitesse, AS, AP) et la Position ; les flottes hors de portée ce tour sont en orange estompé (légende sous la
  liste) ; un bouton « → » par ligne déplace la flotte vers la case sélectionnée (création/remplacement du
  déplacement, comme un dépos ; désactivé si la flotte est déjà sur la case) — c'est l'alternative clavier au
  glisser-déposer ; survoler une ligne affiche le détail de la flotte (position, direction, vitesse, directive,
  AS / AP, scan, nombre et composition des vaisseaux, distance et portée) ET surligne la case de la flotte sur
  la carte (mêmes équerres blanches débordantes que la case sélectionnée, par-dessus les flèches)
- combats sur la case (cartes dépliables avec les détails)
- zones couvrant la case (éditables)
- notes de la case (le formulaire d'ajout est replié derrière un bouton)

## déplacements de flottes (schéma d'ordres)

La carte permet de préparer des ordres de déplacement de ses flottes par glisser-déposer : le résultat est un
schéma d'ordres copiable dans la console d'ordres (comme le fait l'écran Planification des Revenus pour ses ordres).

### geste

- Un mousedown sur une case occupée par au moins une flotte du joueur ouvre le sélecteur de flotte (« Déplacer une
  flotte »), ancré sur le point de clic : pour une seule flotte, le panneau est plus étroit avec un en-tête compact ;
  pour plusieurs flottes, il liste les flottes de la case avec badges de vitesse et de composition
  (« déjà déplacée → 0_x_y »). La fenêtre est déplaçable en saisissant sa poignée d'en-tête (pour ne pas masquer
  d'informations importantes) ; le bouton × et le drag des lignes ne sont pas affectés.
- Un simple clic reste une sélection de case (le sélecteur se referme au mousedown suivant) ; le pan et les zones
  Alt + clic + glisser sont inchangés — un pan qui démarre sur la case annule le sélecteur, et Alt + clic n'ouvre
  jamais le sélecteur (Alt est réservé aux zones).
- Glisser une ligne du sélecteur vers la carte et relâcher sur une case crée (ou remplace : un seul déplacement par
  flotte) le déplacement de cette flotte vers la case visée. Relâcher sur la case d'origine de la flotte annule le
  déplacement. Un dépos hors de la portée de la flotte est autorisé (le déplacement reste marqué « hors portée »).
  Une flotte déjà en route (attribut « direction » dans le rapport) peut être redirigée ; elle est signalée ⚠.
- Le sélecteur reste ouvert pendant le glisser (il se referme à la fin du drag, au dépos ou à la touche Échap) : la
  ligne de la flotte glissée est surlignée d'un voile clair pour repérer celle qui est déplacée, et l'image de drag
  par défaut du navigateur (tile translucide) est remplacée par un pixel transparent.
- Le sélecteur doit rester monté pendant tout le drag : le démonter dans le dragstart ferait annuler le drag par le
  navigateur (source retirée du DOM avant le début effectif du drag).

### feedback pendant le glisser

- Une ligne relie la case d'origine de la flotte à la case sous le curseur, avec une pointe de flèche à l'extrémité
(curseur), la distance torique affichée au milieu du trait (décalée perpendiculairement, pour ne jamais passer
   sous le curseur) et un contour de portée — un carré de Tchebychev de rayon égal à la vitesse de la flotte —
   centré sur l'origine.
- La ligne est verte (#4caf50) si la destination est atteignable (distance ≤ vitesse), rouge (#f44336) sinon.
- Le tracé disparaît quand le glisser quitte la carte (l'identité de la flotte est conservée pour le restaurer au
  retour sur la carte) et à la fin du drag (dépos ou annulation, y compris un Échap).

### après le dépos

- La flotte apparaît « modifiée par rapport au rapport » : anneau ambre (#ff9800) et flèche vers sa nouvelle
  destination (qui remplace la direction du rapport, rappelée ⚠ « déjà en route vers x_y » dans le panneau quand
  le rapport en avait une).
- En vue normale, la flèche d'ordre de déplacement reste au-dessus des marqueurs de flottes, des combats
  et du cadre de sélection. En **focus flottes**, exception explicite : systèmes, combats, remplissages de
  sélection et TOUTES les routes persistantes (rapport, portée, ordres) sont dessinés avant le passage
  global des emblèmes de flottes, sur fond opaque. Le survol et le glisser actif restent au-dessus.
- Les directions du rapport et les ordres utilisent le même delta court torique, pour toutes les copies
  visibles du tore. Aucun tracé de direction d'une case ne repeint les marqueurs d'une autre case.
- Couleur de la flèche : verte (#4caf50) si la destination est à portée de la flotte ce tour, rouge (#f44336) sinon.
  L'orange (#ff9800) est réservé aux flèches de « direction » préexistantes du rapport.

### panneau « Déplacements »

- Un tiroir de commandes tactique repliable au bas de la zone de carte (centré horizontalement sur le canvas,
  au-dessus de la légende ; sous 1200 px de largeur, il s'étend sur toute la largeur et remonte de 34 px, devant
  la mini-carte) : toujours visible, en-tête cliquable « Déplacements (n) » (▴/▾), replié en onglet compact de
  38 px / déplié en tiroir de commandes s'élevant vers le haut (un déplacement par ligne) ; une icône ⇢ dans la
  barre d'outils pilote le même état. Le panneau se déplie tout seul au premier dépos.
- Déplié, chaque déplacement tient sur UNE ligne : nom de la flotte puis son numéro « Nom (#n) » (ou « Flotte #n » si
  la flotte n'est plus dans le rapport, tronqué avec ellipsis si trop long), origine → destination où chaque case
  s'affiche au NOM du système qui l'occupe quand il y en a un (coordonnées au survol), sinon en coordonnées x_y ;
  suivi de la distance torique en rouge quand elle est hors de portée (à distance normale sinon), un ⚠ ambre compact (infobulle « déjà en
  route vers x_y ») si le rapport avait une direction, un menu de directive (sans libellé, évident en
  contexte) pour choisir la directive de l'ordre — et, si la directive en porte un, un menu de paramètre
  n° (numéro de planète, ou commandant visé pour « Attaque flottes cdt ») — et un bouton × pour supprimer
  ce déplacement. Le menu de stratégie n'existe pas encore (valeurs du jeu pas encore paramétrées, valeur
  par défaut conservée).
- Le menu de directive est alimenté par les directives de rencontre de la règle 4.4
  (https://sheril.pbem-france.net/rule/4_flottes#4.4) avec leurs codes réels du jeu (côté serveur :
  Const/Messages), dans l'ordre de résolution du jeu, avec des libellés abrégés (suppression des « de » ;
  libellé complet en infobulle) : Attaque flottes cdt, Attaque préventive, Attaque toute flotte,
  Attaque système, Pillage système, Attaque planète, Pillage planète, Eradication planète, Attitude
  neutre (passive).
  Les directives « … planète n° » (attaque/pillage/éradication) ouvrent un second menu du numéro de
  planète visée (0-19). La directive « Attaque flottes cdt » ouvre un
  second menu de commandant visé (0 = neutre, puis les commandants de data.xml ; nom en infobulle).
- Vide : mention d'aide (cliquer une case de flotte, glisser une ligne sur la destination).
- En pied : « Copier le schéma » (retour visuel « Schéma copié » / « Échec de la copie ») et
  « ↺ Tout réinitialiser » (efface tous les déplacements du tour et replie le panneau ; les deux boutons sont
  estompés et désactivés quand il n'y a plus de déplacement).

### schéma d'ordres

- Schéma = ordres `[num, 0_x_y, directive, stratégie]` (numéro de flotte, destination, directive, stratégie),
  sans nom de table (même principe que le blueprint de la planification de construction : l'import côté
  console sait quelle table il alimente — la table du jeu est `deplacer_flotte`), séparés par `%#!%`,
  encodés en base64, triés par numéro de flotte. `num` est le numéro interne de la flotte dans le rapport
  (0-based — l'interface l'affiche en « #num+1 »). La directive est le code du jeu + 100 × paramètre :
  le numéro de planète pour les directives « … planète n° », le commandant visé (0 = neutre) pour
  « Attaque flottes cdt » — ex. 308 = attaque des flottes du commandant 3 (8 + 100×3),
  705 = attaque de la planète 7 (5 + 100×7).
- La directive et la stratégie sont propres à chaque ordre : par défaut « Attaque système » et aucune
  stratégie au dépos. La directive (et son paramètre n°) est modifiable dans le panneau ; la stratégie garde
  sa valeur par défaut (pas de menu, valeurs du jeu à confirmer).
- La syntaxe est la syntaxe réelle du jeu (table `deplacer_flotte`, codes de `Const`/`Messages` du serveur) ;
  le point encore provisoire : les valeurs de stratégie (table `z_strategies`, voir
  `src/utils/ordreDeplacement.ts`).

### persistance

- Les déplacements en attente sont stockés par tour dans le localStorage, clé `deplacements_tour_<tour>` ; un
  changement de tour recharge ceux du tour affiché.
- Le chargement d'un nouveau rapport efface les déplacements de tous les tours (à refaire sur le nouveau rapport).
