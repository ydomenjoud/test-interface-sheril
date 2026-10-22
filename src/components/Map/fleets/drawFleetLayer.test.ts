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
        drawFleetCell(ctx, summary(1, 3), 100, 200, 48, options);
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
