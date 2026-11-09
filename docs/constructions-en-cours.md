# Constructions en cours

Une construction commencée et pas terminée reste dans la file du système d'un tour à l'autre. L'écran Planification
les prend en compte quand l'option « Constructions en cours » est activée.

## Format XML

Dans chaque système du joueur (`<s>`), après `<planetes>`, et seulement si le système a des constructions en cours :

```xml
<constructions>
  <construction code="modeI" type="batiment" nombre="1" pdcRestants="1" pdcEffectues="9"/>
  <construction code="Colonisateur" type="vaisseau" nombre="1" pdcRestants="0" pdcEffectues="12" planete="6"/>
</constructions>
```

| Attribut | Contenu |
|----------|---------|
| `code` | Code du bâtiment (`modeI`), ou nom du plan pour un vaisseau |
| `type` | `batiment` ou `vaisseau` |
| `nombre` | Unités du lot restant à sortir |
| `pdcRestants` | PDC encore nécessaires pour tout le lot (`pdc unitaire × nombre − pdcEffectues`) |
| `pdcEffectues` | PDC déjà acquis par le lot |
| `planete` | Numéro de planète en **base 0** ; absent si la planète n'est pas précisée |

Ce bloc est produit par `RapportXML.java` (moteur `sheril-old-java`). Les rapports plus anciens ne le contiennent pas.
On trouve les mêmes informations dans le tableau « Constructions en cours » du rapport HTML (`principal.htm`), avec le
nom complet du bâtiment au lieu du code et la planète en base 1.

## Règles de résolution (`Possession.resolutionConstructions`)

- Les PDC du système sont répartis un point à la fois entre toutes les constructions de la file, anciennes et nouvelles.
- Une unité sort quand ses PDC sont réunis. **Prix, minerai et marchandises sont payés à la sortie**, pas au lancement.
- S'il manque des centaures, du minerai, des marchandises ou de l'encombrement, seules les unités finançables sortent ;
  les autres restent en cours avec leurs PDC acquis (d'où des lignes à 0 PDC restant).
- Un vaisseau ne sort pas sans chantier naval sur le système.
- L'ordre `annuler_construction` annule **toutes** les constructions en cours d'un système.

## Dans l'outil

- Lecture : `parsers/parseRapport.ts` → `SystemeJoueur.constructionsEnCours`.
- Option « Constructions en cours » de l'écran Planification (`planification_show_en_cours`, désactivée par défaut).
- Pour chaque système, l'écran déduit d'abord les PDC restants, puis le minerai et les marchandises de tout le lot ;
  « MAX », « Action multiple » et le tri « PDC restant » partent de ce qui reste. Le récapitulatif des coûts les inclut.
- Les constructions en cours ne sont pas ajoutées au schéma de construction : les ordres ont déjà été passés.
- La croix rouge retire une construction de la liste du tour pour simuler son annulation (aucun ordre produit) ;
  « Rétablir » la remet. Stockage : `planification_en_cours_annulees_tour_<n>`.
