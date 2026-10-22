import {ALL_FLEET_SIZE_BANDS, buildFleetCells, MapFleet} from '../../../utils/fleetModel';
import {drawFleetCell} from './drawFleetLayer';

function context() {
    const methods = ['save', 'restore', 'beginPath', 'rect', 'clip', 'roundRect', 'translate', 'scale', 'moveTo',
        'lineTo', 'closePath', 'fill', 'fillRect', 'stroke', 'setLineDash', 'fillText'];
    const values = Object.fromEntries(methods.map(name => [name, jest.fn()]));
    return {...values, measureText: jest.fn((text: string) => ({width: text.length * 4})),
        globalAlpha: 0.2, filter: 'blur(4px)'} as unknown as CanvasRenderingContext2D;
}
function summary(owners: number, count = 1, unknown = false) {
    const fleets: MapFleet[] = Array.from({length: owners}, (_, owner) => Array.from({length: count}, (_, num) => ({
        type: 'detecte' as const, num, owner, proprio: owner, nom: 'Contact', pos: {x: 19, y: 6},
        nbVso: 2, puiss: unknown && num === 0 ? 'inconnue' : 'grande',
    }))).flat();
    return buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS).get('19_6')!;
}
const options = {focus: true, getOwnerColor: () => '#ef4444'};

describe('fleet glyph renderer', () => {
    it('renders fleet multiplicity separately from the power category', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3), 100, 200, 64, options);
        const labels = (ctx.fillText as jest.Mock).mock.calls.map(call => call[0]);
        expect(labels).toContain('×3');
        expect(labels).toContain('G');
        expect(labels).toContain('#0');
    });
    it('keeps the unknown flag alongside the strongest known category', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 2, true), 0, 0, 48, options);
        expect((ctx.fillText as jest.Mock).mock.calls.map(call => call[0])).toContain('G?');
        expect(ctx.setLineDash).toHaveBeenCalledWith([2, 2]);
    });
    it('labels compact multi-owner contacts and overflow as owners, not fleets', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(6), 0, 0, 32, options);
        expect(ctx.fillText).toHaveBeenCalledWith('6cdt', expect.any(Number), expect.any(Number));
        drawFleetCell(ctx, summary(6), 0, 0, 64, options);
        expect(ctx.fillText).toHaveBeenCalledWith('+3 cdt', expect.any(Number), expect.any(Number));
    });
    it('clips each item, resets opacity, and balances canvas state at either DPR', () => {
        [1, 2].forEach(dpr => {
            const ctx = context();
            ctx.scale(dpr, dpr);
            const alphas: number[] = [];
            (ctx.fill as jest.Mock).mockImplementation(() => { alphas.push(ctx.globalAlpha); });
            const items = drawFleetCell(ctx, summary(6), 32, 64, 64, options);
            expect(ctx.clip).toHaveBeenCalledTimes(items.length);
            expect(alphas.every(alpha => alpha === 1)).toBe(true);
            expect(ctx.save).toHaveBeenCalledTimes((ctx.restore as jest.Mock).mock.calls.length);
        });
    });
});


describe('reduced low/mid-zoom clutter', () => {
    it.each([8, 16, 20, 23])('shows only the entire strength label without a ship below 24 px (%s)', size => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3, true), 0, 0, size, options);
        expect(ctx.translate).not.toHaveBeenCalled();
        expect((ctx.fillText as jest.Mock).mock.calls.map(call => call[0])).toEqual(['G?']);
        expect((ctx.fillText as jest.Mock).mock.calls[0][3]).toBeGreaterThan(0);
    });
    it('preserves the compact 24 px pictogram', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1), 0, 0, 24, options);
        expect(ctx.translate).toHaveBeenCalledTimes(1);
        expect(ctx.fillText).toHaveBeenCalledWith('G', expect.any(Number), expect.any(Number));
    });
    it.each([28, 32, 40, 42, 48, 56, 62, 64, 80, 128])('does not draw redundant strength bars at %s px', size => {
        const ctx = context();
        drawFleetCell(ctx, summary(1), 0, 0, size, options);
        expect(ctx.fillRect).not.toHaveBeenCalled();
        const labels = (ctx.fillText as jest.Mock).mock.calls.map(call => call[0]);
        expect(labels.includes('#0')).toBe(size >= 64);
        expect(labels).toContain('G');
    });
    it('keeps the order-state stripe, which is not a strength bar', () => {
        const data = summary(1);
        data.formations[0].fleets[0] = {...data.formations[0].fleets[0], type: 'joueur', vitesse: 4,
            as: 1200, ap: 0, directive: 0, vaisseaux: [], scan: 2};
        const ctx = context();
        drawFleetCell(ctx, data, 0, 0, 32, {...options, deplacements: {0: {x: 20, y: 6}}});
        expect(ctx.fillRect).toHaveBeenCalledTimes(1);
        expect(ctx.fillRect).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 2, expect.any(Number));
    });
});
