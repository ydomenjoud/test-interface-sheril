import {SystemeDetecte, XY} from '../types';
import {SystemSnapshot} from '../storage/rapportStore';

// Dernier système vu sur la case avant le tour donné : on remonte les tours stockés, du plus récent au plus ancien,
// et on prend le premier où le système y était détecté.
export function lastKnownSystem(snapshots: SystemSnapshot[], pos: XY, beforeTour: number): { tour: number; systeme: SystemeDetecte } | undefined {
    const previous = snapshots.filter(s => s.tour < beforeTour).sort((a, b) => b.tour - a.tour);
    for (const s of previous) {
        const here = s.systemes.find(sys => sys.pos.x === pos.x && sys.pos.y === pos.y);
        if (here) return { tour: s.tour, systeme: here };
    }
    return undefined;
}