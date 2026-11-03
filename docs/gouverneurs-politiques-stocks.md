# Gouverneur, politiques et stocks : impact sur la stabilité et les revenus

(Règles de gestion fournies par l'utilisateur.) Statut d'implémentation en fin de document.

## Gouverneur

### Stabilité

Chaque tour, le moral modifié du gouverneur s'ajoute à l'évolution de stabilité du système.

```
moral modifié = moral + niveau(Maîtrise du moral) × 50 % × moral
```

- Le moral s'ajoute tel quel, sans plafond ni conversion. Si le résultat est décimal, il est arrondi à l'inférieur.
- Chaque niveau de Maîtrise du moral ajoute 50 % du moral de base (×3,5 au niveau 5).
- Sans gouverneur, l'apport est de 0.

### Revenus

| Compétence | Effet |
|---|---|
| Maîtrise de la finance | +20 % par niveau sur le revenu du système (jusqu'à +100 % au niveau 5), et même bonus sur le revenu technologique |
| Entretien du système | −20 % par niveau sur l'entretien des constructions planétaires |
| Entretien du lieutenant | −20 % par niveau sur le coût d'entretien du gouverneur |

Le bonus de Maîtrise de la finance s'applique avant les modificateurs de politique et de stock.

Le revenu de base d'une planète vaut `population × taxation / 10`, et 0 si la planète est en révolte. Le gouverneur agit donc aussi indirectement : plus la stabilité est haute, moins il y a de risque de révolte.

### Autres effets

- **Vitesse** : ajoute son montant en points de construction du système, après les multiplicateurs de politique.
- **Attaque / Défense** : batteries de défense planétaire et combat.
- **Entretien du système** : multiplie aussi la réparation automatique des bâtiments par `(1 + niveau)`.
- **Maîtrise du savoir** : +20 % d'expérience par niveau.
- **Marchandage** : sans effet.

Niveau d'une compétence : 0 si absente, 1 si présente avec la valeur 0, sinon la valeur.

Codes des compétences (data.xml) : 3 = maîtrise du moral, 14 = maîtrise de la finance, 13 = entretien système, 0 = vitesse. Voir [lieutenants.md](lieutenants.md).

## Autres modificateurs de stabilité

L'évolution de stabilité par tour est la somme de :
- le gouverneur (dans le rapport : `<evostab t="gouverneur">`) ;
- la politique ;
- les stocks de marchandises (`t="marchandise"`) ;
- la distance à la capitale (pénalité maximale sans capitale) ;
- la taxation : `{+6, +3, +1, −3, −7, −12}` pour les taux 0 à 5.

Le risque de révolte d'un système est `1 − (stabilité/100)^nombre de planètes`.

## Politiques

Une politique s'applique à tout le système. Changer de politique coûte 10 centaures.

| Politique | Stabilité / tour | Revenus | Autres effets |
|---|---|---|---|
| Loisir | +2 | −20 % (revenu et revenu technologique) | +2 réputation × nombre de planètes, par tour |
| Impôts | 0 | +10 % (revenu et revenu technologique) | |
| Totalitaire | +2 | 0 | −1 réputation × nombre de planètes ; −1 sur chaque marchandise produite |
| Intégriste | −2 | 0 | Population +10 % ; −1 réputation × nombre de planètes |
| Esclavagiste | −2 | 0 | Points de construction ×2 ; −2 réputation × nombre de planètes ; croissance de population plafonnée |
| Anti-race (6 variantes) | −5 | 0 | −300 réputation par tour ; extermination de la race ciblée avec gain en centaures |
| Commerce | 0 | 0 | +2 unités sur chaque marchandise produite |
| Construction | 0 | 0 | Points de construction +50 % |
| Défense | 0 | 0 | Miliciens +50 % (plafonnés à la population) |
| Expansion | 0 | 0 | Population +5 % |

Une politique anti-race donne −5 et non −2 ou +2 : ce malus ne se cumule pas avec un autre.

Seules Loisir et Impôts touchent directement les revenus. Les politiques à malus de stabilité (Intégriste, Esclavagiste, Anti-race) réduisent indirectement les revenus en augmentant le risque de révolte.

## Stocks importants de marchandises

Un stock est important à partir de **100 unités** dans le poste commercial. Les Déchets font exception : leur malus croît dès la première centaine.

### Sur la stabilité

| Marchandise | Effet |
|---|---|
| Armement et explosifs | −1 |
| Holofilms et hololivres | +1 |
| Déchets | −1 par tranche de 100 unités, sans plafond |

### Sur les revenus et budgets

| Marchandise | Effet |
|---|---|
| Articles de luxe | +10 % sur le revenu |
| Métaux précieux | +5 % sur le revenu (pas sur le revenu technologique) |
| Pièces industrielles | −10 % sur l'entretien des bâtiments planétaires |
| Carburant | Divise par 2 l'entretien des flottes présentes sur le système |
| Logiciels | +25 % sur le budget recherche technologique |
| Composants électroniques | +25 % sur les budgets services spéciaux et contre-espionnage |

### Autres effets

| Marchandise | Effet |
|---|---|
| Armement et explosifs | Miliciens ×1,5 (plafonnés à la population) |
| Produits alimentaires | Croissance de population +5 % |
| Médicaments | Croissance de population +10 % |
| Robots | +5 points de construction |

Les alcools n'ont aucun effet sur la stabilité.

## Calcul du budget technologique (avec logiciels)

Le budget technologique est calculé système par système, puis additionné :

```
revenu technologique du système      (revenu des planètes + bonus gouverneur Maîtrise de la finance, + politique Impôts / Loisir)
× pourcentage du budget alloué à la technologie pour ce système
+ 25 % du résultat si le système a 100 logiciels ou plus
```

- Le +25 % s'applique en dernier.
- Il ne vaut que pour le système qui détient le stock de logiciels, pas pour les autres systèmes.
- Le luxe et les métaux précieux n'entrent pas dans le revenu technologique.
- **Troncature par planète** : le revenu technologique d'une planète est `floor((pop + croissance) × taxation / 10)` (moteur : `Planete.getRevenuTechnologique`, `int potentiel = (popActuelle * taxation) / 10`). Le moteur tronque par race ; comme il n'y a qu'une race par planète, l'outil tronque par planète. Les étapes suivantes (gouverneur, politique, budget, logiciels) restent en flottant. Le revenu normal, lui, n'est pas tronqué (`Planete.getRevenu`).
- Vérifié sur les rapports et `comm.txt` (tours 2 à 5) : les points de recherche gagnés (`(int)(r × pourcentage) / 100`, `Commandant.java`) encadrent le revenu technologique tronqué, logiciels compris, dans 7 cas sur 7 ; le calcul sans troncature est hors fourchette (surestimé de 1 à 2,5 %).
- Les budgets services spéciaux et contre-espionnage suivent le même principe avec les composants électroniques (+25 %) à partir du revenu normal.

Codes : marchandises 6 = logiciels, 8 = composants électroniques ; politiques 0 = impôts, 13 = loisir.

## Base du revenu et croissance de population (vérifié sur rapport.xml)

- Le `revenu` réel du rapport = Σ par planète de `pop actuelle × taxation de la planète / 10` (puis coefficients gouverneur, politique, stocks). La taxation est propre à chaque planète.
- Le revenu prévisionnel tient compte de la croissance : par planète et par race, `croissance = floor(pop × taux / 100)`, **limitée à `popMax − pop`** (jamais négative). Exemple : pop 4000, +30 %, popMax 4200 → +200.
- Le revenu **normal** de chaque planète `(pop + croissance) × taxation / 10` n'est **pas arrondi** (vérifié sur rapport.xml : le `revenu` d'un système est exactement la somme de `pop actuelle × taxation / 10`, sans arrondi par planète) ; seule la croissance est arrondie à l'inférieur, par race et par planète. Le revenu **technologique** est en revanche tronqué par planète (voir « Calcul du budget technologique »).
- **Minimum de 10 par planète** : une planète peuplée gagne au moins 10 habitants par tour (toujours limité à `popMax − pop`). Vérifié sur les tours 3 → 4 : 92 couples planète/race, dont 4 où le calcul donnait 8 ou 9 pour 10 réels.
- Taux de croissance = `popAug` + 3 % si terraformation + effet de politique (+5 expansion, +10 intégriste).
- Vérifié sur les tours 2 → 5 (5619 planètes, taxe/politique/race inchangées) : 98,7 % exactes. Les écarts restants sont de +1 habitant.
- **Limite connue** : la terraformation relève aussi la pop max, ce qui peut ajouter +1 point de taux (le taux du moteur contient `popMaxDeBase / 800`) et relever le plafond de croissance. L'outil ne le modélise pas (il faudrait recalculer la pop max, donc reparser les rapports) : le revenu prévu d'une planète terraformée est un peu bas.
- Le passage du tour 1 au tour 2 ne suit pas ce modèle : le mode de calcul de l'augmentation de pop a changé à ce moment.

## Enchaînement du calcul du revenu

1. Revenu de base des planètes, additionné.
2. Gouverneur (Maîtrise de la finance) : ×(1 + 0,2 × niveau).
3. Politique : Impôts ×1,10, ou Loisir ×0,80.
4. Luxe (stock ≥ 100) : ×1,10.
5. Métaux précieux (stock ≥ 100) : ×1,05.

Tous les coefficients se multiplient, sauf les niveaux de Maîtrise de la finance qui s'additionnent dans un seul coefficient. Pas d'arrondi intermédiaire (float). Ex. : Impôts + luxe + métaux = ×1,10 × 1,10 × 1,05 = ×1,2705. Le code d'origine : `retour += retour/10` (luxe), `retour += retour/20` (métaux).

Le revenu technologique s'arrête à l'étape 3 (ni luxe ni métaux). Codes marchandises : 2 = luxe, 12 = métaux précieux.
 (PlanificationRevenu.tsx)

- Fait : stabilité du gouverneur (remplace l'`evostab` « gouverneur » du rapport par le moral modifié du gouverneur choisi) ; bonus de revenu de la maîtrise de la finance (le revenu technologique, SS et CE en découle).
- Déjà présent avant : effets de stabilité et de pop de certaines politiques (`EFFETS_POLITIQUES`), taxation.
- Fait aussi : politiques Impôts/Loisir sur le revenu, +25 % logiciels / composants électroniques sur les budgets Tech / SS / CE.
- Fait aussi : luxe et métaux précieux dans le revenu normal (multiplicatifs).
- Non fait : autres effets des stocks, entretiens (système, lieutenant), autres effets du gouverneur.

## Périmètre : planètes du joueur uniquement

Tous les calculs (stabilité moyenne, taxation de référence, population, croissance, revenus, coût de terraformation) ne portent que sur les planètes appartenant au joueur du rapport, jamais sur celles d'un autre propriétaire dans le même système.
