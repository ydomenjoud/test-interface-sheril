# Données globales

Les données globales sont situées dans le fichier https://sheril.pbem-france.net/stats/data.xml dont une copie est
disponible dans le dossier `public/examples/data.xml`.

Ce XML contient des informations et des paramètres sur l'univers du jeu.

## La liste des technologies DATA>TECHNOLOGIES>T

```xml

<T base="cyb_vs_te_" code="cyb_vs_te_V" niv="4" nom="Centre d'espionnage embarqué" recherche="80000" type="1">
    <SPECIFICATION case="100" min="5" prix="10.0" type="autre"/>
    <CARACTERISTIQUE code="18" value="5500"/>
    <MARCHANDISE code="0" nb="6"/>
    <MARCHANDISE code="8" nb="5"/>
    <MARCHANDISE code="5" nb="3"/>
    <MARCHANDISE code="3" nb="3"/>
    <MARCHANDISE code="11" nb="2"/>
    <DESCRIPTION>Un centre d'espionnage est un centre d'entrainement de vos espions. Il permet d'effectuer des missions
        spéciales en fonction de la population travaillant dans le centre.
    </DESCRIPTION>
    <PARENT code="cyb_vs_te_IV"/>
</T>
```

une technologie est composée d'une base (ici "cyb_vs_te_" ), d'un niveau (ici 4, indexé à partir de 0).
Le niveau est représenté en chiffre romain, ce qui donne pour cette technologie le code "cyb_vs_te_V".
Elle possède une description ( dans DESCRIPTION), et 0 ou plusieurs parents qui sont des technologies qu'il faut
rechercher avant de pouvoir rechercher cette technologie.

la type d'une technologie est 0 = batiment ou 1 = composant de vaisseau.
"recherche" représente le nombre de point de recherche a dépenser pour trouver cette technologie.

Une technologie possède également des caractéristiques ( dans CARACTERISTIQUE ). Chaque caractéristique est représentée
par un code numérique et une valeur.

par exemple :

```xml

<T base="cyb_vs_te_" code="cyb_vs_te_V" niv="4" nom="Centre d'espionnage embarqué" recherche="80000" type="1">
    <SPECIFICATION case="100" min="5" prix="10.0" type="autre"/>
    <CARACTERISTIQUE code="18" value="5500"/>
    <MARCHANDISE code="0" nb="6"/>
    <MARCHANDISE code="8" nb="5"/>
    <MARCHANDISE code="5" nb="3"/>
    <MARCHANDISE code="3" nb="3"/>
    <MARCHANDISE code="11" nb="2"/>
    <DESCRIPTION>Un centre d'espionnage est un centre d'entrainement de vos espions. Il permet d'effectuer des missions
        spéciales en fonction de la population travaillant dans le centre.
    </DESCRIPTION>
    <PARENT code="cyb_vs_te_IV"/>
</T>
```

indique que cette technologie possède une caractéristique "18" avec une valeur de "5500". le nom des caractéristiques
est récupérable dans le noeud `CARACTERISTIQUES_COMPOSANT` si le type de la technologie est 1 ( composant de vaisseau )
 et dans le noeud `CARACTERISTIQUES_BATIMENT` si le type de la technologie est 0 ( batiment ).
Il suffit de récupérer la caractéristique par son numéro ( dans cet exemple "18" : "ville spatiale espionnage" )



## les races
chaque peuple ou commandant est d'une race . la liste des races est disponible dans le fichier dans le noeud `RACES`.
la race 1 par exemple est "Atalantes". la couleur de chacune des races est dns l'attribut "color".

## les marchandises
les marchandises sont disponibles dans le fichier dans le noeud `MARCHANDISES`. avec un code numérique pour les identifier et un nom.

