import { DivisionOrdre, FusionOrdre, OrdresFlottes, ORDRES_FLOTTES_VIDES } from '../utils/ordreFlotte';

const PREFIX = 'flottes_ordres_tour_';

const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Fusions et divisions en attente pour un tour : { fusions: [...], divisions: [...] }
// Entrées illisibles ignorées une à une (le reste du stockage reste utilisable)
export function loadOrdresFlottes(tour: number): OrdresFlottes {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        if (!saved) return ORDRES_FLOTTES_VIDES;
        const brut = JSON.parse(saved) as { fusions?: unknown; divisions?: unknown };
        const fusions: FusionOrdre[] = (Array.isArray(brut.fusions) ? brut.fusions : [])
            .filter((f): f is FusionOrdre => !!f && Array.isArray(f.flottes) && f.flottes.every(estNombre) && estNombre(f.directive))
            .map(f => (estNombre(f.precision)
                ? { flottes: f.flottes, directive: f.directive, precision: f.precision }
                : { flottes: f.flottes, directive: f.directive }));
        const divisions: DivisionOrdre[] = (Array.isArray(brut.divisions) ? brut.divisions : [])
            .filter((d): d is DivisionOrdre => !!d && estNombre(d.fleetNum) && typeof d.nom === 'string'
                && !!d.vaisseaux && typeof d.vaisseaux === 'object'
                && Object.values(d.vaisseaux).every(estNombre))
            // n° absent (première version) : la position dans la liste, comme alors dans le schéma
            .map((d, i) => ({ numero: estNombre(d.numero) ? d.numero : i + 1, fleetNum: d.fleetNum, nom: d.nom, vaisseaux: { ...d.vaisseaux } }));
        return { fusions, divisions };
    } catch {
        return ORDRES_FLOTTES_VIDES;
    }
}

export function saveOrdresFlottes(tour: number, ordres: OrdresFlottes) {
    try {
        if (ordres.fusions.length === 0 && ordres.divisions.length === 0) localStorage.removeItem(PREFIX + tour);
        else localStorage.setItem(PREFIX + tour, JSON.stringify(ordres));
    } catch {
        // stockage indisponible : les ordres restent en mémoire
    }
}

// Efface les ordres de tous les tours : à appeler quand un rapport est (re)chargé
export function clearAllOrdresFlottes() {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        // rien à effacer
    }
}
