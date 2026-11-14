import { bilansCapitales, modificateurPosition, modificateurStabiliteCapitale, MODIFICATEURS_STABILITE_CAPITALE_DEFAUT, nouvelleCapitaleOrdonnee } from './capitale';
import { saveCapitaleRevenu } from './planificationRevenuStorage';
import { Rapport } from '../types';

describe('modificateurStabiliteCapitale', () => {
    it('suit le barème du moteur, seuils exclusifs', () => {
        const attendus: [number, number][] = [
            [0, 3], [1, 2], [2, 2], [3, 1], [4, 1], [5, 0], [6, -1], [7, -3], [8, -6], [9, -6], [10, -9], [11, -16], [30, -16],
        ];
        attendus.forEach(([d, m]) => expect(modificateurStabiliteCapitale(d)).toBe(m));
    });

    it('applique le malus maximal sans capitale', () => {
        expect(modificateurStabiliteCapitale(null)).toBe(-16);
    });

    it('accepte un barème non trié (data.xml)', () => {
        const melange = [...MODIFICATEURS_STABILITE_CAPITALE_DEFAUT].reverse();
        expect(modificateurStabiliteCapitale(6, melange)).toBe(-1);
        expect(modificateurStabiliteCapitale(0, melange)).toBe(3);
    });

    it('se rabat sur le barème du moteur si data.xml est vide', () => {
        expect(modificateurStabiliteCapitale(3, [])).toBe(1);
    });
});

describe('modificateurPosition', () => {
    // Valeurs du rapport exemple (sample/rapport.xml, capitale 2_1, galaxie 60×60)
    it('retrouve les modificateurs « position » du rapport, avec le passage des bords', () => {
        const capitale = { x: 2, y: 1 };
        expect(modificateurPosition({ x: 2, y: 1 }, capitale)).toBe(3);
        expect(modificateurPosition({ x: 3, y: 2 }, capitale)).toBe(2);
        expect(modificateurPosition({ x: 4, y: 59 }, capitale)).toBe(2);
        expect(modificateurPosition({ x: 5, y: 57 }, capitale)).toBe(1);
        expect(modificateurPosition({ x: 59, y: 4 }, capitale)).toBe(1);
        expect(modificateurPosition({ x: 60, y: 7 }, capitale)).toBe(-1);
    });

    it('applique le malus maximal sans capitale', () => {
        expect(modificateurPosition({ x: 5, y: 5 }, null)).toBe(-16);
    });
});

describe('bilansCapitales', () => {
    it('classe les capitales de la meilleure à la moins bonne', () => {
        const systemes = [{ x: 10, y: 10 }, { x: 12, y: 10 }, { x: 20, y: 10 }];
        const bilans = bilansCapitales(systemes);
        expect(bilans.map(b => b.cle)).toEqual(['12_10', '10_10', '20_10']);
        // capitale 12_10 : +2 (distance 2), +3 (elle-même), −6 (distance 8)
        expect(bilans[0]).toMatchObject({ total: 2 + 3 - 6, nbMalus: 1, pire: -6 });
        // capitale 10_10 : +3, +2, −9 (distance 10)
        expect(bilans[1]).toMatchObject({ total: 3 + 2 - 9, nbMalus: 1, pire: -9 });
        // capitale 20_10 : −9 (distance 10), −6 (distance 8), +3
        expect(bilans[2]).toMatchObject({ total: -9 - 6 + 3, nbMalus: 2, pire: -9 });
    });

    it('renvoie une liste vide sans système', () => {
        expect(bilansCapitales([])).toEqual([]);
    });
});

describe('nouvelleCapitaleOrdonnee', () => {
    const rapport = {
        tour: 16,
        joueur: { capitale: { x: 2, y: 1 } },
        systemesJoueur: [{ pos: { x: 2, y: 1 } }, { pos: { x: 8, y: 9 } }],
    } as unknown as Rapport;

    afterEach(() => localStorage.clear());

    it("renvoie la capitale choisie dans l'écran Revenus pour le tour du rapport", () => {
        saveCapitaleRevenu(16, '8_9');
        expect(nouvelleCapitaleOrdonnee(rapport)).toEqual({ x: 8, y: 9 });
    });

    it("ignore l'absence d'ordre, un autre tour, la capitale actuelle et un système qui n'est pas au joueur", () => {
        expect(nouvelleCapitaleOrdonnee(rapport)).toBeNull();
        saveCapitaleRevenu(15, '8_9');
        expect(nouvelleCapitaleOrdonnee(rapport)).toBeNull();
        saveCapitaleRevenu(16, '2_1');
        expect(nouvelleCapitaleOrdonnee(rapport)).toBeNull();
        saveCapitaleRevenu(16, '30_30');
        expect(nouvelleCapitaleOrdonnee(rapport)).toBeNull();
        expect(nouvelleCapitaleOrdonnee(undefined)).toBeNull();
    });
});
