import * as fs from 'fs';
import { parseRapportXml } from '../parsers/parseRapport';
import { posToString } from './position';
import {
    bonusPdcGouverneur,
    gouverneursParPosition,
    modificateurPdcPolitique,
    pdcSysteme,
} from './pdc';
import { Lieutenant, SystemeJoueur } from '../types';

// Garde de régression : la formule de pdcSysteme doit reproduire l'attribut pdc du rapport
const rapport = parseRapportXml(fs.readFileSync('public/examples/rapport.xml', 'utf8'));

describe('pdcSysteme', () => {
    it("reproduit le pdc de tous les systèmes du rapport d'exemple", () => {
        expect(rapport.systemesJoueur.length).toBeGreaterThanOrEqual(21);
        const gouverneurs = gouverneursParPosition(rapport.lieutenants);
        rapport.systemesJoueur.forEach(s => {
            const gouverneur = gouverneurs[posToString(s.pos)];
            expect(pdcSysteme(s, rapport.joueur.numero, gouverneur, s.politique)).toBe(s.pdc);
        });
    });

    const systemeAvecRobots = (stock: number): SystemeJoueur => ({
        type: 'joueur',
        nom: 'Test',
        pos: { x: 1, y: 1 },
        typeEtoile: 0,
        nbPla: 1,
        proprietaires: [1],
        planetes: [{
            num: 0, proprietaire: 1, pdc: 10,
            batiments: [], populations: [],
            tax: 0, atmosphere: 0, gravity: 0, radiation: 0, temperature: 0, terraformation: 0, size: 0, stab: 0,
        }],
        revenuEstime: 0,
        scan: 0,
        evostab: [],
        marchandises: [{ code: 7, stock, prod: 0 }],
    });

    it('ajoute le bonus robots (+5) quand le stock de robots est ≥ 100', () => {
        expect(pdcSysteme(systemeAvecRobots(100), 1, undefined, undefined)).toBe(15);
    });

    it("n'ajoute pas le bonus robots quand le stock est < 100", () => {
        expect(pdcSysteme(systemeAvecRobots(99), 1, undefined, undefined)).toBe(10);
    });
});

describe('bonusPdcGouverneur', () => {
    const gouverneur: Lieutenant = {
        nom: 'Test', type: 1, pos: '0_1_1', raceId: 1, niv: 1, exp: 0, valeur: 0,
        att: 0, def: 0, mar: 0, mor: 0, vit: 4, competences: [],
    };

    it('sans gouverneur : 0', () => {
        expect(bonusPdcGouverneur(undefined)).toBe(0);
    });

    it('vit 4 sans maîtrise de la vitesse : 4', () => {
        expect(bonusPdcGouverneur(gouverneur)).toBe(4);
    });

    it('vit 4 avec maîtrise de la vitesse niveau 1 : floor(4 × 1,5) = 6', () => {
        expect(bonusPdcGouverneur({ ...gouverneur, competences: [{ comp: 0, val: 1 }] })).toBe(6);
    });

    it('vit 3 avec la compétence 0 présente à valeur 0 (niveau 1) : floor(3 × 1,5) = 4', () => {
        expect(bonusPdcGouverneur({ ...gouverneur, vit: 3, competences: [{ comp: 0, val: 0 }] })).toBe(4);
    });
});

describe('modificateurPdcPolitique', () => {
    it('construction (3) : ×1,5', () => {
        expect(modificateurPdcPolitique(3)).toBe(1.5);
    });

    it('esclavagiste (7) : ×2', () => {
        expect(modificateurPdcPolitique(7)).toBe(2);
    });

    it('autre politique (0) : ×1', () => {
        expect(modificateurPdcPolitique(0)).toBe(1);
    });

    it('politique absente : ×1', () => {
        expect(modificateurPdcPolitique(undefined)).toBe(1);
    });
});