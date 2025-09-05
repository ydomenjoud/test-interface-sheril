# Les données du joueur

## global
les positions dans la grille sont stocké sous l'attribut "pos" des éléments XML. 
La structure est la suivante : GALAXIE_POSY_POSX

Ainsi "0_4_6" , signifie que le joueur se trouve sur la position 4,6 de la galaxie 0.

## les systèmes
les systèmes du joueurs sont décris dans le rapport.xml au path suivant : Rapport>Commandant>systemes

Chaque élément "S" représente le système.
```xml
<S bcont="0" besp="0" btech="0" entretien="205.0" hscan="0" nom="Pavbzyb" nombrePla="17" pdc="36" politique="3" pos="0_1_2" revenu="340.80002" typeEtoile="8">
    <EVOSTAB t="gouverneur" v="1"/>
    <EVOSTAB t="position" v="1"/>
    <EVOSTAB t="taxation" v="1"/>
    <PLANETES>
        ...
    </PLANETES>
</S>
```

Chaque système est composée de plusieurs planète et d'un ou plusieurs poste commercial ( un par joueur présent sur le système )
les informations des planètes sont présentes dans le noeud xml du système : Rapport>Commandant>systemes>S>PLANETES

```xml
<P atm="4" grav="15" num="7" pdc="1" prod="6" prop="1" rad="40" revenumin="0" revolt="0" stab="100" stockmin="8" tai="2" tax="2" temp="64" terra="0" type="25">
```

## les flottes
les flottes du joueurs sont décrites dans le rapport.xml au path suivant : Rapport>Commandant>flottes
```xml
<F AP="519" AS="936" direction="" directive="2" directive_precision="0" hscan="0" nom="Flotte de départ" num="0" pos="0_4_6" vitesse="9">
    <VAISSEAU exp="158" moral="4500" plan="Intercepteur standard" race="1" type="Intercepteur standard"/>
    ...
</F>
```

## les systèmes détectés des autres joueurs
les systèmes des autres joueurs sont décrites dans le rapport.xml au path suivant : Rapport>Commandant>detection>SYSTEME
```xml
<SYSTEME nbPla="18" nom="Pyj" pop="29131" popMax="59485" pos="0_6_2" typeEtoile="8">
    <PROPRIO>14</PROPRIO>
</SYSTEME>
```


## les flottes détectés des autres joueurs
les flottes des autres joueurs sont décrites dans le rapport.xml au path suivant : Rapport>Commandant>detection>Flotte
```xml
<FLOTTE nbVso="36" nom="BimZor 2" num="4" pos="0_7_39" proprio="3" puiss="grande"/>
```
