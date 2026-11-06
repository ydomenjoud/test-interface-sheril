// Constructions en cours retirées à la main dans l'écran Planification (simulation d'une annulation),
// par tour. Chaque entrée vaut « x_y:index » (index dans <constructions> du système).
const PREFIX = 'planification_en_cours_annulees_tour_';

export function loadAnnulationsEnCours(tour: number): string[] {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveAnnulationsEnCours(tour: number, annulations: string[]) {
    try {
        if (annulations.length > 0) localStorage.setItem(PREFIX + tour, JSON.stringify(annulations));
        else localStorage.removeItem(PREFIX + tour);
    } catch {
        // stockage indisponible : les annulations restent en mémoire
    }
}
