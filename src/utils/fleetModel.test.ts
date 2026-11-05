import {
    DEFAULT_FLEET_POWER_RANGE, fleetPowerCriterion, isFleetVisible, MapFleet, MAX_POWER_LEVEL, restoreFleetPowerRange,
} from './fleetModel';

const detected = (owner: number, num: number, puiss = 'moyenne', pos = {x: 19, y: 6}): MapFleet => ({
    type: 'detecte', owner, proprio: owner, num, nom: `F${num}`, pos, nbVso: 2, puiss,
});
const own = (num: number, as = 200, ap = 0): MapFleet => ({
    type: 'joueur', owner: 50, proprio: 50, num, nom: `F${num}`, pos: {x: 19, y: 6}, nbVso: 3,
    as, ap, directive: 0, vitesse: 4, scan: 2, vaisseaux: [],
});

describe('fleet power criterion', () => {
    it.each([
        ['insignifiante', 25], ['ridicule', 50], ['très petite', 100], ['petite', 200], ['moyenne', 500],
        ['assez grande', 1000], ['grande', 2000], ['très grande', 5000], ['gigantesque', 10000], ['titanesque', 18000],
    ])('uses the high side of the %s detection range', (label, upper) => {
        expect(fleetPowerCriterion(detected(7, 1, label))).toBe(upper);
    });

    it.each([
        ['TRES PETITE', 100], ['Moyenne', 500], ['assez   grande', 1000], ['faible', 25],
    ])('normalizes the detection label %s', (label, upper) => {
        expect(fleetPowerCriterion(detected(7, 1, label))).toBe(upper);
    });

    it('has no upper bound for inimaginable detections', () => {
        expect(fleetPowerCriterion(detected(7, 1, 'inimaginable'))).toBe(Infinity);
    });

    it.each(['', 'inconnue', 'nouvelle catégorie', 'pas très grande'])('has no criterion for the %s detection', label => {
        expect(fleetPowerCriterion(detected(7, 1, label))).toBeNull();
    });

    it.each([[200, 0, 200], [100, 50, 125], [0, 0, 0]])('computes the exact power of own fleets (as=%s, ap=%s)', (as, ap, power) => {
        expect(fleetPowerCriterion(own(1, as, ap))).toBe(power);
    });
});

describe('fleet visibility filter', () => {
    const fleets = [own(1, 150), detected(0, 2, 'inconnue'), detected(7, 3, 'grande'), detected(8, 4)];

    it.each([[true, true, 4], [false, true, 3], [true, false, 3], [false, false, 2]])(
        'shows %d fleets with own=%s and neutral=%s', (showOwn, showNeutral, count) => {
            const visible = fleets.filter(fleet => isFleetVisible(fleet, DEFAULT_FLEET_POWER_RANGE, {showOwn, showNeutral}));
            expect(visible).toHaveLength(count);
        });

    it('filters between the two game thresholds (reviewer example: ~120 à 400)', () => {
        const range = {min: 3, max: 5}; // 100 – 500
        const visible = fleets.filter(fleet => isFleetVisible(fleet, range));
        expect(visible.map(fleet => fleet.num)).toEqual([1, 4]); // own 150 + 'moyenne' (500) ; 'grande' (2000) et inconnue cachés
    });

    it('hides unknown power detections as soon as the range is narrowed', () => {
        const unknown = detected(0, 2, 'inconnue');
        expect(isFleetVisible(unknown)).toBe(true);
        expect(isFleetVisible(unknown, {min: 0, max: 5})).toBe(false);
        expect(isFleetVisible(unknown, {min: 1, max: MAX_POWER_LEVEL})).toBe(false);
        expect(isFleetVisible(unknown, {min: 0, max: MAX_POWER_LEVEL})).toBe(true);
    });

    it('applies the low threshold to the criterion', () => {
        const range = {min: 4, max: MAX_POWER_LEVEL}; // ≥ 200
        expect(isFleetVisible(detected(7, 1, 'petite'), range)).toBe(true);   // borne haute 200
        expect(isFleetVisible(detected(7, 1, 'ridicule'), range)).toBe(false); // borne haute 50
        expect(isFleetVisible(own(1, 150), range)).toBe(false);
        expect(isFleetVisible(own(1, 200), range)).toBe(true);
    });

    it('applies the high threshold, without bound at the top stop', () => {
        expect(isFleetVisible(detected(7, 1, 'moyenne'), {min: 0, max: 5})).toBe(true);  // 500 ≤ 500
        expect(isFleetVisible(detected(7, 1, 'assez grande'), {min: 0, max: 5})).toBe(false); // 1000 > 500
        expect(isFleetVisible(detected(7, 1, 'inimaginable'), {min: 0, max: 5})).toBe(false);
        expect(isFleetVisible(detected(7, 1, 'inimaginable'), {min: 0, max: MAX_POWER_LEVEL})).toBe(true);
        expect(isFleetVisible(own(1, 20000), {min: 0, max: MAX_POWER_LEVEL})).toBe(true);
        expect(isFleetVisible(own(1, 20000), {min: 0, max: 9})).toBe(false);
    });

    it('never classifies a foreign commander as neutral', () => {
        expect(isFleetVisible(detected(7, 3), DEFAULT_FLEET_POWER_RANGE, {showOwn: false, showNeutral: false})).toBe(true);
        expect(isFleetVisible(detected(0, 3), DEFAULT_FLEET_POWER_RANGE, {showOwn: true, showNeutral: false})).toBe(false);
    });

    it('defaults to showing everything', () => {
        fleets.forEach(fleet => expect(isFleetVisible(fleet)).toBe(true));
    });
});

describe('fleet power range preference', () => {
    it('restores a saved range and normalizes it', () => {
        expect(restoreFleetPowerRange('{"min":3,"max":6}')).toEqual({min: 3, max: 6});
        expect(restoreFleetPowerRange('{"min":7,"max":2}')).toEqual({min: 2, max: 7});
        expect(restoreFleetPowerRange('{"min":-4,"max":99}')).toEqual({min: 0, max: MAX_POWER_LEVEL});
        expect(restoreFleetPowerRange('{"min":"x","max":5}')).toEqual({min: 0, max: 5});
    });

    it.each([null, '{broken', '{}', 'true', '5', '"moyenne"'])('defaults safely for invalid or absent preferences %s', saved => {
        expect(restoreFleetPowerRange(saved)).toEqual(DEFAULT_FLEET_POWER_RANGE);
    });
});
