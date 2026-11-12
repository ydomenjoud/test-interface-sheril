import { appliquerATous, depasseraitCent, plage, restaurer, valeursAvant } from './revenuMasse';

type Etat = { btech: number; besp: number; bcont: number; politique?: number };

const etats = (): Record<string, Etat> => ({
    a: { btech: 10, besp: 5, bcont: 0, politique: 1 },
    b: { btech: 50, besp: 40, bcont: 0, politique: 2 },
    c: { btech: 0, besp: 0, bcont: 0, politique: 3 },
});

describe('depasseraitCent', () => {
    it('remplace le budget modifié dans le total', () => {
        expect(depasseraitCent({ btech: 50, besp: 40, bcont: 0 }, 'btech', 60)).toBe(false);
        expect(depasseraitCent({ btech: 50, besp: 40, bcont: 0 }, 'btech', 61)).toBe(true);
        expect(depasseraitCent({ btech: 0, besp: 0, bcont: 0 }, 'bcont', 100)).toBe(false);
    });
});

describe('appliquerATous', () => {
    it('ne modifie que les systèmes désignés et ignore les clés inconnues', () => {
        const r = appliquerATous(etats(), ['a', 'c', 'inconnu'], () => ({ btech: 16 }));
        expect(r.a.btech).toBe(16);
        expect(r.b.btech).toBe(50);
        expect(r.c.btech).toBe(16);
        expect(r.a.besp).toBe(5);
        expect(r.inconnu).toBeUndefined();
    });

    it('ne modifie pas les états reçus', () => {
        const avant = etats();
        appliquerATous(avant, ['a'], () => ({ btech: 16 }));
        expect(avant.a.btech).toBe(10);
    });
});

describe('annulation', () => {
    it('restaure les champs modifiés sans perdre les autres saisies', () => {
        const depart = etats();
        const sauvegarde = { a: valeursAvant(depart.a, { btech: 16 }), b: valeursAvant(depart.b, { btech: 16 }) };
        let r = appliquerATous(depart, ['a', 'b'], () => ({ btech: 16 }));
        // saisie manuelle d'un autre champ après l'action de masse
        r = { ...r, a: { ...r.a, politique: 9 } };
        r = restaurer(r, sauvegarde);
        expect(r.a).toEqual({ btech: 10, besp: 5, bcont: 0, politique: 9 });
        expect(r.b.btech).toBe(50);
        expect(r.c).toEqual(depart.c);
    });
});

describe('plage', () => {
    it('renvoie les clés entre deux index, dans les deux sens', () => {
        expect(plage(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['b', 'c', 'd']);
        expect(plage(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['a', 'b', 'c']);
    });
});
