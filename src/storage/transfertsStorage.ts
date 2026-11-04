import { TransfertOrdre } from '../utils/ordreTransfert';

const PREFIX = 'transferts_tour_';

const estOrdre = (o: unknown): o is TransfertOrdre => {
    if (!o || typeof o !== 'object') return false;
    const t = o as Record<string, unknown>;
    const pos = (p: unknown) => !!p && typeof p === 'object'
        && typeof (p as Record<string, unknown>).x === 'number' && typeof (p as Record<string, unknown>).y === 'number';
    const planete = (p: unknown) => p === null || typeof p === 'number';
    return typeof t.id === 'string' && typeof t.code === 'string' && typeof t.nombre === 'number'
        && pos(t.de) && pos(t.vers) && planete(t.planeteDe) && planete(t.planeteVers);
};

// Transferts programmés pour un tour, dans l'ordre de résolution
export function loadTransferts(tour: number): TransfertOrdre[] {
    try {
        const saved = localStorage.getItem(PREFIX + tour);
        if (!saved) return [];
        const brut: unknown = JSON.parse(saved);
        return Array.isArray(brut) ? brut.filter(estOrdre) : [];
    } catch {
        return [];
    }
}

export function saveTransferts(tour: number, ordres: TransfertOrdre[]) {
    try {
        if (ordres.length === 0) localStorage.removeItem(PREFIX + tour);
        else localStorage.setItem(PREFIX + tour, JSON.stringify(ordres));
    } catch {
        // stockage indisponible : les ordres restent en mémoire
    }
}
