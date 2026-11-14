import { TextDecoder as TextDecoderNode, TextEncoder as TextEncoderNode } from 'util';
import { FlotteJoueur } from '../types';
import { deserialiserSchema } from './ordreSchema';
import { ordreDeplacement } from './ordreDeplacement';
import {
    appliquerDivisions,
    compositionParPlan,
    libelleNumFlotte,
    prochainNumeroDivision,
    flotteResultante,
    ordresDivision,
    ordresFlottes,
    ordresFusion,
    positionFinale,
    schemaOrdresFlottes,
} from './ordreFlotte';
import { loadOrdresFlottes, saveOrdresFlottes } from '../storage/ordresFlottesStorage';

// jsdom (jest) ne fournit pas TextEncoder/TextDecoder : on prend ceux de Node
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoderNode;
}
if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as { TextDecoder: unknown }).TextDecoder = TextDecoderNode;
}

const flotte = (num: number, x: number, y: number, vitesse: number, plans: string[] = []): FlotteJoueur => ({
    type: 'joueur', num, nom: `F${num}`, pos: { x, y }, proprio: 1, directive: 0, vitesse, scan: 0,
    nbVso: plans.length, vaisseaux: plans.map(p => ({ type: p, plan: p })),
} as FlotteJoueur);

describe('ordresFusion', () => {
    it('fusionne en chaîne dans la plus petite flotte', () => {
        expect(ordresFusion({ flottes: [7, 2, 4], directive: 3 })).toEqual([
            ['fusionner_flotte', '2', '4', '3'],
            ['fusionner_flotte', '2', '7', '3'],
        ]);
        expect(flotteResultante({ flottes: [7, 2, 4], directive: 3 })).toBe(2);
    });

    it('code la directive avec son paramètre n° (code + 100 × n°)', () => {
        expect(ordresFusion({ flottes: [0, 1], directive: 8, precision: 3 })[0][3]).toBe('308');
        // directive sans paramètre : la précision stockée est ignorée
        expect(ordresFusion({ flottes: [0, 1], directive: 3, precision: 3 })[0][3]).toBe('3');
    });

    it('ignore une fusion de moins de deux flottes', () => {
        expect(ordresFusion({ flottes: [1, 1], directive: 0 })).toEqual([]);
    });
});

describe('ordresDivision', () => {
    it('produit diviser_flotte puis une ligne diviser_flotte_ajouter par plan', () => {
        expect(ordresDivision({ numero: 1, fleetNum: 5, nom: 'Escorte', vaisseaux: { Snip: 2, Bomb: 1, Vide: 0 } })).toEqual([
            ['diviser_flotte', '5', 'Escorte', 'div.1'],
            ['diviser_flotte_ajouter', 'div.1', 'Bomb', '1'],
            ['diviser_flotte_ajouter', 'div.1', 'Snip', '2'],
        ]);
    });

    it('ignore une division sans vaisseau', () => {
        expect(ordresDivision({ numero: 1, fleetNum: 5, nom: 'X', vaisseaux: { Snip: 0 } })).toEqual([]);
    });
});

describe('schemaOrdresFlottes', () => {
    it('met les divisions (par n°) avant les fusions, préfixe « flotte| »', () => {
        const ordres = {
            fusions: [{ flottes: [0, 1], directive: 0 }],
            divisions: [
                { numero: 2, fleetNum: 3, nom: 'B', vaisseaux: { Snip: 1 } },
                { numero: 1, fleetNum: 2, nom: 'A', vaisseaux: { Snip: 1 } },
            ],
        };
        const schema = schemaOrdresFlottes(ordres);
        expect(schema.startsWith('flotte|')).toBe(true);
        expect(deserialiserSchema(schema)).toEqual(ordresFlottes(ordres));
        expect(ordresFlottes(ordres).map(o => o[0] === 'diviser_flotte' ? o[3] : o[0])).toEqual([
            'div.1', 'diviser_flotte_ajouter', 'div.2', 'diviser_flotte_ajouter', 'fusionner_flotte',
        ]);
    });
});

describe('positionFinale', () => {
    it('reste sur place sans déplacement, arrive si à portée, sinon hors de portée', () => {
        const f = flotte(0, 10, 10, 2);
        expect(positionFinale(f, undefined)).toEqual({ pos: { x: 10, y: 10 }, arrive: false, horsPortee: false });
        expect(positionFinale(f, { to: { x: 12, y: 11 }, directive: 0, strategy: '' }).horsPortee).toBe(false);
        expect(positionFinale(f, { to: { x: 13, y: 10 }, directive: 0, strategy: '' }).horsPortee).toBe(true);
    });
});

describe('compositionParPlan', () => {
    it('compte les vaisseaux par plan', () => {
        expect(compositionParPlan(flotte(0, 0, 0, 1, ['Snip', 'Snip', 'Bomb']))).toEqual({ Snip: 2, Bomb: 1 });
    });
});

describe('stockage des ordres de flottes', () => {
    it('relit ce qui a été sauvegardé et ignore les entrées illisibles', () => {
        saveOrdresFlottes(42, { fusions: [{ flottes: [0, 1], directive: 8, precision: 2 }], divisions: [{ numero: 4, fleetNum: 3, nom: 'X', vaisseaux: { Snip: 1 } }] });
        expect(loadOrdresFlottes(42)).toEqual({ fusions: [{ flottes: [0, 1], directive: 8, precision: 2 }], divisions: [{ numero: 4, fleetNum: 3, nom: 'X', vaisseaux: { Snip: 1 } }] });
        localStorage.setItem('flottes_ordres_tour_43', JSON.stringify({ fusions: [{ flottes: 'x' }], divisions: [null] }));
        expect(loadOrdresFlottes(43)).toEqual({ fusions: [], divisions: [] });
    });
});

describe('flottes divisées', () => {
    const flottes = [flotte(0, 5, 5, 3, ['Snip', 'Snip', 'Bomb']), flotte(1, 9, 9, 2, ['Snip'])];

    it('retire les vaisseaux détachés et crée la flotte 10000 + n° sur la même case', () => {
        const apres = appliquerDivisions(flottes, [{ numero: 2, fleetNum: 0, nom: 'Escorte', vaisseaux: { Snip: 1, Bomb: 1 } }]);
        const parent = apres.find(f => f.num === 0)!;
        const nouvelle = apres.find(f => f.num === 10002)!;
        expect(parent.vaisseaux.map(v => v.plan)).toEqual(['Snip']);
        expect(nouvelle).toMatchObject({ nom: 'Escorte', pos: { x: 5, y: 5 }, vitesse: 3, nbVso: 2 });
        expect(compositionParPlan(nouvelle)).toEqual({ Snip: 1, Bomb: 1 });
        // le rapport n'est pas modifié
        expect(flottes[0].vaisseaux).toHaveLength(3);
    });

    it('supprime une flotte vidée et ignore une division sans flotte', () => {
        const apres = appliquerDivisions(flottes, [
            { numero: 1, fleetNum: 1, nom: 'Tout', vaisseaux: { Snip: 1 } },
            { numero: 2, fleetNum: 7, nom: 'Fantôme', vaisseaux: { Snip: 1 } },
        ]);
        expect(apres.map(f => f.num)).toEqual([0, 10001]);
    });

    it('numérote les divisions sans réutiliser un n° plus petit que le dernier', () => {
        expect(prochainNumeroDivision([])).toBe(1);
        expect(prochainNumeroDivision([{ numero: 3, fleetNum: 0, nom: 'a', vaisseaux: {} }])).toBe(4);
    });

    it('met le déplacement et les fusions d\'une flotte divisée dans le schéma, avec la référence div.<n°>', () => {
        const ordres = {
            divisions: [{ numero: 1, fleetNum: 4, nom: 'Escorte', vaisseaux: { Snip: 2 } }],
            fusions: [{ flottes: [10001, 2], directive: 0 }],
        };
        const deplacements = [
            { fleetNum: 10001, to: { x: 12, y: 30 }, directive: 3, strategy: '' },
            { fleetNum: 2, to: { x: 12, y: 30 }, directive: 0, strategy: '' }, // flotte du rapport : schéma de déplacement
        ];
        expect(ordresFlottes(ordres, deplacements)).toEqual([
            ['diviser_flotte', '4', 'Escorte', 'div.1'],
            ['diviser_flotte_ajouter', 'div.1', 'Snip', '2'],
            ['deplacer_flotte', 'div.1', '0_12_30', '3', ''],
            ['fusionner_flotte', '2', 'div.1', '0'],
        ]);
        expect(ordreDeplacement(deplacements[1])[0]).toBe('2');
        expect(libelleNumFlotte(10001)).toBe('div.1');
        expect(libelleNumFlotte(2)).toBe('#03');
    });
});
