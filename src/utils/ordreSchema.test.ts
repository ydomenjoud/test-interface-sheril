import { TextDecoder as TextDecoderNode, TextEncoder as TextEncoderNode } from 'util';
import { SEPARATEUR_SCHEMA, codePositionOrdre, copierSchema, deserialiserSchema, serialiserSchema } from './ordreSchema';
import { ordreDeplacement, schemaDeplacements } from './ordreDeplacement';
import { clearDeplacements, loadDeplacements, saveDeplacements } from '../storage/deplacementOrdersStorage';

// jsdom (jest) ne fournit pas TextEncoder/TextDecoder : on prend ceux de Node
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoderNode;
}
if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as { TextDecoder: unknown }).TextDecoder = TextDecoderNode;
}

describe('codePositionOrdre', () => {
    it('code une position en « 0_x_y »', () => {
        expect(codePositionOrdre({x: 3, y: 7})).toBe('0_3_7');
    });
});

describe('serialiserSchema / deserialiserSchema', () => {
    it('retrouve les ordres après serialisation', () => {
        const ordres = [['a', '0_1_2', '3'], ['b', '0_3_4']];
        expect(deserialiserSchema(serialiserSchema(ordres))).toEqual(ordres);
    });

    it('joint les paramètres par « : » et les ordres par SEPARATEUR_SCHEMA, en base64', () => {
        expect(serialiserSchema([['a', '0_1_2', '3'], ['b', '0_3_4']]))
            .toBe(btoa(`a:0_1_2:3${SEPARATEUR_SCHEMA}b:0_3_4`));
    });

    it('gère les caractères non ASCII (UTF-8)', () => {
        const ordres = [['a', 'gouverneur_étoile', '0_4_6']];
        expect(deserialiserSchema(serialiserSchema(ordres))).toEqual(ordres);
    });
});

describe('copierSchema', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('copie le schéma dans le presse-papiers et retourne true', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
        const ok = await copierSchema('le_schema');
        expect(ok).toBe(true);
        expect(writeText).toHaveBeenCalledWith('le_schema');
    });

    it('retourne false si la copie échoue', async () => {
        const writeText = jest.fn().mockRejectedValue(new Error('refusé'));
        Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const ok = await copierSchema('le_schema');
        expect(ok).toBe(false);
        expect(spy).toHaveBeenCalled();
    });
});

describe('ordreDeplacement', () => {
    it('construit [table, num de flotte, destination, directive, stratégie]', () => {
        const d = {fleetNum: 7, from: {x: 1, y: 2}, to: {x: 3, y: 4}, directive: 2, strategy: 5};
        expect(ordreDeplacement(d)).toEqual(['deplacement_flotte', '7', '0_3_4', '2', '5']);
    });
});

describe('schemaDeplacements', () => {
    it('tri par num de flotte (1, 2, 10) et reserialise en 3 ordres (directive/stratégie propres à chaque ordre)', () => {
        const deplacements = [
            {fleetNum: 2, from: {x: 0, y: 0}, to: {x: 5, y: 5}, directive: 1, strategy: 0},
            {fleetNum: 10, from: {x: 0, y: 0}, to: {x: 6, y: 6}, directive: 3, strategy: 2},
            {fleetNum: 1, from: {x: 0, y: 0}, to: {x: 7, y: 7}, directive: 0, strategy: 1},
        ];
        expect(deserialiserSchema(schemaDeplacements(deplacements))).toEqual([
            ['deplacement_flotte', '1', '0_7_7', '0', '1'],
            ['deplacement_flotte', '2', '0_5_5', '1', '0'],
            ['deplacement_flotte', '10', '0_6_6', '3', '2'],
        ]);
    });
});

describe('deplacementOrdersStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('retourne {} si rien n\'est stocké', () => {
        expect(loadDeplacements(42)).toEqual({});
    });

    it('retourne {} si les données sont corrompues', () => {
        localStorage.setItem('deplacements_tour_42', '{corrompu');
        expect(loadDeplacements(42)).toEqual({});
    });

    it('relit ce qui a été sauvegardé (clés numériques reconverties, directive/stratégie conservées)', () => {
        saveDeplacements(42, {
            1: {to: {x: 1, y: 2}, directive: 4, strategy: 2},
            10: {to: {x: 3, y: 4}, directive: 0, strategy: 0},
        });
        expect(loadDeplacements(42)).toEqual({
            1: {to: {x: 1, y: 2}, directive: 4, strategy: 2},
            10: {to: {x: 3, y: 4}, directive: 0, strategy: 0},
        });
    });

    it('relit l\'ancien format (position seule) avec les directive/stratégie par défaut', () => {
        localStorage.setItem('deplacements_tour_42', JSON.stringify({1: {x: 1, y: 2}}));
        expect(loadDeplacements(42)).toEqual({1: {to: {x: 1, y: 2}, directive: 1, strategy: 0}});
    });

    it('clearDeplacements efface le tour', () => {
        saveDeplacements(42, {1: {to: {x: 1, y: 2}, directive: 1, strategy: 0}});
        clearDeplacements(42);
        expect(loadDeplacements(42)).toEqual({});
    });
});