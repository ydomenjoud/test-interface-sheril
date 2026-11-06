import {ConstructionsEnCoursHtml} from '../parsers/parseConstructionsEnCours';

// Constructions en cours importées depuis le rapport HTML, par tour
const PREFIX = 'planification_en_cours_tour_';

export function loadConstructionsEnCours(tour: number): ConstructionsEnCoursHtml | undefined {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        return saved ? JSON.parse(saved) : undefined;
    } catch {
        return undefined;
    }
}

export function saveConstructionsEnCours(tour: number, data: ConstructionsEnCoursHtml | undefined) {
    try {
        if (data) localStorage.setItem(PREFIX + tour, JSON.stringify(data));
        else localStorage.removeItem(PREFIX + tour);
    } catch {
        // stockage indisponible : l'import reste en mémoire
    }
}
