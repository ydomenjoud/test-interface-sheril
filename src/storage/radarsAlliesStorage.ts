import {RadarAllie} from '../parsers/parseManualSystems';

// Portées radar des alliés, importées par « Importer systèmes ». Un nouvel import d'un commandant
// remplace tous ses radars précédents (ses flottes ont bougé) ; ceux des autres sont gardés.

const CLE = 'carte_radars_allies';

export function loadRadarsAllies(): RadarAllie[] {
    try {
        const brut = localStorage.getItem(CLE);
        const liste = brut ? JSON.parse(brut) : [];
        return Array.isArray(liste) ? liste : [];
    } catch {
        return [];
    }
}

export function saveRadarsAllies(radars: RadarAllie[]): void {
    try {
        if (radars.length) localStorage.setItem(CLE, JSON.stringify(radars));
        else localStorage.removeItem(CLE);
    } catch {
        // stockage plein ou indisponible : les radars restent pour la session
    }
}

/** Remplace les radars des commandants présents dans `nouveaux`, garde ceux des autres. */
export function fusionnerRadarsAllies(existants: RadarAllie[], nouveaux: RadarAllie[]): RadarAllie[] {
    const remplaces = new Set(nouveaux.map(r => r.cdt));
    return [...existants.filter(r => !remplaces.has(r.cdt)), ...nouveaux];
}
