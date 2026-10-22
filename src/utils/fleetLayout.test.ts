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
    it.each([8, 16, 20, 24, 32, 40, 48, 56, 60, 64, 80, 96, 128])('never overlaps or leaves a %s px cell', size => {
        [false, true].forEach(focus => {
            for (let owners = 1; owners <= 12; owners++) {
                const layout = layoutFleetCell(cell(owners), size, focus);
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
    });

    it('uses a multi-commander contact, not four intersecting glyphs, at ordinary zoom', () => {
        expect(layoutFleetCell(cell(4), 32, true).map(item => item.kind)).toEqual(['contact']);
    });
    it('counts overflow in commanders, without losing their fleet data', () => {
        const layout = layoutFleetCell(cell(6), 64, true);
        expect(layout.map(item => item.kind)).toEqual(['formation', 'formation', 'formation', 'overflow']);
        const last = layout[3];
        expect(last.kind !== 'formation' && last.formations.length).toBe(3);
    });
    it('returns no marker for a completely filtered cell', () => {
        const summary = cell(1);
        expect(layoutFleetCell({...summary, formations: [], visibleCount: 0}, 32, true)).toEqual([]);
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
    it('puts every persistent route, combat and selection fill below fleets in focus mode', () => {
        expect(run(true)).toEqual(['reportRoutes', 'combats', 'reachability', 'selection', 'orders', 'fleets', 'hover', 'activeDrag', 'tooltip']);
    });
    it('preserves normal-mode order arrows above fleet markers', () => {
        const order = run(false);
        expect(order.indexOf('fleets')).toBeLessThan(order.indexOf('orders'));
        expect(order.indexOf('reportRoutes')).toBeLessThan(order.indexOf('fleets'));
    });
});


describe('fleet marker hit regions', () => {
    it('does not open our picker when inspecting another commander in a shared cell', () => {
        const summary = cell(4);
        const regions = fleetHitRegions(layoutFleetCell(summary, 64, true), 100, 200, summary.pos);
        const foreign = regions[1];
        const hit = findFleetHit(regions, foreign.rect.x + 1, foreign.rect.y + 1);
        expect(hit?.owner).toBe(1);
        expect(shouldOpenFleetPicker(hit, true, 0)).toBe(false);
        expect(shouldOpenFleetPicker(regions[0], true, 0)).toBe(true);
    });
    it('inspects compact multi-owner contacts and overflow instead of implicitly moving our fleets', () => {
        const summary = cell(6);
        const contact = fleetHitRegions(layoutFleetCell(summary, 32, true), 0, 0, summary.pos)[0];
        const overflow = fleetHitRegions(layoutFleetCell(summary, 64, true), 0, 0, summary.pos).slice(-1)[0];
        expect(shouldOpenFleetPicker(contact, true, 0)).toBe(false);
        expect(shouldOpenFleetPicker(overflow, true, 0)).toBe(false);
        expect(findFleetHit([contact], -1, -1)).toBeUndefined();
    });
    it('retains background click behaviour but never creates an order action without an own fleet', () => {
        expect(shouldOpenFleetPicker(undefined, true, 1)).toBe(true);
        expect(shouldOpenFleetPicker(undefined, false, 1)).toBe(false);
    });
});
