import {ALL_FLEET_SIZE_BANDS, buildFleetCells, MapFleet} from '../../../utils/fleetModel';
import {drawFleetCell} from './drawFleetLayer';

function context() {
    const methods = ['save', 'restore', 'beginPath', 'rect', 'clip', 'roundRect', 'translate', 'scale', 'moveTo',
        'lineTo', 'closePath', 'fill', 'fillRect', 'stroke', 'setLineDash', 'fillText'];
    const values = Object.fromEntries(methods.map(name => [name, jest.fn()]));
    // Mesure simulée proportionnelle à la fonte en cours : les règles « ça tient » deviennent testables.
    const state = {font: ''};
    return {...values,
        globalAlpha: 0.2, filter: 'blur(4px)',
        get font() { return state.font; },
        set font(value: string) { state.font = value; },
        measureText: jest.fn((text: string) => {
            const match = /(\d+(?:\.\d+)?)px/.exec(state.font);
            return {width: text.length * (match ? Number(match[1]) : 10) * 0.55};
        })} as unknown as CanvasRenderingContext2D;
}
function summary(owners: number, count = 1, unknown = false) {
    const fleets: MapFleet[] = Array.from({length: owners}, (_, owner) => Array.from({length: count}, (_, num) => ({
        type: 'detecte' as const, num, owner, proprio: owner, nom: 'Contact', pos: {x: 19, y: 6},
        nbVso: 2, puiss: unknown && num === 0 ? 'inconnue' : 'grande',
    }))).flat();
    return buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS).get('19_6')!;
}
function ownSummary(count = 1) {
    const data = summary(count);
    const fleets: MapFleet[] = data.fleets.map(fleet => ({
        type: 'joueur' as const, num: fleet.num, nom: fleet.nom, pos: fleet.pos, nbVso: fleet.nbVso,
        proprio: 0, directive: 0, vitesse: 3, scan: 0, vaisseaux: [], owner: 0,
    }));
    return buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS).get('19_6')!;
}
const options = {focus: true, getOwnerColor: () => '#ef4444'};
const drawnLabels = (ctx: CanvasRenderingContext2D) => (ctx.fillText as jest.Mock).mock.calls.map(call => call[0]);

describe('fleet glyph renderer', () => {
    it('renders fleet multiplicity separately from the power category', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3), 100, 200, 64, options);
        const labels = drawnLabels(ctx);
        expect(labels).toContain('×3');
        expect(labels).toContain('G');
        expect(labels).toContain('#0');
    });
    it('keeps the unknown flag alongside the strongest known category', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 2, true), 0, 0, 48, options);
        expect(drawnLabels(ctx)).toContain('G?');
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


describe('letter-priority disclosure', () => {
    it('never trades the category letter for the count in the emblem band', () => {
        // 24 px : la boîte (20 px) ne tient pas « G » + « ×12 » côte à côte → lettre seule.
        const narrow = context();
        drawFleetCell(narrow, summary(1, 12), 0, 0, 24, options);
        expect(drawnLabels(narrow)).toEqual(['G']);
        // 40 px : les deux tiennent → les deux sont affichés.
        const wide = context();
        drawFleetCell(wide, summary(1, 12), 0, 0, 40, options);
        const labels = drawnLabels(wide);
        expect(labels).toContain('G');
        expect(labels).toContain('×12');
    });
    it.each([16, 20, 23])('shows the entire strength label without a ship below 24 px (%s)', size => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3, true), 0, 0, size, options);
        expect(ctx.translate).not.toHaveBeenCalled();
        expect(drawnLabels(ctx)).toEqual(['G?']);
    });
    it('shrinks then truncates the letter so it never overflows a tiny box', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3, true), 0, 0, 8, options);
        expect(ctx.translate).not.toHaveBeenCalled();
        const calls = (ctx.fillText as jest.Mock).mock.calls;
        expect(calls).toHaveLength(1);
        const text = String(calls[0][0]);
        expect(text.length).toBeGreaterThan(0);
        expect('G?'.startsWith(text)).toBe(true);
    });
    it('preserves the 24 px pictogram', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1), 0, 0, 24, options);
        expect(ctx.translate).toHaveBeenCalledTimes(1);
        expect(ctx.fillText).toHaveBeenCalledWith('G', expect.any(Number), expect.any(Number));
    });
    it('vertically centers the glyph+letter block in a grown emblem box', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1), 0, 0, 40, options);
        // Boîte 36 px en (2,2) : bloc 12+2+9 = 23 px → haut de l'emblème 8.5, centre de ligne 27.
        expect(ctx.translate).toHaveBeenCalledWith(14, 8.5);
        expect(ctx.fillText).toHaveBeenCalledWith('G', 20, 27);
    });
    it('scales the emblem with the box and centers letter+count as one unit', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3), 0, 0, 50, options);
        // Boîte 46 px : emblème round(46×22/64) = 16 px, bloc 16+2+9 = 27 px centré → haut 11.5.
        expect(ctx.translate).toHaveBeenCalledWith(17, 11.5);
        const calls = (ctx.fillText as jest.Mock).mock.calls;
        const letter = calls.find(call => call[0] === 'G');
        const total = calls.find(call => call[0] === '×3');
        expect(letter?.[2]).toBeCloseTo(34);
        expect(total?.[2]).toBeCloseTo(34);
        expect(letter?.[1]).toBeCloseTo(25 - (4.4 + 4 + 8.8) / 2);
        expect(total?.[1]).toBeCloseTo((letter?.[1] as number) + 4.4 + 4);
    });
    it('optically centers the micro letter on the pixel grid', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(1, 3, true), 0, 0, 16, options);
        // Boîte 14 px : centre y = 8, fonte 9 px → ligne alphabétique round(8 + 9×0.35) = 11.
        expect((ctx.fillText as jest.Mock).mock.calls[0]).toEqual(['G?', 8, 11]);
    });
    it.each([28, 32, 40, 42, 48, 56, 62, 64, 80, 128])('does not draw redundant strength bars at %s px', size => {
        const ctx = context();
        drawFleetCell(ctx, summary(1), 0, 0, size, options);
        expect(ctx.fillRect).not.toHaveBeenCalled();
        const labels = drawnLabels(ctx);
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

describe('owner tokens', () => {
    it('omits the commander label on our own formation, shows #n for the others (detail card)', () => {
        const own = context();
        drawFleetCell(own, ownSummary(2), 0, 0, 64, options);
        expect(drawnLabels(own)).not.toContain('#0');
        expect(drawnLabels(own)).toContain('×2');
        const foreign = context();
        drawFleetCell(foreign, summary(1, 2), 0, 0, 64, options);
        expect(drawnLabels(foreign)).toContain('#0');
    });
    it('drops the row pictogram and leaves our row unlabeled while foreign rows keep #n', () => {
        const mixed = buildFleetCells([
            {type: 'joueur', num: 0, nom: 'F0', pos: {x: 19, y: 6}, nbVso: 2, proprio: 0,
                directive: 0, vitesse: 3, scan: 0, vaisseaux: [], owner: 0},
            {type: 'detecte', num: 1, nom: 'F1', pos: {x: 19, y: 6}, nbVso: 2, proprio: 1, puiss: 'grande', owner: 1},
            {type: 'detecte', num: 2, nom: 'F2', pos: {x: 19, y: 6}, nbVso: 2, proprio: 2, puiss: 'moyenne', owner: 2},
        ], ALL_FLEET_SIZE_BANDS).get('19_6')!;
        const ctx = context();
        drawFleetCell(ctx, mixed, 0, 0, 80, options);
        expect(ctx.translate).not.toHaveBeenCalled();
        const labels = drawnLabels(ctx);
        expect(labels).toContain('#1');
        expect(labels).toContain('#2');
        expect(labels).not.toContain('#0');
        expect(labels).not.toContain('MOI');
    });
});

describe('contact counters', () => {
    it('falls back to the short commander label only when the full one does not fit', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(6), 0, 0, 24, options);
        const labels = drawnLabels(ctx);
        expect(labels).toContain('6c');
        expect(labels).not.toContain('6cdt');
        expect(labels).not.toContain('×6'); // boîte de 20 px < 26 : pas de total
    });
    it('shows the fleet total from a 26 px contact box, with the full label when it fits', () => {
        const ctx = context();
        drawFleetCell(ctx, summary(6), 0, 0, 30, options);
        const labels = drawnLabels(ctx);
        expect(labels).toContain('6cdt');
        expect(labels).toContain('×6');
    });
    it('draws the commander label and the fleet total in a single color', () => {
        const ctx = context();
        const styles: [string, string][] = [];
        (ctx.fillText as jest.Mock).mockImplementation((text: string) => {
            styles.push([String(text), (ctx as unknown as {fillStyle: string}).fillStyle]);
        });
        drawFleetCell(ctx, summary(6), 0, 0, 32, options);
        const styleOf = (text: string) => styles.find(entry => entry[0] === text)?.[1];
        expect(styleOf('6cdt')).toBe('#e2e8f0');
        expect(styleOf('×6')).toBe('#e2e8f0');
    });
});