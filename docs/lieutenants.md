# Lieutenants

## Source : rapport.xml

`rapport > commandant > lieutenants > l`, un `<l>` par lieutenant.

Attributs : `nom`, `type`, `pos`, `race`, `niv`, `exp`, `valeur`, et les caractéristiques `att`, `def`, `mar`, `mor`, `vit`.
Enfants : `<competence comp="N" val="niveau"/>` (zéro ou plusieurs).

- `type` : `0` = héros (affecté à une flotte), `1` = gouverneur (affecté à un système). Seuls les gouverneurs sont utilisés pour l'instant.
- `pos` :
  - `-1` : en réserve ;
  - `0_X_Y` : en poste sur le système de cette position ;
  - un nombre : numéro de la flotte (héros).
- Il n'y a pas d'identifiant : le `nom` sert de clé.

## Compétences : data.xml

`data > leader_competences > c` : `code` ↔ `nom`. Le `comp` d'une `<competence>` du rapport correspond au `code`.

## Dans le code

- Types `Lieutenant`, `CompetenceLieutenant` dans `src/types.ts` ; `Rapport.lieutenants`, `GlobalData.competencesLieutenants`.
- Parsing : `src/parsers/parseRapport.ts`, `src/parsers/parseData.ts`.
- UI : liste déroulante « Gouverneur » par système dans `src/screens/PlanificationRevenu.tsx` (un gouverneur ne peut occuper qu'un système).

## À venir

Impact du gouverneur sur la stabilité, la croissance de population et le budget : règles non encore documentées.
