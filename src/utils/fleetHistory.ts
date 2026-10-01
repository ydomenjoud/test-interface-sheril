import {FlotteDetectee, XY} from '../types';
import {getTorusDistance} from './position';
import {FleetSnapshot} from '../storage/rapportStore';

// Vrai si la case était dans la portée de scan d'un des observateurs (distance de Tchebyshev sur le tore, comme le radar)
export function isObserved(observateurs: FleetSnapshot['observateurs'], pos: XY): boolean {
    return observateurs.some(o => getTorusDistance(o.pos, pos) <= o.scan);
}

// Dernières flottes vues sur la case avant le tour donné.
// On remonte les tours : on s'arrête au premier tour où des flottes y étaient, ou où la case était observée sans flotte.
export function lastKnownFleets(snapshots: FleetSnapshot[], pos: XY, beforeTour: number): { tour: number; flottes: FlotteDetectee[] } | undefined {
    const previous = snapshots.filter(s => s.tour < beforeTour).sort((a, b) => b.tour - a.tour);
    for (const s of previous) {
        const here = s.flottes.filter(f => f.pos.x === pos.x && f.pos.y === pos.y);
        if (here.length > 0) return {tour: s.tour, flottes: here};
        if (isObserved(s.observateurs, pos)) return undefined;
    }
    return undefined;
}
