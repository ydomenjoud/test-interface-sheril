import {FlotteDetectee, Rapport} from '../types';

// Flottes importées par « Importer systèmes » (export d'un autre commandant), datées de leur tour :
// une flotte bouge, elle n'est affichée que sur la carte de ce tour-là, comme une flotte détectée.

export type FlotteImportee = FlotteDetectee & { tour?: number };

const CLE = 'carte_flottes_importees';

const cleFlotte = (f: FlotteImportee) => `${f.tour ?? ''}_${f.proprio}_${f.num}`;

export function loadFlottesImportees(): FlotteImportee[] {
    try {
        const brut = localStorage.getItem(CLE);
        const liste = brut ? JSON.parse(brut) : [];
        return Array.isArray(liste) ? liste : [];
    } catch {
        return [];
    }
}

export function saveFlottesImportees(flottes: FlotteImportee[]): void {
    try {
        if (flottes.length) localStorage.setItem(CLE, JSON.stringify(flottes));
        else localStorage.removeItem(CLE);
    } catch {
        // stockage plein ou indisponible : les flottes restent pour la session
    }
}

/** Une flotte déjà importée pour le même tour (même propriétaire et numéro) est remplacée. */
export function fusionnerFlottesImportees(existantes: FlotteImportee[], nouvelles: FlotteImportee[]): FlotteImportee[] {
    const remplacees = new Set(nouvelles.map(cleFlotte));
    return [...existantes.filter(f => !remplacees.has(cleFlotte(f))), ...nouvelles];
}

/**
 * Ajoute aux flottes détectées du rapport les flottes importées de son tour, sauf celles que le
 * rapport connaît déjà (même propriétaire et numéro, détectées ou au joueur).
 */
export function avecFlottesImportees<R extends Pick<Rapport, 'tour' | 'flottesDetectees' | 'flottesJoueur'>>(r: R, importees: FlotteImportee[]): R {
    const connues = new Set([...r.flottesDetectees, ...r.flottesJoueur].map(f => `${f.proprio}_${f.num}`));
    const ajout = importees
        .filter(f => f.tour === r.tour && !connues.has(`${f.proprio}_${f.num}`))
        .map(({tour, ...f}) => ({...f, type: 'detecte' as const}));
    return ajout.length ? {...r, flottesDetectees: [...r.flottesDetectees, ...ajout]} : r;
}
