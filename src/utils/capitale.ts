import { ModificateurStabilite, XY } from '../types';
import { getTorusDistance, posToString } from './position';

// Coût de l'ordre changer_capitale (moteur : Const.COUT_CHANGER_CAPITALE)
export const COUT_CHANGER_CAPITALE = 100;

// Barème du moteur (Const.MODIFICATEUR_STABILITE_CAPITALE), utilisé si data.xml n'est pas chargé
export const MODIFICATEURS_STABILITE_CAPITALE_DEFAUT: ModificateurStabilite[] = [
    { distance: 0, modif: 3 },
    { distance: 2, modif: 2 },
    { distance: 4, modif: 1 },
    { distance: 5, modif: 0 },
    { distance: 6, modif: -1 },
    { distance: 7, modif: -3 },
    { distance: 9, modif: -6 },
    { distance: 10, modif: -9 },
    { distance: 2147483647, modif: -16 },
];

const bareme = (mods?: ModificateurStabilite[]) =>
    mods && mods.length > 0 ? [...mods].sort((a, b) => a.distance - b.distance) : MODIFICATEURS_STABILITE_CAPITALE_DEFAUT;

/**
 * Modificateur de stabilité par tour d'un système, selon sa distance à la capitale (ligne « position » du rapport).
 * Reprend Possession.getEvolutionStabilite : distance 0 → premier palier ; sinon le palier qui suit
 * le dernier seuil strictement inférieur à la distance. Sans capitale (distance null) : dernier palier.
 */
export function modificateurStabiliteCapitale(distance: number | null, mods?: ModificateurStabilite[]): number {
    const m = bareme(mods);
    if (distance === null) return m[m.length - 1].modif;
    if (distance === 0) return m[0].modif;
    for (let i = m.length - 2; i >= 0; i--) {
        if (m[i].distance < distance) return m[i + 1].modif;
    }
    return m[m.length - 1].modif;
}

// Modificateur « position » d'un système pour une capitale donnée (null : pas de capitale)
export const modificateurPosition = (systeme: XY, capitale: XY | null, mods?: ModificateurStabilite[]) =>
    modificateurStabiliteCapitale(capitale ? getTorusDistance(capitale, systeme) : null, mods);

export type BilanCapitale = {
    cle: string;        // posToString de la capitale candidate
    pos: XY;
    total: number;      // somme des modificateurs « position » de tous les systèmes
    nbMalus: number;    // systèmes dont le modificateur est négatif
    pire: number;       // modificateur le plus bas
};

/**
 * Bilan de chaque capitale possible (un des systèmes du joueur) : somme des modificateurs de stabilité
 * « position » sur l'ensemble des systèmes. Trié du meilleur au moins bon (à égalité : moins de malus, puis pire malus le plus haut).
 */
export function bilansCapitales(systemes: XY[], mods?: ModificateurStabilite[]): BilanCapitale[] {
    return systemes
        .map(candidat => {
            const modifs = systemes.map(s => modificateurPosition(s, candidat, mods));
            return {
                cle: posToString(candidat),
                pos: candidat,
                total: modifs.reduce((a, b) => a + b, 0),
                nbMalus: modifs.filter(v => v < 0).length,
                pire: modifs.length ? Math.min(...modifs) : 0,
            };
        })
        .sort((a, b) => b.total - a.total || a.nbMalus - b.nbMalus || b.pire - a.pire);
}
