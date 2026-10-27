import { TextDecoder as TextDecoderNode, TextEncoder as TextEncoderNode } from 'util';
import { SEPARATEUR_SCHEMA, codePositionOrdre, copierSchema, deserialiserSchema, serialiserSchema } from './ordreSchema';
import { DIRECTIVE_CDT, OPTIONS_DIRECTIVES, ordreDeplacement, schemaDeplacements } from './ordreDeplacement';
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
    it('construit [num de flotte, destination, directive, stratégie]', () => {
        const d = {fleetNum: 7, to: {x: 3, y: 4}, directive: 2, strategy: ''};
        expect(ordreDeplacement(d)).toEqual(['7', '0_3_4', '2', '']);
    });

    it('emporte la stratégie quand elle est fournie', () => {
        const d = {fleetNum: 7, to: {x: 3, y: 4}, directive: 1, strategy: 'patrouille'};
        expect(ordreDeplacement(d)).toEqual(['7', '0_3_4', '1', 'patrouille']);
    });

    it('pique le commandant visé dans la directive (308 = 8 + 100×3, flottes du commandant 3)', () => {
        const d = {fleetNum: 7, to: {x: 3, y: 4}, directive: DIRECTIVE_CDT, strategy: '', precision: 3};
        expect(ordreDeplacement(d)).toEqual(['7', '0_3_4', '308', '']);
    });

    it('pique la planète visée dans la directive (705 = 5 + 100×7, attaque de la planète 7)', () => {
        const d = {fleetNum: 7, to: {x: 3, y: 4}, directive: 5, strategy: '', precision: 7};
        expect(ordreDeplacement(d)).toEqual(['7', '0_3_4', '705', '']);
    });

    it('la directive cdt sans commandant visé utilise le neutre (8 = 8 + 100×0)', () => {
        const d = {fleetNum: 7, to: {x: 3, y: 4}, directive: DIRECTIVE_CDT, strategy: ''};
        expect(ordreDeplacement(d)).toEqual(['7', '0_3_4', '8', '']);
    });

    it('les directives sans paramètre ignorent toute précision', () => {
        const d = {fleetNum: 7, to: {x: 3, y: 4}, directive: 1, strategy: '', precision: 9};
        expect(ordreDeplacement(d)).toEqual(['7', '0_3_4', '1', '']);
    });
});

describe('OPTIONS_DIRECTIVES (codes du jeu)', () => {
    it('les 9 directives de la règle 4.4, codes réels du jeu, dans l\'ordre de résolution du jeu', () => {
        // ordre de Combat.java : cdt → préventive → toute flotte → système → pillage système →
        // attaque planète → pillage planète → éradication (neutre passive, en dernier)
        expect(OPTIONS_DIRECTIVES.map(o => o.value)).toEqual([8, 2, 3, 1, 4, 5, 6, 7, 0]);
        expect(OPTIONS_DIRECTIVES[0].label).toBe('Attaque flottes cdt');
        expect(OPTIONS_DIRECTIVES[0].precision).toBe('commandant');
        expect(OPTIONS_DIRECTIVES[8].label).toBe('Attitude neutre');
        expect(OPTIONS_DIRECTIVES.filter(o => o.precision === 'planete').map(o => o.value)).toEqual([5, 6, 7]);
    });
});

describe('schemaDeplacements', () => {
    it('tri par num de flotte (1, 2, 10) et reserialise en 3 ordres (directive/stratégie propres à chaque ordre)', () => {
        const deplacements = [
            {fleetNum: 2, to: {x: 5, y: 5}, directive: 2, strategy: ''},
            {fleetNum: 10, to: {x: 6, y: 6}, directive: 3, strategy: ''},
            {fleetNum: 1, to: {x: 7, y: 7}, directive: DIRECTIVE_CDT, strategy: '', precision: 2},
        ];
        // la flotte 1 a la directive cdt : son ordre porte le commandant visé dans la directive (208 = 8 + 100×2)
        expect(deserialiserSchema(schemaDeplacements(deplacements))).toEqual([
            ['1', '0_7_7', '208', ''],
            ['2', '0_5_5', '2', ''],
            ['10', '0_6_6', '3', ''],
        ]);
    });

    it('emporte le nom de la stratégie de combat dans le schéma sérialisé (4e champ de l\'ordre)', () => {
        const deplacements = [
            {fleetNum: 2, to: {x: 5, y: 5}, directive: 2, strategy: 'Essai'},
            {fleetNum: 1, to: {x: 7, y: 7}, directive: 1, strategy: ''},
        ];
        expect(deserialiserSchema(schemaDeplacements(deplacements))).toEqual([
            ['1', '0_7_7', '1', ''],
            ['2', '0_5_5', '2', 'Essai'],
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

    it('relit ce qui a été sauvegardé (clés numériques reconverties, directive/stratégie/precision conservées)', () => {
        saveDeplacements(42, {
            1: {to: {x: 1, y: 2}, directive: 4, strategy: 'prudence'},
            10: {to: {x: 3, y: 4}, directive: 8, strategy: '', precision: 2},
        });
        expect(loadDeplacements(42)).toEqual({
            1: {to: {x: 1, y: 2}, directive: 4, strategy: 'prudence'},
            10: {to: {x: 3, y: 4}, directive: 8, strategy: '', precision: 2},
        });
    });

    it('relit le format le plus ancien (position seule) avec la directive par défaut et une stratégie vide', () => {
        localStorage.setItem('deplacements_tour_42', JSON.stringify({1: {x: 1, y: 2}}));
        expect(loadDeplacements(42)).toEqual({1: {to: {x: 1, y: 2}, directive: 1, strategy: ''}});
    });

    it('migre le format placeholder (codes directives provisoires, cdt, stratégie en nombre)', () => {
        localStorage.setItem('deplacements_tour_42', JSON.stringify({
            1: {to: {x: 1, y: 2}, directive: 3, strategy: 0},  // « Attaque système » (ancien code 3) → code réel 1
            2: {to: {x: 3, y: 4}, directive: 0, strategy: 1, cdt: 4},  // « Attaque flottes cdt » (ancien code 0) → 8, cdt → precision
        }));
        expect(loadDeplacements(42)).toEqual({
            1: {to: {x: 1, y: 2}, directive: 1, strategy: ''},
            2: {to: {x: 3, y: 4}, directive: 8, strategy: '', precision: 4},
        });
    });

    it('clearDeplacements efface le tour', () => {
        saveDeplacements(42, {1: {to: {x: 1, y: 2}, directive: 1, strategy: ''}});
        clearDeplacements(42);
        expect(loadDeplacements(42)).toEqual({});
    });
});