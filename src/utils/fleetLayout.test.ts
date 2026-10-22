import {buildFleetCells, ALL_FLEET_SIZE_BANDS, MapFleet} from './fleetModel';
import {containsFleetPoint, drawFleetScene, FleetScenePass, fleetHitRegions, findFleetHit, layoutFleetCell, shouldOpenFleetPicker} from './fleetLayout';

function cell(owners: number) {
    const fleets: MapFleet[] = Array.from({length: owners}, (_,i) => ({
        type: 'detecte', num: i, nom: `F${i}`, pos: {x: 19, y: 6}, owner: i, proprio: i, nbVso: 10,
        puiss: i % 2 ? 'inimaginable' : 'inconnue',
    }));
    return buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS).get('19_6')!;
}

describe('bounded fleet layouts', () => {
    it.each([8, 16, 20, 23, 24, 26, 28, 32, 40, 42, 48, 56, 60, 62, 63, 64, 80, 96, 128])('never overlaps or leaves a %s px cell', size => {
        for (let owners = 1; owners <= 12; owners++) {
            const layout = layoutFleetCell(cell(owners), size);
            expect(layout.length).toBeGreaterThan(0);
            layout.forEach(({rect}, i) => {
                expect(rect.x).toBeGreaterThanOrEqual(0.5);
                expect(rect.y).toBeGreaterThanOrEqual(0.5);
                expect(rect.width).toBeGreaterThan(0);
                expect(rect.height).toBeGreaterThan(0);
                expect(rect.x + rect.width).toBeLessThanOrEqual(size - 0.5);
                expect(rect.y + rect.height).toBeLessThanOrEqual(size - 0.5);
                layout.slice(i + 1).forEach(({rect: other}) => {
                    const overlaps = rect.x < other.x + other.width && rect.x + rect.width > other.x &&
                        rect.y < other.y + other.height && rect.y + rect.height > other.y;
                    expect(overlaps).toBe(false);
                });
            });
            const represented = layout.flatMap(item => item.kind === 'formation' ? [item.formation.owner] : item.formations.map(f => f.owner));
            expect(represented.sort((a, b) => a - b)).toEqual(Array.from({length: owners}, (_, i) => i));
        }
    });

    it('uses a multi-commander contact, not four intersecting glyphs, at ordinary zoom', () => {
        expect(layoutFleetCell(cell(4), 32).map(item => item.kind)).toEqual(['contact']);
    });
    it('counts overflow in commanders, without losing their fleet data', () => {
        const layout = layoutFleetCell(cell(6), 64);
        expect(layout.map(item => item.kind)).toEqual(['formation', 'formation', 'formation', 'overflow']);
        const last = layout[3];
        expect(last.kind !== 'formation' && last.formations.length).toBe(3);
    });
    it('returns no marker for a completely filtered cell', () => {
        const summary = cell(1);
        expect(layoutFleetCell({...summary, formations: [], visibleCount: 0}, 32)).toEqual([]);
    });
    it('hit-tests bounded rectangles with an exclusive far edge', () => {
        const rect = {x: 5, y: 8, width: 10, height: 12};
        expect(containsFleetPoint(rect, 5, 8)).toBe(true);
        expect(containsFleetPoint(rect, 15, 8)).toBe(false);
        expect(containsFleetPoint(rect, 8, 20)).toBe(false);
    });
});

describe('persistent map layer policy', () => {
    function run(focus: boolean) {
        const calls: string[] = [];
        const passNames: FleetScenePass[] = ['reportRoutes', 'fleets', 'combats', 'reachability', 'selection', 'orders'];
        const passes = {} as Record<FleetScenePass, () => void>;
        passNames.forEach(name => { passes[name] = () => { calls.push(name); }; });
        drawFleetScene(focus, passes);
        calls.push('hover', 'activeDrag', 'tooltip');
        return calls;
    }
    it('puts every persistent route and selection fill below fleets in focus mode', () => {
        expect(run(true)).toEqual(['reportRoutes', 'reachability', 'selection', 'orders', 'fleets', 'combats', 'hover', 'activeDrag', 'tooltip']);
    });
    it('preserves normal-mode order arrows above fleet markers', () => {
        const order = run(false);
        expect(order.indexOf('fleets')).toBeLessThan(order.indexOf('orders'));
        expect(order.indexOf('reportRoutes')).toBeLessThan(order.indexOf('fleets'));
    });
    it('keeps combat markers the top-most persistent layer in both modes', () => {
        [true, false].forEach(focus => {
            const order = run(focus);
            expect(order.indexOf('combats')).toBeGreaterThan(order.indexOf('fleets'));
            expect(order.indexOf('combats')).toBeGreaterThan(order.indexOf('orders'));
        });
    });
});


describe('fleet marker hit regions', () => {
    it('does not open our picker when inspecting another commander in a shared cell', () => {
        const summary = cell(4);
        const regions = fleetHitRegions(layoutFleetCell(summary, 64), 100, 200, summary.pos);
        const foreign = regions[1];
        const hit = findFleetHit(regions, foreign.rect.x + 1, foreign.rect.y + 1);
        expect(hit?.owner).toBe(1);
        expect(shouldOpenFleetPicker(hit, true, 0)).toBe(false);
        expect(shouldOpenFleetPicker(regions[0], true, 0)).toBe(true);
    });
    it('inspects compact multi-owner contacts and overflow instead of implicitly moving our fleets', () => {
        const summary = cell(6);
        const contact = fleetHitRegions(layoutFleetCell(summary, 32), 0, 0, summary.pos)[0];
        const overflow = fleetHitRegions(layoutFleetCell(summary, 64), 0, 0, summary.pos).slice(-1)[0];
        expect(shouldOpenFleetPicker(contact, true, 0)).toBe(false);
        expect(shouldOpenFleetPicker(overflow, true, 0)).toBe(false);
        expect(findFleetHit([contact], -1, -1)).toBeUndefined();
    });
    it('retains background click behaviour but never creates an order action without an own fleet', () => {
        expect(shouldOpenFleetPicker(undefined, true, 1)).toBe(true);
        expect(shouldOpenFleetPicker(undefined, false, 1)).toBe(false);
    });
});


describe('progressive disclosure thresholds', () => {
    it.each([8, 16, 20, 23])('uses letter-only formations below 24 px (%s)', size => {
        const item = layoutFleetCell(cell(1), size)[0];
        expect(item.kind === 'formation' && item.variant).toBe('micro');
    });
    it.each([24, 28, 40, 42, 48, 56, 62, 63])('keeps compact insignia and contacts until 64 px (%s)', size => {
        const item = layoutFleetCell(cell(1), size)[0];
        expect(item.kind === 'formation' && item.variant).toBe('emblem');
        [2, 4, 8].forEach(owners => expect(layoutFleetCell(cell(owners), size).map(entry => entry.kind)).toEqual(['contact']));
    });
    it('grows the single-formation box to the same 48 px cap in every mode', () => {
        [40, 52, 63].forEach(size => {
            const item = layoutFleetCell(cell(1), size)[0];
            expect(item.kind === 'formation' && item.rect.width).toBe(Math.min(size - 4, 48));
        });
    });
    it('gives single-formation and contact boxes the same size at every zoom', () => {
        [16, 20, 24, 28, 34, 40, 44, 48, 52, 60, 63].forEach(size => {
            expect(layoutFleetCell(cell(1), size)[0].rect.width)
                .toBe(layoutFleetCell(cell(3), size)[0].rect.width);
        });
    });
    it('reveals the detail card and commander rows from 64 px, in both modes', () => {
        const detail = layoutFleetCell(cell(1), 64)[0];
        expect(detail.kind === 'formation' && detail.variant).toBe('detail');
        expect(layoutFleetCell(cell(4), 64).map(item => item.kind)).toEqual(['formation', 'formation', 'formation', 'overflow']);
        const justBelow = layoutFleetCell(cell(1), 63)[0];
        expect(justBelow.kind === 'formation' && justBelow.variant).toBe('emblem');
        // La boîte ne saute pas : la carte 48 px remplace l'emblème 48 px.
        expect(justBelow.kind === 'formation' && justBelow.rect.width).toBe(detail.kind === 'formation' ? detail.rect.width : -1);
    });
});