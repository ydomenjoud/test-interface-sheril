# Constructions en cours

Une construction commencée et pas terminée reste dans la file du système d'un tour à l'autre. L'écran Planification
les prend en compte si l'on importe le rapport HTML du tour (bouton « Constructions en cours »).

## Où les trouver

- **Pas dans `rapport.xml`** : l'export XML des systèmes (`<s>`, `RapportXML.java`) ne contient pas la file de constructions.
- **Dans `principal.htm`** (archive du tour), tableau « Constructions en cours » de chaque système, après le bloc « Budget ».
  Le tableau n'apparaît que si le système a des constructions en cours.

```html
<A name="0_29_10"> … (fiche du système)
<TR><TD colspan="6" class="bg"><SPAN class="c7">Constructions en cours</SPAN></TD></TR>
<TR><TD>Type</TD><TD>Nombre</TD><TD colspan="2">Points constru. nécessaires</TD><TD colspan="2">Pour la planète</TD></TR>
<TR><TD>station de produits de luxe de type I</TD><TD>1</TD><TD colspan="2">1</TD><TD colspan="2">Non précisé</TD></TR>
<TR><TD colspan="6" class="bg"><SPAN class="c7">Bâtiments</SPAN></TD></TR>
```

| Colonne | Contenu |
|---------|---------|
| Type | Bâtiment : nom complet `nom + " de type " + niveau romain` (le nom seul si le bâtiment n'a qu'un niveau). Vaisseau : nom du plan. |
| Nombre | Unités du lot restant à sortir |
| Points constru. nécessaires | PDC **restants** pour tout le lot (`pdc unitaire × nombre − points déjà effectués`) |
| Pour la planète | Numéro de planète en **base 1**, ou « Non précisé » |

Le système est donné par l'ancre `<A name="0_x_y">` qui précède sa fiche. Le titre de la page porte le numéro
du commandant : `Rapport du commandant <span>Nom&nbsp;(23)</span>` (pas de numéro de tour).

## Règles de résolution (`Possession.resolutionConstructions`)

- Les PDC du système sont répartis un point à la fois entre toutes les constructions de la file, anciennes et nouvelles.
- Une unité sort quand ses PDC sont réunis. **Prix, minerai et marchandises sont payés à la sortie**, pas au lancement.
- S'il manque des centaures, du minerai, des marchandises ou de l'encombrement, seules les unités finançables sortent ;
  les autres restent en cours avec leurs PDC acquis (d'où des lignes à 0 PDC restant).
- Un vaisseau ne sort pas sans chantier naval sur le système.

## Dans l'outil

- `parsers/parseConstructionsEnCours.ts` : lecture de `principal.htm` et rapprochement nom → code de bâtiment ou plan.
- Stockage par tour : `planification_en_cours_tour_<n>` (localStorage), rattaché au tour du rapport XML chargé.
  L'import est refusé si le numéro de commandant ne correspond pas au rapport chargé.
- Pour chaque système, l'écran déduit d'abord les PDC restants, puis le minerai et les marchandises de tout le lot ;
  « MAX », « Action multiple » et le tri « PDC restant » partent de ce qui reste. Le récapitulatif des coûts les inclut.
- Les constructions en cours ne sont pas ajoutées au schéma de construction : les ordres ont déjà été passés.
- Un nom non reconnu dans `data.xml` est signalé ; seuls ses PDC restants sont comptés.
- La croix rouge d'une construction en cours la retire de la liste du tour, pour simuler son annulation. Elle ne
  produit aucun ordre. Dans le jeu, l'ordre `annuler_construction` annule **toutes** les constructions en cours du système.
