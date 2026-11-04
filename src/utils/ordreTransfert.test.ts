import { TextDecoder, TextEncoder } from 'util';
import { SystemeJoueur } from '../types';
import { deserialiserSchema } from './ordreSchema';
import {
    inventaireDuRapport, lireOrdreTransfert, nombreMaxTransferts, ordreTransfert, quantite,
    schemaTransferts, simulerTransferts, TransfertOrdre,
} from './ordreTransfert';

// jsdom ne fournit pas TextEncoder/TextDecoder (utilisés par le schéma)
Object.assign(global, { TextEncoder, TextDecoder });

const MOI = 3;

const planete = (num: number, minerai: number, batiments: Record<string, number> = {}, proprietaire = MOI) => ({
    num, proprietaire, pdc: 0, minerai, prodMinerai: 0,
    batiments: Object.entries(batiments).map(([techCode, count]) => ({ techCode, count })),
    populations: [], tax: 0, atmosphere: 0, gravity: 0, radiation: 0, temperature: 0, terraformation: 0, size: 0, stab: 0,
});

const systeme = (x: number, planetes: ReturnType<typeof planete>[], marchandises: { code: number; stock: number }[] = [], nbPla = planetes.length): SystemeJoueur => ({
    type: 'joueur', nom: `S${x}`, pos: { x, y: 1 }, typeEtoile: 0, nbPla, proprietaires: [MOI],
    planetes, revenuEstime: 0, scan: 0, evostab: [],
    marchandises: marchandises.map(m => ({ ...m, prod: 0 })),
});

const ordre = (o: Partial<TransfertOrdre>): TransfertOrdre => ({
    id: Math.random().toString(), de: { x: 1, y: 1 }, vers: { x: 2, y: 1 }, code: 'minerai', nombre: 1,
    planeteDe: null, planeteVers: null, ...o,
});

describe('transferts entre systèmes', () => {
    test('ordre : [départ, code, nombre, planète départ, arrivée, planète arrivée], 100 = planète non précisée', () => {
        const o = ordre({ code: 'mineII', nombre: 2, planeteDe: 0, planeteVers: null });
        expect(ordreTransfert(o)).toEqual(['0_1_1', 'mineII', '2', '0', '0_2_1', '100']);
        const relu = lireOrdreTransfert(deserialiserSchema(schemaTransferts([o]))[0]);
        expect(relu).toMatchObject({ de: o.de, vers: o.vers, code: 'mineII', nombre: 2, planeteDe: 0, planeteVers: null });
        expect(schemaTransferts([o]).startsWith('transfert|')).toBe(true);
    });

    test('limite : 1 + systèmes possédés à plus de 75 % + 2 par niveau de maîtrise spatiale', () => {
        const systemes = [
            systeme(1, [planete(0, 0), planete(1, 0), planete(2, 0), planete(3, 0)]),            // 100 %
            systeme(2, [planete(0, 0), planete(1, 0), planete(2, 0), planete(3, 0, {}, 9)]),     // 75 % : non
        ];
        expect(nombreMaxTransferts(systemes, MOI, ['maitstargateI', 'maitstargateII'])).toEqual({
            base: 1, systemes75: 1, niveauMaitrise: 2, total: 6,
        });
    });

    test('simulation : partiel, saturation, marchandise vide, répartition du minerai', () => {
        const systemes = [
            systeme(1, [planete(0, 30), planete(1, 10, { mineII: 3 })], [{ code: 5, stock: 4 }]),
            systeme(2, [planete(0, 0), planete(1, 0)]),
        ];
        const avant = inventaireDuRapport(systemes, MOI);
        const ordres = [
            ordre({ id: 'a', nombre: 25 }),                        // 25 minerai, réparti au départ et à l'arrivée
            ordre({ id: 'b', code: '5', nombre: 10 }),             // 4 robots sur 10 : partiel
            ordre({ id: 'c', code: '7', nombre: 1 }),              // marchandise absente : erreur, ne compte pas
            ordre({ id: 'd', code: 'mineII', nombre: 1, planeteVers: 1 }), // 3e transfert compté
            ordre({ id: 'e', code: 'mineII', nombre: 1 }),         // au-delà de la limite
        ];
        const sim = simulerTransferts(avant, ordres, 3);
        expect(sim.resultats.a).toEqual({ statut: 'ok', transfere: 25 });
        expect(sim.resultats.b.statut).toBe('partiel');
        expect(sim.resultats.b.transfere).toBe(4);
        expect(sim.resultats.c.statut).toBe('erreur');
        expect(sim.resultats.d).toEqual({ statut: 'ok', transfere: 1 });
        expect(sim.resultats.e.statut).toBe('ignore');
        expect(sim.utilises).toBe(3);
        expect(quantite(sim.apres['1_1'], 'minerai')).toBe(15);
        expect(sim.apres['1_1'].planetes.map(p => p.minerai)).toEqual([15, 0]);
        expect(sim.apres['2_1'].planetes.map(p => p.minerai)).toEqual([13, 12]);
        expect(quantite(sim.apres['2_1'], '5')).toBe(4);
        expect(quantite(sim.apres['1_1'], 'mineII')).toBe(2);
        expect(sim.apres['2_1'].planetes[1].batiments.mineII).toBe(1);
        // L'inventaire du rapport n'est pas modifié
        expect(quantite(avant['1_1'], 'minerai')).toBe(40);
    });

    test('planète inexistante ou système non possédé : erreur', () => {
        const avant = inventaireDuRapport([systeme(1, [planete(0, 5)]), systeme(2, [planete(0, 0)])], MOI);
        const sim = simulerTransferts(avant, [
            ordre({ id: 'a', planeteDe: 3 }),
            ordre({ id: 'b', vers: { x: 9, y: 9 } }),
        ], 5);
        expect(sim.resultats.a.statut).toBe('erreur');
        expect(sim.resultats.b.statut).toBe('erreur');
        expect(sim.utilises).toBe(0);
    });
});
