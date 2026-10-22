import {XY} from '../types';

export type FleetViewport = {
    topX: number; leftY: number; rows: number; cols: number; cellSize: number; maxX: number; maxY: number;
};
export type FleetScreenPoint = {x: number; y: number};
export type FleetRouteSegment = {from: FleetScreenPoint; to: FleetScreenPoint};
const modulo = (value: number, size: number) => ((value % size) + size) % size;

export function shortestTorusDelta(from: number, to: number, size: number): number {
    const delta = to - from;
    const wrapped = modulo(delta + size / 2, size) - size / 2;
    // Garder un choix stable aux antipodes, comme les anciens ordres de déplacement.
    return wrapped === -size / 2 && delta > 0 ? size / 2 : wrapped;
}

/** Origines de toutes les copies visibles d'une case, hors bandeaux d'en-tête. */
export function visibleFleetCopies(pos: XY, view: FleetViewport): FleetScreenPoint[] {
    const points: FleetScreenPoint[] = [];
    const firstCol = modulo(pos.y - view.leftY, view.maxY);
    const firstRow = modulo(pos.x - view.topX, view.maxX);
    for (let col = firstCol; col < view.cols; col += view.maxY) {
        if (col === 0) continue;
        for (let row = firstRow; row < view.rows; row += view.maxX) {
            if (row !== 0) points.push({x: col * view.cellSize, y: row * view.cellSize});
        }
    }
    return points;
}

/**
 * X du jeu = vertical ; Y du jeu = horizontal. Chaque copie emploie le même delta
 * court, y compris si l'origine est hors écran mais que son segment entre dans la vue.
 * Le dessin appelant conserve son clip pour les bandeaux et les extrémités hors écran.
 */
export function projectFleetRoute(from: XY, to: XY, view: FleetViewport): FleetRouteSegment[] {
    const result: FleetRouteSegment[] = [];
    const dy = shortestTorusDelta(from.x, to.x, view.maxX) * view.cellSize;
    const dx = shortestTorusDelta(from.y, to.y, view.maxY) * view.cellSize;
    if (dx === 0 && dy === 0) return result;
    const firstCol = modulo(from.y - view.leftY, view.maxY);
    const firstRow = modulo(from.x - view.topX, view.maxX);
    for (let col = firstCol - view.maxY; col < view.cols + view.maxY; col += view.maxY) {
        for (let row = firstRow - view.maxX; row < view.rows + view.maxX; row += view.maxX) {
            const a = {x: (col + 0.5) * view.cellSize, y: (row + 0.5) * view.cellSize};
            const b = {x: a.x + dx, y: a.y + dy};
            if (Math.max(a.x, b.x) < view.cellSize || Math.min(a.x, b.x) > view.cols * view.cellSize ||
                Math.max(a.y, b.y) < view.cellSize || Math.min(a.y, b.y) > view.rows * view.cellSize) continue;
            result.push({from: a, to: b});
        }
    }
    return result;
}
