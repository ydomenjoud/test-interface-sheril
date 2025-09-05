# Les données du joueur

## global

les positions dans la grille sont stocké sous l'attribut "pos" des éléments XML.
La structure est la suivante : GALAXIE_POSY_POSX

Ainsi "0_4_6" , signifie que le joueur se trouve sur la position 4,6 de la galaxie 0.

## Fichier :

le fichier rapport.xml contenant les données joueur devra pouvoir être chargé dans le navigateur depuis le header de la
page.
lorsque le rapport n'est pas encore chargé, il faudra afficher un message au centre de la page invitant l'utilisateur à
charger son rapport.

Un exemple de fichier rapport.xml est disponible dans le dossier `public/examples/rapport.xml`

Il faut que le parsing du XML soit mappé dans une autre entité afin d'abstraire la structure du fichier xml de la
logique d'affichage.

Globalement, il faut que l'abstration du rapport soit partagée entre tous les composants du site grâce à un context
provider.

## les systèmes

Pour chaque système, il faudra afficher son nom, sa position, le nombre de planète et les commandants présents dessus.
dans le cas des système possédés, il faudra afficher dans les informations, les numéro des commandants présents sur ce
système ( présent dans SYSTEM>PROPRIO)

### les systèmes du joueur

les systèmes du joueurs sont décris dans le rapport.xml au path suivant : Rapport>Commandant>systemes

Chaque élément "S" représente le système.

```xml

<S bcont="0" besp="0" btech="0" entretien="205.0" hscan="0" nom="Pavbzyb" nombrePla="17" pdc="36" politique="3"
   pos="0_1_2" revenu="340.80002" typeEtoile="8">
    <EVOSTAB t="gouverneur" v="1"/>
    <EVOSTAB t="position" v="1"/>
    <EVOSTAB t="taxation" v="1"/>
    <PLANETES>
        ...
    </PLANETES>
</S>
```

Chaque système est composée de plusieurs planète et d'un ou plusieurs poste commercial ( un par joueur présent sur le
système )
les informations des planètes sont présentes dans le noeud xml du système : Rapport>Commandant>systemes>S>PLANETES

```xml

<P atm="4" grav="15" num="7" pdc="1" prod="6" prop="1" rad="40" revenumin="0" revolt="0" stab="100" stockmin="8" tai="2"
   tax="2" temp="64" terra="0" type="25">
```

### les systèmes détectés appartenant aux autres joueurs

les systèmes des autres joueurs sont décrites dans le rapport.xml au path suivant : Rapport>Commandant>detection>SYSTEME

```xml

<SYSTEME nbPla="18" nom="Pyj" pop="29131" popMax="59485" pos="0_6_2" typeEtoile="8">
    <PROPRIO>14</PROPRIO>
</SYSTEME>
```
les numéro des commandants présents sur ce  système ( présent dans SYSTEM>PROPRIO)

## les flottes

### les flottes du joueur
les flottes du joueurs sont décrites dans le rapport.xml au path suivant : Rapport>Commandant>flottes

```xml

<F AP="519" AS="936" direction="" directive="2" directive_precision="0" hscan="0" nom="Flotte de départ" num="0"
   pos="0_4_6" vitesse="9">
    <VAISSEAU exp="158" moral="4500" plan="Intercepteur standard" race="1" type="Intercepteur standard"/>
    ...
</F>
```

### les flottes détectés appartenant autres joueurs

les flottes des autres joueurs sont décrites dans le rapport.xml au path suivant : Rapport>Commandant>detection>Flotte

```xml

<FLOTTE nbVso="36" nom="BimZor 2" num="4" pos="0_7_39" proprio="3" puiss="grande"/>
```
