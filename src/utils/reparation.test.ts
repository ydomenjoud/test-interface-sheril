import {GlobalData, Planete} from '../types';
import {capaciteReparation} from './reparation';

const planetes = (batiments: {techCode: string; count: number}[][]): Planete[] =>
    batiments.map(bat => ({batiments: bat} as Planete));

describe('capaciteReparation (valeurs de secours, sans data.xml)', () => {
    test('20 par chantierI + valeur du centre de réparation', () => {
        // 2×chantierI + 1×repareII = 2×20 + 400
        expect(capaciteReparation(planetes([[{techCode: 'chantierI', count: 2}, {techCode: 'repareII', count: 1}]]))).toBe(440);
    });

    test('tous les niveaux de centre', () => {
        expect(capaciteReparation(planetes([[
            {techCode: 'repareI', count: 1},
            {techCode: 'repareIII', count: 1},
            {techCode: 'repareV', count: 2},
        ]]))).toBe(100 + 1350 + 2 * 6250);
    });

    test('les bâtiments sans caractéristique de réparation ne comptent pas', () => {
        expect(capaciteReparation(planetes([[{techCode: 'mineI', count: 9}, {techCode: 'optpIV', count: 1}]]))).toBe(0);
    });

    test("plusieurs planètes : les capacités s'additionnent", () => {
        expect(capaciteReparation(planetes([[{techCode: 'chantierI', count: 1}], [{techCode: 'chantierI', count: 1}]]))).toBe(40);
    });

    test('aucune planète : 0', () => {
        expect(capaciteReparation(undefined)).toBe(0);
        expect(capaciteReparation([])).toBe(0);
    });
});

describe('capaciteReparation (valeurs de data.xml)', () => {
    const globalData = {
        caracteristiquesBatiment: {'5': 'capacité réparation vaisseaux'},
        technologies: [
            {code: 'chantierI', type: 0, caracteristiques: [{code: 5, value: 20}]},
            {code: 'repareI', type: 0, caracteristiques: [{code: 5, value: 100}]},
            {code: 'mineI', type: 0, caracteristiques: [{code: 1, value: 12}]},
        ],
    } as unknown as GlobalData;

    test('utilise la caractéristique 5 des bâtiments connus', () => {
        expect(capaciteReparation(planetes([[{techCode: 'repareI', count: 2}, {techCode: 'mineI', count: 3}]]), globalData)).toBe(200);
    });

    test('retombe sur les valeurs de secours pour un bâtiment absent de data.xml', () => {
        // repareIV n'est pas dans ce data.xml fictif : la valeur de secours (3200) est utilisée
        expect(capaciteReparation(planetes([[{techCode: 'repareIV', count: 1}]]), globalData)).toBe(3200);
    });

    test('ignore les composants (type 1) : leur code 5 est une autre caractéristique', () => {
        const withComposant = {
            ...globalData,
            technologies: [
                ...globalData.technologies,
                {code: 'lmineI', type: 1, caracteristiques: [{code: 5, value: 9999}]},
            ],
        } as unknown as GlobalData;
        // lmineI est un composant : même s'il a un « code 5 », il ne doit pas être compté comme réparation
        expect(capaciteReparation(planetes([[{techCode: 'lmineI', count: 3}]]), withComposant)).toBe(0);
    });
});