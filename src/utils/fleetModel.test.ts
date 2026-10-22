import {Rapport} from '../types';
import {
    ALL_FLEET_SIZE_BANDS, applyFleetSizePreset, buildFleetCells, buildFleetFormations,
    fleetStrength, formationShortLabel, formationStrengthLabel, MapFleet, mapFleetsForReport, restoreFleetSizeBands, strengthFromLabel,
} from './fleetModel';

const detected = (owner: number, num: number, puiss = 'moyenne', pos = {x: 19, y: 6}): MapFleet => ({
    type: 'detecte', owner, proprio: owner, num, nom: `F${num}`, pos, nbVso: 2, puiss,
});
const own = (num: number, as = 200): MapFleet => ({
    type: 'joueur', owner: 50, proprio: 50, num, nom: `F${num}`, pos: {x: 19, y: 6}, nbVso: 3,
    as, ap: 0, directive: 0, vitesse: 4, scan: 2, vaisseaux: [],
});

describe('fleet presentation model', () => {
    it.each([
        ['insignifiante', 'weak', 0], ['ridicule', 'weak', 1], ['très petite', 'weak', 2],
        ['petite', 'petite', 3], ['moyenne', 'moyenne', 4], ['assez grande', 'grande', 5],
        ['grande', 'grande', 6], ['TRÈS   GRANDE', 'massive', 7], ['gigantesque', 'massive', 8],
        ['titanesque', 'massive', 9], ['inimaginable', 'massive', 10],
    ])('preserves the game category %s', (label, band, priority) => {
        expect(strengthFromLabel(String(label))).toMatchObject({band, priority});
    });

    it.each(['', '??????', 'inconnue', 'nouvelle catégorie', 'pas très grande'])('does not guess a strength for %s', label => {
        expect(strengthFromLabel(label)).toMatchObject({band: 'unknown', priority: -1, shortLabel: '?'});
    });

    it.each([[24, 0], [25, 1], [50, 2], [100, 3], [200, 4], [500, 5], [1000, 6], [2000, 7], [5000, 8], [10000, 9], [18000, 10]])(
        'uses existing game thresholds for own power %s', (power, priority) => {
            expect(fleetStrength(own(1, power)).priority).toBe(priority);
        });

    it('counts distinct fleets rather than merging equal-strength forces', () => {
        const fleets = [detected(7, 1), detected(7, 2), detected(7, 3)];
        const [formation] = buildFleetFormations(fleets, ALL_FLEET_SIZE_BANDS);
        expect(formation).toMatchObject({owner: 7, count: 3, totalCount: 3, shipCount: 6});
        expect(formation.composition).toHaveLength(1);
        expect(formation.primary.label).toBe('moyenne');
        expect(formation.composition[0].count).toBe(3);
    });

    it('retains mixed strength categories and flags an unknown member separately', () => {
        const [formation] = buildFleetFormations([
            detected(7, 1, 'grande'), detected(7, 2, 'moyenne'), detected(7, 3, 'inconnue'),
        ], ALL_FLEET_SIZE_BANDS);
        expect(formation).toMatchObject({count: 3, unknownCount: 1});
        expect(formation.composition).toHaveLength(3);
        expect(formationStrengthLabel(formation)).toBe('grande + ?');
        expect(formationShortLabel(formation)).toBe('G?');
    });

    it('pins our fleets before stronger commanders and keeps remaining slots stable by ID', () => {
        const list = [detected(12, 1, 'inimaginable'), detected(7, 1, 'petite'), own(1, 1), detected(0, 1)];
        expect(buildFleetFormations(list, ALL_FLEET_SIZE_BANDS).map(f => f.owner)).toEqual([50, 0, 7, 12]);
        expect(buildFleetFormations([...list].reverse(), ALL_FLEET_SIZE_BANDS).map(f => f.owner)).toEqual([50, 0, 7, 12]);
    });

    it('keeps visibility and total counts, including when every known fleet is filtered out', () => {
        const fleets = [detected(7, 1, 'grande'), detected(7, 2, 'moyenne'), detected(12, 3, 'inconnue')];
        const cell = buildFleetCells(fleets, ['grande', 'unknown']).get('19_6')!;
        expect(cell).toMatchObject({totalCount: 3, visibleCount: 2, hiddenCount: 1, ownerCount: 2});
        expect(cell.formations[0]).toMatchObject({owner: 7, count: 1, totalCount: 2});
        expect(buildFleetCells(fleets, []).get('19_6')).toMatchObject({totalCount: 3, visibleCount: 0, hiddenCount: 3, formations: []});
    });

    it('does not let strength presets silently hide or restore unknown contacts', () => {
        expect(applyFleetSizePreset(ALL_FLEET_SIZE_BANDS, ['grande', 'massive'])).toEqual(['grande', 'massive', 'unknown']);
        expect(applyFleetSizePreset(['weak'], ALL_FLEET_SIZE_BANDS)).not.toContain('unknown');
        expect(buildFleetCells([detected(7, 1, 'inconnue')], applyFleetSizePreset(ALL_FLEET_SIZE_BANDS, ['massive']))
            .get('19_6')?.visibleCount).toBe(1);
    });

    it('deduplicates repeated observations by owner and ID, preferring our detailed record', () => {
        const player = own(1);
        const report = {
            joueur: {numero: 50}, flottesJoueur: [player],
            flottesDetectees: [detected(50, 1), detected(7, 1), detected(7, 1)],
        } as unknown as Rapport;
        expect(mapFleetsForReport(report)).toHaveLength(2);
        expect(mapFleetsForReport(report)[0].type).toBe('joueur');
        expect(mapFleetsForReport()).toEqual([]);
    });

    it('does not mutate report fleets or filter inputs', () => {
        const fleet = Object.freeze(detected(7, 1));
        const bands = Object.freeze(['moyenne'] as const);
        const list = Object.freeze([fleet]);
        buildFleetCells(list, bands);
        expect(list).toEqual([fleet]);
        expect(bands).toEqual(['moyenne']);
    });
});


describe('fleet ownership visibility and preference migration', () => {
    it.each([[true, true, 4], [false, true, 3], [true, false, 3], [false, false, 2]])(
        'combines own=%s and neutral=%s without removing raw report contacts', (showOwn, showNeutral, count) => {
            const fleets = [own(1), detected(0, 2, 'inconnue'), detected(7, 3, 'grande'), detected(8, 4)];
            const cell = buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS, {showOwn, showNeutral}).get('19_6')!;
            expect(cell.visibleCount).toBe(count);
            expect(cell.totalCount).toBe(4);
            expect(cell.hiddenCount).toBe(4 - Number(count));
            expect(cell.fleets).toEqual(fleets);
            expect(cell.ownerCount).toBe(4);
            expect(cell.formations.some(group => group.own)).toBe(showOwn);
            expect(cell.formations.some(group => group.owner === 0)).toBe(showNeutral);
        });
    it('combines ownership with power, keeping unknown neutral contacts unknown', () => {
        const fleets = [own(1), detected(0, 2, 'inconnue'), detected(7, 3, 'grande'), detected(8, 4)];
        const summary = buildFleetCells(fleets, ['grande', 'unknown'], {showOwn: true, showNeutral: true}).get('19_6')!;
        expect(summary.formations.map(group => group.owner)).toEqual([0, 7]);
        expect(summary.visibleCount).toBe(2);
        expect(buildFleetCells(fleets, ['grande', 'unknown'], {showOwn: true, showNeutral: false})
            .get('19_6')!.formations.map(group => group.owner)).toEqual([7]);
    });
    it('keeps an all-hidden cell inspectable and does not classify a foreign commander as neutral', () => {
        const fleets = [own(1), detected(0, 2)];
        const summary = buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS, {showOwn: false, showNeutral: false}).get('19_6')!;
        expect(summary).toMatchObject({visibleCount: 0, totalCount: 2, hiddenCount: 2, formations: []});
        expect(buildFleetFormations(summary.fleets, ALL_FLEET_SIZE_BANDS)).toHaveLength(2);
        const foreign = {...detected(7, 3), nom: 'Neutre'};
        expect(buildFleetFormations([foreign], ALL_FLEET_SIZE_BANDS, {showOwn: false, showNeutral: false})).toHaveLength(1);
    });
    it('restores old known-size choices and includes unknowns now that their controls are gone', () => {
        expect(restoreFleetSizeBands('["grande","massive"]')).toEqual(['grande', 'massive', 'unknown']);
        expect(restoreFleetSizeBands('[]')).toEqual(['unknown']);
        expect(restoreFleetSizeBands('["unknown","grande","grande","invalid"]')).toEqual(['grande', 'unknown']);
    });
    it.each([null, '{broken', '{}', 'false'])('defaults safely for invalid or absent preferences %s', saved => {
        expect(restoreFleetSizeBands(saved)).toEqual(ALL_FLEET_SIZE_BANDS);
    });
});
