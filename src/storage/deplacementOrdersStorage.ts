import { XY } from '../types';
import {DeplacementEnAttente, DIRECTIVE_DEFAUT} from '../utils/ordreDeplacement';

const PREFIX = 'deplacements_tour_';

// Numérotation placeholder des directives (version antérieure de cette fonctionnalité, codes
// provisoires) → codes réels du jeu : les libellés sont identiques, seuls les codes changent.
const DIRECTIVES_PLACEHOLDER_VERS_REELLES: Record<number, number> = {
    0: 8, // « Attaque flottes cdt »
    1: 2, // « Attaque préventive »
    2: 3, // « Attaque toute flotte »
    3: 1, // « Attaque système »
    4: 4, // « Pillage système »
    5: 5, // « Attaque planète »
    6: 6, // « Pillage planète »
    7: 7, // « Eradication planète »
    8: 0, // « Attitude neutre »
};

// Déplacements en attente pour un tour : { [num de flotte]: { to: {x, y}, directive, strategy, precision? } }
// Les num de flotte sont des clés de l'objet JSON, donc des chaînes dans le stockage.
export function loadDeplacements(tour: number): Record<number, DeplacementEnAttente> {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        if (!saved) return {};
        const brut = JSON.parse(saved) as Record<string, unknown>;
        const deplacements: Record<number, DeplacementEnAttente> = {};
        for (const [num, entree] of Object.entries(brut)) {
            if (!entree || typeof entree !== 'object') continue;
            const e = entree as Record<string, unknown>;
            // Format le plus ancien (avant directive/stratégie) : la position {x, y} était au premier niveau
            const pos: unknown = 'to' in e ? e.to : e;
            if (!pos || typeof pos !== 'object') continue;
            const p = pos as XY;
            if (typeof p.x === 'number' && typeof p.y === 'number') {
                // Format placeholder (stratégie en nombre, « cdt » séparé, codes directives provisoires) :
                // détecté par la stratégie en nombre, migré vers le format réel (stratégie en chaîne,
                // codes du jeu, « precision »). La stratégie placeholder n'a pas d'équivalent : on repart du vide.
                const legacy = typeof e.strategy === 'number';
                const directiveStockee = typeof e.directive === 'number' ? e.directive : undefined;
                const d: DeplacementEnAttente = {
                    to: {x: p.x, y: p.y},
                    directive: directiveStockee !== undefined
                        ? (legacy ? (DIRECTIVES_PLACEHOLDER_VERS_REELLES[directiveStockee] ?? DIRECTIVE_DEFAUT) : directiveStockee)
                        : DIRECTIVE_DEFAUT,
                    strategy: typeof e.strategy === 'string' ? e.strategy : '',
                };
                const precision = legacy ? e.cdt : e.precision;
                if (typeof precision === 'number') d.precision = precision;
                deplacements[Number(num)] = d;
            }
        }
        return deplacements;
    } catch {
        return {};
    }
}

export function saveDeplacements(tour: number, deplacements: Record<number, DeplacementEnAttente>) {
    try {
        localStorage.setItem(PREFIX + tour, JSON.stringify(deplacements));
    } catch {
        // stockage indisponible : les déplacements restent en mémoire
    }
}

export function clearDeplacements(tour: number) {
    try {
        localStorage.removeItem(PREFIX + tour);
    } catch {
        // rien à effacer
    }
}

// Efface les déplacements de tous les tours : à appeler quand un rapport est (re)chargé
export function clearAllDeplacements() {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        // rien à effacer
    }
}