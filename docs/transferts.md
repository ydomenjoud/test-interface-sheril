# Transferts entre systèmes (ordre `charger_cargo`)

Source : moteur Java (`ReceptionOrdres.charger_cargo`, `Commandant.transfererEntreSysteme`,
`Commandant.getNombreMaximalDeTransfertEntreSysteme`, `Systeme.supprimerRichesses` / `ajouterRichesses`)
et formulaire PHP `ordres/fr/choix/charger_cargo.txt`.

## Format de l'ordre

`[0_x_y départ, code, nombre, planète départ, 0_x_y arrivée, planète arrivée]`

- **code** : code technologique d'un bâtiment, `minerai`, ou n° de marchandise (entier).
- **planète** : n° 0-based (l'interface affiche n° + 1) ; `100` = non précisée.
- Schéma de la console : préfixe `transfert|` (voir `utils/ordreSchema.ts`).

## Limite par tour

`1 + (systèmes dont le joueur possède plus de 75 % des planètes) + 2 × niveau de maîtrise spatiale`
(`maitstargateI` … `maitstargateX`, niveau = le plus haut connu).

Les transferts sont traités dans l'ordre de saisie. Seuls les transferts réussis comptent ;
au-delà de la limite, les ordres sont rejetés (« Saturation porte spatiale »).

## Règles

- Départ et arrivée doivent être des systèmes possédés par le joueur ; planète < nombre de planètes du système.
- **Marchandises** : stock du poste commercial du système ; si stock insuffisant, transfert partiel ;
  stock vide = échec (ne compte pas dans la limite).
- **Minerai** sans planète : retiré une unité à tour de rôle sur chaque planète du joueur, ajouté de même.
- **Bâtiments** sans planète : retirés de la planète qui en a le plus (mines : plus grande surcapacité),
  ajoutés sur celle qui en a le moins (mines : plus grande sous-capacité). Sans planète d'accueil : erreur 0009.
  Minerai et bâtiments comptent dans la limite même si rien n'a pu être retiré.
- Résolution en fin de tour, **avant** la production de minerai et les constructions.

L'écran Transferts (`screens/Transferts.tsx`, logique dans `utils/ordreTransfert.ts`) simule ces règles ;
il ignore la capacité des mines lors du choix de planète.
