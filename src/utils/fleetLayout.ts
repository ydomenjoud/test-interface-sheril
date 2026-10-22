import {FleetCellSummary, FleetFormation} from './fleetModel';

export type FleetRect = {x: number; y: number; width: number; height: number};
export type FleetLayoutItem =
    | {kind: 'formation'; variant: 'micro' | 'emblem' | 'row'; rect: FleetRect; formation: FleetFormation}
    | {kind: 'contact' | 'overflow'; rect: FleetRect; formations: readonly FleetFormation[]};

/** Rectangles locaux bornés à la case, indépendants de la puissance ou du nombre de vaisseaux. */
export function layoutFleetCell(summary: FleetCellSummary, cellSize: number, focus: boolean): FleetLayoutItem[] {
    const groups = summary.formations;
    if (!groups.length || cellSize < 4) return [];
    const padding = cellSize < 24 ? 1 : 2;
    const available = cellSize - padding * 2;
    const centred = (width: number, height: number): FleetRect => ({
        x: (cellSize - width) / 2, y: (cellSize - height) / 2, width, height,
    });
    if (groups.length === 1) {
        const size = Math.min(available, focus ? 48 : 36);
        return [{kind: 'formation', variant: cellSize < 24 ? 'micro' : 'emblem', rect: centred(size, size), formation: groups[0]}];
    }
    // Les petites cases ne peuvent pas accueillir plusieurs emblèmes complets.
    if (cellSize < 48 || (cellSize < 56 && groups.length > 2)) {
        const size = Math.min(available, 38);
        return [{kind: 'contact', rect: centred(size, size), formations: groups}];
    }
    const gap = 2;
    const rowHeight = cellSize >= 80 ? 18 : 14;
    const overflowHeight = 12;
    const maxRows = Math.min(3, Math.floor((available + gap) / (rowHeight + gap)));
    const visibleRows = groups.length <= maxRows ? groups.length : Math.min(maxRows,
        Math.floor((available - overflowHeight) / (rowHeight + gap)));
    const overflow = groups.slice(visibleRows);
    const height = visibleRows * rowHeight + Math.max(0, visibleRows - 1) * gap + (overflow.length ? gap + overflowHeight : 0);
    const width = Math.min(available, focus ? 92 : 84);
    const bounds = centred(width, height);
    const items: FleetLayoutItem[] = groups.slice(0, visibleRows).map((formation, i) => ({
        kind: 'formation', variant: 'row', formation,
        rect: {...bounds, y: bounds.y + i * (rowHeight + gap), height: rowHeight},
    }));
    if (overflow.length) items.push({
        kind: 'overflow', formations: overflow,
        rect: {...bounds, y: bounds.y + height - overflowHeight, height: overflowHeight},
    });
    return items;
}

export function containsFleetPoint(rect: FleetRect, x: number, y: number): boolean {
    return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

export type FleetScenePass = 'reportRoutes' | 'fleets' | 'combats' | 'reachability' | 'selection' | 'orders';

/** Une seule politique de couches, également utilisée par les tests de régression. */
export function drawFleetScene(focus: boolean, draw: Record<FleetScenePass, () => void>): void {
    const order: FleetScenePass[] = focus
        ? ['reportRoutes', 'combats', 'reachability', 'selection', 'orders', 'fleets']
        : ['reportRoutes', 'fleets', 'combats', 'reachability', 'selection', 'orders'];
    order.forEach(pass => draw[pass]());
}

export type FleetHitRegion = {
    rect: FleetRect;
    pos: FleetCellSummary['pos'];
    kind: FleetLayoutItem['kind'];
    owner?: number;
};

export function fleetHitRegions(items: readonly FleetLayoutItem[], x: number, y: number, pos: FleetCellSummary['pos']): FleetHitRegion[] {
    return items.map(item => ({
        rect: {...item.rect, x: x + item.rect.x, y: y + item.rect.y}, pos, kind: item.kind,
        owner: item.kind === 'formation' ? item.formation.owner : undefined,
    }));
}

export function findFleetHit(regions: readonly FleetHitRegion[], x: number, y: number): FleetHitRegion | undefined {
    for (let i = regions.length - 1; i >= 0; i--) {
        if (containsFleetPoint(regions[i].rect, x, y)) return regions[i];
    }
    return undefined;
}

/** Un contact multiple, un surplus ou un autre propriétaire ouvre l'inspection, jamais nos ordres. */
export function shouldOpenFleetPicker(hit: FleetHitRegion | undefined, hasOwnFleet: boolean, currentPlayer: number): boolean {
    return hasOwnFleet && (!hit || (hit.kind === 'formation' && hit.owner === currentPlayer));
}
