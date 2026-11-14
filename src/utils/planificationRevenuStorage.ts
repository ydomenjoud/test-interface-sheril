const PREFIX = 'planification_revenu_tour_';
const PREFIX_CAPITALE = 'planification_revenu_capitale_tour_';

export function loadPlanificationRevenu<T>(tour: number): Record<string, T> | undefined {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        return saved ? JSON.parse(saved) : undefined;
    } catch {
        return undefined;
    }
}

export function savePlanificationRevenu<T>(tour: number, states: Record<string, T>) {
    try {
        localStorage.setItem(PREFIX + tour, JSON.stringify(states));
    } catch {
        // stockage indisponible : le choix reste en mémoire
    }
}

// Nouvelle capitale choisie pour ce tour (clé « x_y ») ; null si la capitale du rapport est conservée
export function loadCapitaleRevenu(tour: number): string | null {
    try {
        return localStorage.getItem(PREFIX_CAPITALE + tour);
    } catch {
        return null;
    }
}

export function saveCapitaleRevenu(tour: number, capitale: string | null) {
    try {
        if (capitale) localStorage.setItem(PREFIX_CAPITALE + tour, capitale);
        else localStorage.removeItem(PREFIX_CAPITALE + tour);
    } catch {
        // stockage indisponible : le choix reste en mémoire
    }
}

// Efface les choix de tous les tours : à appeler quand un rapport est (re)chargé
export function clearPlanificationRevenu() {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX) || k.startsWith(PREFIX_CAPITALE))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        // rien à effacer
    }
}
