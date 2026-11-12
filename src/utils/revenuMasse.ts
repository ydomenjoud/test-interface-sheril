// Actions de masse de la planification des revenus : appliquer une valeur à plusieurs systèmes, et l'annuler

export interface EtatBudgets {
    btech: number;
    besp: number;
    bcont: number;
}

export type ChampBudget = keyof EtatBudgets;

// Le total des budgets d'un système dépasserait-il 100 % si l'on fixait ce budget à cette valeur ?
export const depasseraitCent = (etat: EtatBudgets, champ: ChampBudget, valeur: number) =>
    etat.btech + etat.besp + etat.bcont - etat[champ] + valeur > 100;

// Applique une modification aux systèmes désignés (les clés inconnues sont ignorées)
export function appliquerATous<T extends object>(
    etats: Record<string, T>,
    cles: string[],
    maj: (etat: T, cle: string) => Partial<T>,
): Record<string, T> {
    const suivants = { ...etats };
    cles.forEach(k => {
        if (suivants[k]) suivants[k] = { ...suivants[k], ...maj(suivants[k], k) };
    });
    return suivants;
}

// Valeurs actuelles des champs qu'une modification va remplacer (pour pouvoir l'annuler)
export function valeursAvant<T extends object>(etat: T, modification: Partial<T>): Partial<T> {
    const avant: Partial<T> = {};
    (Object.keys(modification) as (keyof T)[]).forEach(c => { avant[c] = etat[c]; });
    return avant;
}

// Remet les champs sauvegardés par valeursAvant, sans toucher aux autres champs ni aux autres systèmes
export function restaurer<T extends object>(etats: Record<string, T>, avant: Record<string, Partial<T>>): Record<string, T> {
    return appliquerATous(etats, Object.keys(avant), (_, k) => avant[k]);
}

// Clés comprises entre deux index (inclus), dans n'importe quel ordre : sélection par Maj+clic
export function plage(cles: string[], de: number, a: number): string[] {
    return cles.slice(Math.min(de, a), Math.max(de, a) + 1);
}
