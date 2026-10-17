import {GlobalData, Planete} from '../types';

// Capacité de réparation d'un système par tour : somme, sur toutes ses planètes et tous leurs
// bâtiments, de la caractéristique « capacité réparation vaisseaux » (data.xml, code 5) —
// p. ex. chantier naval : +20, centre de réparation spatial I : +100, II : +400, etc.
// (valeurs de data.xml > technologies, caractéristique code 5)

// Valeurs de secours si data.xml n'est pas chargé (mêmes valeurs que data.xml)
const VALEURS_REPARATION: Record<string, number> = {
    chantierI: 20,
    repareI: 100,
    repareII: 400,
    repareIII: 1350,
    repareIV: 3200,
    repareV: 6250,
};

const NOM_CARACTERISTIQUE = 'capacité réparation vaisseaux';

/** Valeur de la caractéristique « capacité réparation vaisseaux » par code de bâtiment, depuis data.xml. */
function valeursDepuisData(global: GlobalData): Record<string, number> | undefined {
    const code = Object.entries(global.caracteristiquesBatiment)
        .find(([, nom]) => nom.toLowerCase() === NOM_CARACTERISTIQUE)?.[0];
    if (code === undefined) return undefined;
    const out: Record<string, number> = {};
    global.technologies.forEach(t => {
        // Bâtiments uniquement : les composants (type 1) ont leur propre espace de codes de
        // caractéristiques (le code 5 y signifie autre chose)
        if (t.type !== 0) return;
        const c = t.caracteristiques.find(k => k.code === Number(code));
        if (c) out[t.code] = c.value;
    });
    return Object.keys(out).length > 0 ? out : undefined;
}

/** Capacité de réparation du système (points par tour) à partir de ses planètes. */
export function capaciteReparation(planetes: Planete[] | undefined, global?: GlobalData): number {
    if (!planetes || planetes.length === 0) return 0;
    // Les valeurs de data.xml priment ; les bâtiments qu'on n'y trouve pas tombent sur les valeurs de secours
    const valeurs = {...VALEURS_REPARATION, ...(global ? valeursDepuisData(global) : undefined)};
    let total = 0;
    planetes.forEach(p => {
        (p.batiments ?? []).forEach(b => {
            total += (valeurs[b.techCode] ?? 0) * b.count;
        });
    });
    return total;
}