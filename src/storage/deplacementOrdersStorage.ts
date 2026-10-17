import { XY } from '../types';
import {DeplacementEnAttente, DIRECTIVE_DEFAUT, STRATEGIE_DEFAUT} from '../utils/ordreDeplacement';

const PREFIX = 'deplacements_tour_';

// Déplacements en attente pour un tour : { [num de flotte]: { to: {x, y}, directive, strategy } }
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
            // Ancien format (avant directive/stratégie) : la position {x, y} était au premier niveau
            const pos: unknown = 'to' in e ? e.to : e;
            if (!pos || typeof pos !== 'object') continue;
            const p = pos as XY;
            if (typeof p.x === 'number' && typeof p.y === 'number') {
                const d: DeplacementEnAttente = {
                    to: {x: p.x, y: p.y},
                    directive: typeof e.directive === 'number' ? e.directive : DIRECTIVE_DEFAUT,
                    strategy: typeof e.strategy === 'number' ? e.strategy : STRATEGIE_DEFAUT,
                };
                if (typeof e.cdt === 'number') d.cdt = e.cdt; // commandant visé (directive « Attaque flottes cdt »)
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