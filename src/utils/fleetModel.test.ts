import {
    ALL_FLEET_SIZE_BANDS, fleetStrength, isFleetVisible, MapFleet, restoreFleetSizeBands, strengthFromLabel,
} from './fleetModel';

const detected = (owner: number, num: number, puiss = 'moyenne', pos = {x: 19, y: 6}): MapFleet => ({
    type: 'detecte', owner, proprio: owner, num, nom: `F${num}`, pos, nbVso: 2, puiss,
});
const own = (num: number, as = 200): MapFleet => ({
    type: 'joueur', owner: 50, proprio: 50, num, nom: `F${num}`, pos: {x: 19, y: 6}, nbVso: 3,
    as, ap: 0, directive: 0, vitesse: 4, scan: 2, vaisseaux: [],
});

describe('fleet strength classification', () => {
    it.each([
        ['insignifiante', 'weak'], ['ridicule', 'weak'], ['très petite', 'weak'], ['faible', 'weak'],
        ['petite', 'petite'], ['moyenne', 'moyenne'],
        ['assez grande', 'grande'], ['grande', 'grande'],
        ['très grande', 'massive'], ['gigantesque', 'massive'], ['titanesque', 'massive'], ['inimaginable', 'massive'],
    ])('maps %s to the %s band', (label, band) => {
        expect(strengthFromLabel(label)).toMatchObject({band});
    });

    it.each(['', '??????', 'inconnue', 'nouvelle catégorie', 'pas très grande'])('does not guess a strength for %s', label => {
        expect(strengthFromLabel(label)).toMatchObject({band: 'unknown'});
    });

    it.each([[24, 'weak'], [25, 'weak'], [50, 'weak'], [100, 'petite'], [200, 'moyenne'],
        [500, 'grande'], [1000, 'grande'], [2000, 'massive'], [5000, 'massive'], [10000, 'massive'], [18000, 'massive']])(
        'classes own power %s in the %s band', (power, band) => {
            expect(fleetStrength(own(1, power))).toMatchObject({band});
        });
});

describe('fleet visibility filter', () => {
    const fleets = [own(1), detected(0, 2, 'inconnue'), detected(7, 3, 'grande'), detected(8, 4)];

    it.each([[true, true, 4], [false, true, 3], [true, false, 3], [false, false, 2]])(
        'shows %d fleets with own=%s and neutral=%s', (showOwn, showNeutral, count) => {
            const visible = fleets.filter(fleet => isFleetVisible(fleet, ALL_FLEET_SIZE_BANDS, {showOwn, showNeutral}));
            expect(visible).toHaveLength(count);
        });

    it('combines ownership with the selected bands', () => {
        const visible = fleets.filter(fleet => isFleetVisible(fleet, ['grande', 'unknown']));
        expect(visible.map(fleet => fleet.owner)).toEqual([0, 7]);
        const withoutNeutral = fleets.filter(fleet => isFleetVisible(fleet, ['grande', 'unknown'], {showOwn: true, showNeutral: false}));
        expect(withoutNeutral.map(fleet => fleet.owner)).toEqual([7]);
    });

    it('never classifies a foreign commander as neutral', () => {
        expect(isFleetVisible(detected(7, 3), ALL_FLEET_SIZE_BANDS, {showOwn: false, showNeutral: false})).toBe(true);
        expect(isFleetVisible(detected(0, 3), ALL_FLEET_SIZE_BANDS, {showOwn: true, showNeutral: false})).toBe(false);
    });

    it('defaults to showing everything', () => {
        fleets.forEach(fleet => expect(isFleetVisible(fleet)).toBe(true));
    });
});

describe('fleet size band preference migration', () => {
    it('restores old known-size choices and keeps unknowns always included', () => {
        expect(restoreFleetSizeBands('["grande","massive"]')).toEqual(['grande', 'massive', 'unknown']);
        expect(restoreFleetSizeBands('[]')).toEqual(['unknown']);
        expect(restoreFleetSizeBands('["unknown","grande","grande","invalid"]')).toEqual(['grande', 'unknown']);
    });

    it.each([null, '{broken', '{}', 'false'])('defaults safely for invalid or absent preferences %s', saved => {
        expect(restoreFleetSizeBands(saved)).toEqual(ALL_FLEET_SIZE_BANDS);
    });
});
