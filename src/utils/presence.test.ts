import {BOUNDS, reinitialiserBornesGalaxie} from './position';
import {
    PRESENCE_DEFAULTS,
    computePresence,
    detectionWeight,
    sigmaForPositions,
    torusEuclidean,
} from './presence';

describe('detectionWeight', () => {
    test('plein poids pour une détection récente', () => {
        expect(detectionWeight(50, 50, 10)).toBe(1);
        expect(detectionWeight(50, 47, 10)).toBe(1);
    });

    test('décroissance linéaire jusqu’à 0 à decayTurns', () => {
        expect(detectionWeight(50, 43, 10)).toBeCloseTo(1 - 4 / 7);
        expect(detectionWeight(50, 40, 10)).toBe(0);
        expect(detectionWeight(50, 30, 10)).toBe(0);
    });

    test('âge inconnu (ancien cache) -> poids fixe faible', () => {
        expect(detectionWeight(50, undefined, 10)).toBe(PRESENCE_DEFAULTS.unknownAgeWeight);
    });

    test('détection plus récente que le rapport affiché conserve le plein poids', () => {
        expect(detectionWeight(50, 52, 10)).toBe(1);
    });
});

describe('torusEuclidean', () => {
    afterEach(reinitialiserBornesGalaxie);

    test('prend le plus court chemin sur le tore', () => {
        reinitialiserBornesGalaxie(); // 60×60
        expect(torusEuclidean({x: 1, y: 10}, {x: 60, y: 10})).toBe(1);
        expect(torusEuclidean({x: 10, y: 10}, {x: 10, y: 10})).toBe(0);
        expect(torusEuclidean({x: 10, y: 10}, {x: 13, y: 14})).toBe(5);
    });
});

describe('sigmaForPositions', () => {
    test('renvoie 0 avec moins de 2 positions', () => {
        expect(sigmaForPositions([])).toBe(0);
        expect(sigmaForPositions([{x: 5, y: 5}])).toBe(0);
    });

    test('borne la bande entre 3 et 8', () => {
        expect(sigmaForPositions([{x: 5, y: 5}, {x: 5, y: 45}])).toBe(8);
        expect(sigmaForPositions([{x: 5, y: 5}, {x: 5, y: 7}])).toBe(3);
    });
});

describe('computePresence', () => {
    afterEach(reinitialiserBornesGalaxie);

    type SysJ = {pos: {x: number, y: number}; proprietaires?: number[]};
    type SysD = {pos: {x: number, y: number}; proprietaires?: number[]; tour?: number};
    type RapportLike = {tour: number; systemesJoueur: SysJ[]; systemesDetectes: SysD[]};

    const mkRapport = (over: Partial<RapportLike> = {}): RapportLike => ({
        tour: 100,
        systemesJoueur: [],
        systemesDetectes: [],
        ...over,
    });

    const idx = (x: number, y: number) => (x - 1) * BOUNDS.maxY + (y - 1);

    test('un système du joueur gagne sa case ; les cases lointaines restent inconnues', () => {
        reinitialiserBornesGalaxie(); // 60×60
        const data = computePresence(
            mkRapport({systemesJoueur: [{pos: {x: 30, y: 30}, proprietaires: [1]}]}),
            null,
            1,
        );
        expect(data.winner[idx(30, 30)]).toBe(1);
        // 25 cases plus loin que le coup d’arrêt (σ défaut 6 -> 15)
        expect(data.winner[idx(55, 30)]).toBe(-1);
        expect(data.densityMax).toBeGreaterThanOrEqual(1);
    });

    test('s’enroule sur le tore', () => {
        reinitialiserBornesGalaxie();
        const data = computePresence(
            mkRapport({systemesJoueur: [{pos: {x: 1, y: 30}, proprietaires: [1]}]}),
            null,
            1,
        );
        expect(data.winner[idx(60, 30)]).toBe(1); // x=60 est voisin de x=1
    });

    test('une détection plus vieille que la fenêtre ne captive plus', () => {
        reinitialiserBornesGalaxie();
        const data = computePresence(
            mkRapport({systemesDetectes: [{pos: {x: 30, y: 30}, proprietaires: [7], tour: 10}]}),
            null,
            1,
        );
        expect(data.winner[idx(30, 30)]).toBe(-1);
    });

    test('une détection d’âge inconnu conserve une faible présence', () => {
        reinitialiserBornesGalaxie();
        const data = computePresence(
            mkRapport({systemesDetectes: [{pos: {x: 30, y: 30}, proprietaires: [7]}]}),
            null,
            1,
        );
        expect(data.winner[idx(30, 30)]).toBe(7);
    });

    test('le mode focus isole un commandant', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({
            systemesJoueur: [{pos: {x: 20, y: 20}, proprietaires: [1]}],
            systemesDetectes: [{pos: {x: 40, y: 40}, proprietaires: [9], tour: 100}],
        });
        const data = computePresence(rapport, null, 1, {focusPlayer: 9});
        expect(data.winner[idx(40, 40)]).toBe(9);
        expect(data.winner[idx(20, 20)]).toBe(-1);
    });

    test('un système isolé fait un petit nuage, pas une large région', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({systemesJoueur: [{pos: {x: 30, y: 30}, proprietaires: [1]}]});
        const data = computePresence(rapport, null, 1);
        const près = data.density[idx(32, 30)];
        const loin = data.density[idx(44, 30)];
        expect(près).toBeGreaterThan(0.8);
        expect(loin).toBeLessThan(0.1);
        // mais encore attribué tant qu’au-dessus du seuil
        expect(data.winner[idx(44, 30)]).toBe(1);
    });

    test('résumé de secteur : comptes, dominance et égalité', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({
            systemesJoueur: [
                {pos: {x: 3, y: 3}, proprietaires: [1]},
                {pos: {x: 4, y: 4}, proprietaires: [1]},
            ],
            systemesDetectes: [
                {pos: {x: 5, y: 5}, proprietaires: [2], tour: 100},
                {pos: {x: 6, y: 6}, proprietaires: [3], tour: 100},
            ],
        });
        const data = computePresence(rapport, null, 1);
        const sec = data.sectors.get('0_0');
        expect(sec).toBeDefined();
        expect(sec!.counts.get(1)).toBe(2);
        expect(sec!.counts.get(2)).toBe(1);
        expect(sec!.counts.get(3)).toBe(1);
        expect(sec!.dominant).toBe(1);

        const rapport2 = mkRapport({
            systemesDetectes: [
                {pos: {x: 3, y: 3}, proprietaires: [2], tour: 100},
                {pos: {x: 4, y: 4}, proprietaires: [3], tour: 100},
            ],
        });
        const data2 = computePresence(rapport2, null, 1);
        expect(data2.sectors.get('0_0')!.dominant).toBe(-1);
    });

    test('un système multi-propriétaires compte pour chacun', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({
            systemesDetectes: [{pos: {x: 3, y: 3}, proprietaires: [2, 5], tour: 100}],
        });
        const data = computePresence(rapport, null, 1);
        const sec = data.sectors.get('0_0')!;
        expect(sec.counts.get(2)).toBe(1);
        expect(sec.counts.get(5)).toBe(1);
        expect(sec.dominant).toBe(-1); // égalité
    });

    test('les détecteurs neutres ne comptent que comme neutres', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({
            systemesDetectes: [{pos: {x: 3, y: 3}, proprietaires: [0], tour: 100}],
        });
        const data = computePresence(rapport, null, 1);
        const sec = data.sectors.get('0_0')!;
        expect(sec.neutral).toBe(1);
        expect(sec.counts.size).toBe(0);
        expect(sec.dominant).toBe(-1);
    });

    test('cases inconnues = carte galactique jamais observée (hors du tore exclue)', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({
            systemesDetectes: [{pos: {x: 10, y: 10}, proprietaires: [4], tour: 100}],
        });
        const global = {
            systemes: [
                {nom: 'A', pos: {x: 10, y: 10}},
                {nom: 'B', pos: {x: 20, y: 20}},
                {nom: 'C', pos: {x: 61, y: 61}},
            ],
        } as any;
        const data = computePresence(rapport, global, 1);
        expect(data.unknownCells.has('10_10')).toBe(false);
        expect(data.unknownCells.has('20_20')).toBe(true);
        expect(data.unknownCells.has('61_61')).toBe(false);
        expect(data.sectors.get('1_1')!.unobserved).toBe(1);
    });

    test('la fraîcheur pèse dans les comptes de secteur', () => {
        reinitialiserBornesGalaxie();
        const rapport = mkRapport({
            systemesDetectes: [
                {pos: {x: 3, y: 3}, proprietaires: [2], tour: 100},   // poids 1
                {pos: {x: 4, y: 4}, proprietaires: [2], tour: 90},   // poids 0 (âge 10)
            ],
        });
        const data = computePresence(rapport, null, 1);
        expect(data.sectors.get('0_0')!.counts.get(2)).toBe(1);
    });
});