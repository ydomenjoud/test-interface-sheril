const PREFIX = 'planification_construction_tour_';

export function loadPlanificationConstruction<T>(tour: number): Record<string, T> | undefined {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        return saved ? JSON.parse(saved) : undefined;
    } catch {
        return undefined;
    }
}

export function savePlanificationConstruction<T>(tour: number, states: Record<string, T>) {
    try {
        localStorage.setItem(PREFIX + tour, JSON.stringify(states));
    } catch {
        // stockage indisponible : le choix reste en mémoire
    }
}

// Efface les choix de tous les tours : à appeler quand un rapport est (re)chargé
export function clearPlanificationConstruction() {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        // rien à effacer
    }
}