import {Rapport} from '../types';
import {
    BOUNDS,
    appliquerBornesDepuisPositions,
    getTorusDistance,
    positionsDuRapport,
    reinitialiserBornesGalaxie,
    tailleAxeDepuisCoord,
    torusDelta,
    wrapX,
    wrapY,
} from './position';

describe('tailleAxeDepuisCoord', () => {
    test('arrondit le max des coordonnées à la dizaine supérieure', () => {
        expect(tailleAxeDepuisCoord([47, 3, 12])).toBe(50);
        expect(tailleAxeDepuisCoord([53])).toBe(60);
        expect(tailleAxeDepuisCoord([60])).toBe(60);
        expect(tailleAxeDepuisCoord([12])).toBe(20);
        expect(tailleAxeDepuisCoord([5, 0])).toBe(10);
        expect(tailleAxeDepuisCoord([10])).toBe(10);
    });
});

describe('appliquerBornesDepuisPositions', () => {
    afterEach(reinitialiserBornesGalaxie);

    test('recalcule les bornes par axe (in place sur BOUNDS)', () => {
        appliquerBornesDepuisPositions([{x: 47, y: 53}, {x: 3, y: 9}]);
        expect(BOUNDS.minX).toBe(0);
        expect(BOUNDS.maxX).toBe(50);
        expect(BOUNDS.minY).toBe(0);
        expect(BOUNDS.maxY).toBe(60);
    });

    test('une liste vide ne modifie pas les bornes', () => {
        reinitialiserBornesGalaxie();
        appliquerBornesDepuisPositions([]);
        expect(BOUNDS.maxX).toBe(60);
        expect(BOUNDS.maxY).toBe(60);
    });

    test('le calcul torique suit les bornes recalculées', () => {
        // Avec les bornes par défaut 60×60, (1,1)→(40,1) vaut 21
        expect(getTorusDistance({x: 1, y: 1}, {x: 40, y: 1})).toBe(21);
        // Diagonale avec enroulement sur les deux axes (l'axe Y est aussi vérifié)
        expect(getTorusDistance({x: 1, y: 1}, {x: 59, y: 60})).toBe(2);
        // Sur une galaxie 40×40, la colonne 40 est voisine de la colonne 1 (enroulement)
        appliquerBornesDepuisPositions([{x: 40, y: 40}]);
        expect(getTorusDistance({x: 1, y: 1}, {x: 40, y: 1})).toBe(1);
        expect(getTorusDistance({x: 1, y: 1}, {x: 40, y: 40})).toBe(1); // diagonale, enroulement X et Y
        expect(wrapX(41)).toBe(1);
        expect(wrapY(41)).toBe(1);
        expect(wrapY(0)).toBe(40);
        expect(torusDelta(40, 1, 40)).toBe(1);
        expect(torusDelta(1, -1, 40)).toBe(40);
    });
});

describe('positionsDuRapport', () => {
    test('collecte capitale, systèmes, détections et flottes', () => {
        const rapport = {
            joueur: {capitale: {x: 5, y: 6}},
            systemesJoueur: [{pos: {x: 10, y: 11}}],
            systemesDetectes: [{pos: {x: 20, y: 21}}],
            flottesJoueur: [{pos: {x: 30, y: 31}}],
            flottesDetectees: [{pos: {x: 40, y: 41}}],
        } as unknown as Rapport;
        const positions = positionsDuRapport(rapport);
        expect(positions).toHaveLength(5);
        expect(positions).toContainEqual({x: 5, y: 6});
        expect(positions).toContainEqual({x: 40, y: 41});
    });
});