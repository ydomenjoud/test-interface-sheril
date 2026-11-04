import { SystemeJoueur, XY } from '../types';
import { ajouterPrefixeSchema, codePositionOrdre, serialiserSchema } from './ordreSchema';
import { posToString } from './position';

// Schéma d'ordres de transfert entre systèmes (console d'ordres du jeu, table « charger_cargo »).
// Règles du moteur : docs/transferts.md.
//
// Forme d'un ordre : [0_x_y départ, code, nombre, planète départ, 0_x_y arrivée, planète arrivée]
// - code = code technologique d'un bâtiment, « minerai », ou n° de marchandise ;
// - planète = n° 0-based (l'interface affiche n° + 1), 100 = non précisée.

export const CODE_MINERAI = 'minerai';
export const PLANETE_NON_PRECISEE = 100;

export type TypeObjet = 'minerai' | 'batiment' | 'marchandise';

export const typeObjet = (code: string): TypeObjet =>
    code === CODE_MINERAI ? 'minerai' : /^\d+$/.test(code) ? 'marchandise' : 'batiment';

export interface TransfertOrdre {
    id: string;
    de: XY;
    vers: XY;
    code: string;
    nombre: number;
    planeteDe: number | null;   // null = non précisée
    planeteVers: number | null; // null = non précisée
}

let compteurId = 0;
export const nouvelIdTransfert = (): string => `t${Date.now().toString(36)}-${(compteurId++).toString(36)}`;

export const ordreTransfert = (t: TransfertOrdre): string[] => [
    codePositionOrdre(t.de),
    t.code,
    String(Math.max(0, Math.floor(t.nombre))),
    String(t.planeteDe ?? PLANETE_NON_PRECISEE),
    codePositionOrdre(t.vers),
    String(t.planeteVers ?? PLANETE_NON_PRECISEE),
];

export const schemaTransferts = (ordres: TransfertOrdre[]): string =>
    ordres.length === 0 ? '' : ajouterPrefixeSchema('transfert', serialiserSchema(ordres.map(ordreTransfert)));

// Inverse de ordreTransfert ; undefined si l'ordre est illisible
const lirePosition = (s: string): XY | undefined => {
    const m = /^\d+_(\d+)_(\d+)$/.exec(s ?? '');
    return m ? { x: Number(m[1]), y: Number(m[2]) } : undefined;
};
const lirePlanete = (s: string): number | null => {
    const n = Number(s);
    return !Number.isInteger(n) || n < 0 || n === PLANETE_NON_PRECISEE ? null : n;
};
export const lireOrdreTransfert = (champs: string[]): TransfertOrdre | undefined => {
    if (champs.length < 6) return undefined;
    const de = lirePosition(champs[0]);
    const vers = lirePosition(champs[4]);
    const nombre = Number(champs[2]);
    if (!de || !vers || !champs[1] || !Number.isFinite(nombre)) return undefined;
    return {
        id: nouvelIdTransfert(),
        de, vers,
        code: champs[1],
        nombre,
        planeteDe: lirePlanete(champs[3]),
        planeteVers: lirePlanete(champs[5]),
    };
};

// Nombre maximal de transferts par tour (Commandant.getNombreMaximalDeTransfertEntreSysteme) :
// 1 + 1 par système possédé à plus de 75 % + 2 par niveau de maîtrise spatiale (maitstargateI..X)
export interface DetailMaxTransferts {
    base: number;
    systemes75: number;
    niveauMaitrise: number;
    total: number;
}

const NIVEAUX_MAITRISE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export const niveauMaitriseSpatiale = (technologiesConnues: string[]): number => {
    const connues = new Set(technologiesConnues);
    let niveau = 0;
    NIVEAUX_MAITRISE.forEach((r, i) => {
        if (connues.has(`maitstargate${r}`)) niveau = i + 1;
    });
    return niveau;
};

export const nombreMaxTransferts = (systemes: SystemeJoueur[], numeroJoueur: number, technologiesConnues: string[]): DetailMaxTransferts => {
    const systemes75 = systemes.filter(s => {
        const total = s.nbPla || s.planetes.length;
        const miennes = s.planetes.filter(p => p.proprietaire === numeroJoueur).length;
        return total > 0 && miennes / total > 0.75;
    }).length;
    const niveauMaitrise = niveauMaitriseSpatiale(technologiesConnues);
    return { base: 1, systemes75, niveauMaitrise, total: 1 + systemes75 + 2 * niveauMaitrise };
};

// ---------------------------------------------------------------------------------------------
// Simulation des transferts, dans l'ordre de saisie, comme le moteur (Commandant.transfererEntreSysteme)

export interface PlaneteStock {
    num: number;
    mienne: boolean;
    minerai: number;
    batiments: Record<string, number>;
}

export interface InventaireSysteme {
    nbPla: number;
    planetes: PlaneteStock[];
    marchandises: Record<string, number>;
}

export type Inventaires = Record<string, InventaireSysteme>; // clé : posToString

export const inventaireDuRapport = (systemes: SystemeJoueur[], numeroJoueur: number): Inventaires => {
    const inv: Inventaires = {};
    systemes.forEach(s => {
        const marchandises: Record<string, number> = {};
        (s.marchandises ?? []).forEach(m => {
            if (m.stock > 0) marchandises[String(m.code)] = m.stock;
        });
        inv[posToString(s.pos)] = {
            nbPla: s.nbPla || s.planetes.length,
            planetes: s.planetes.map(p => {
                const batiments: Record<string, number> = {};
                p.batiments.forEach(b => {
                    batiments[b.techCode] = (batiments[b.techCode] ?? 0) + b.count;
                });
                return { num: p.num, mienne: p.proprietaire === numeroJoueur, minerai: p.minerai ?? 0, batiments };
            }),
            marchandises,
        };
    });
    return inv;
};

const copierInventaires = (inv: Inventaires): Inventaires => {
    const copie: Inventaires = {};
    Object.entries(inv).forEach(([k, s]) => {
        copie[k] = {
            nbPla: s.nbPla,
            planetes: s.planetes.map(p => ({ ...p, batiments: { ...p.batiments } })),
            marchandises: { ...s.marchandises },
        };
    });
    return copie;
};

// Quantité d'un objet sur un système (ou une seule planète)
export const quantite = (s: InventaireSysteme | undefined, code: string, planete: number | null = null): number => {
    if (!s) return 0;
    const type = typeObjet(code);
    if (type === 'marchandise') return s.marchandises[code] ?? 0;
    const planetes = planete === null ? s.planetes.filter(p => p.mienne) : s.planetes.filter(p => p.num === planete);
    return planetes.reduce((acc, p) => acc + (type === 'minerai' ? p.minerai : p.batiments[code] ?? 0), 0);
};

// Retire jusqu'à nb objets ; renvoie le nombre retiré
const retirer = (s: InventaireSysteme, code: string, nb: number, planete: number | null): number => {
    const type = typeObjet(code);
    if (type === 'marchandise') {
        const n = Math.min(nb, s.marchandises[code] ?? 0);
        s.marchandises[code] = (s.marchandises[code] ?? 0) - n;
        return n;
    }
    if (planete !== null) {
        const p = s.planetes.find(pl => pl.num === planete);
        if (!p) return 0;
        if (type === 'minerai') {
            const n = Math.min(nb, p.minerai);
            p.minerai -= n;
            return n;
        }
        const n = Math.min(nb, p.batiments[code] ?? 0);
        p.batiments[code] = (p.batiments[code] ?? 0) - n;
        return n;
    }
    const miennes = s.planetes.filter(p => p.mienne);
    if (type === 'minerai') {
        // Une unité à tour de rôle sur chaque planète du joueur
        let retire = 0;
        while (retire < nb && miennes.some(p => p.minerai > 0)) {
            for (const p of miennes) {
                if (retire < nb && p.minerai > 0) {
                    p.minerai--;
                    retire++;
                }
            }
        }
        return retire;
    }
    // Bâtiment : une unité à la fois sur la planète qui en a le plus
    let retire = 0;
    while (retire < nb) {
        const p = miennes.reduce<PlaneteStock | undefined>((best, pl) =>
            (pl.batiments[code] ?? 0) > 0 && (!best || (pl.batiments[code] ?? 0) > (best.batiments[code] ?? 0)) ? pl : best, undefined);
        if (!p) break;
        p.batiments[code]--;
        retire++;
    }
    return retire;
};

const ajouter = (s: InventaireSysteme, code: string, nb: number, planete: number | null) => {
    if (nb <= 0) return;
    const type = typeObjet(code);
    if (type === 'marchandise') {
        s.marchandises[code] = (s.marchandises[code] ?? 0) + nb;
        return;
    }
    const cible = planete !== null ? s.planetes.find(p => p.num === planete) : undefined;
    if (cible) {
        if (type === 'minerai') cible.minerai += nb;
        else cible.batiments[code] = (cible.batiments[code] ?? 0) + nb;
        return;
    }
    const miennes = s.planetes.filter(p => p.mienne);
    if (miennes.length === 0) return;
    if (type === 'minerai') {
        // Une unité à tour de rôle sur chaque planète du joueur
        miennes.forEach((p, i) => {
            p.minerai += Math.floor(nb / miennes.length) + (i < nb % miennes.length ? 1 : 0);
        });
        return;
    }
    // Bâtiment : une unité à la fois sur la planète qui en a le moins
    for (let i = 0; i < nb; i++) {
        const p = miennes.reduce((best, pl) => (pl.batiments[code] ?? 0) < (best.batiments[code] ?? 0) ? pl : best);
        p.batiments[code] = (p.batiments[code] ?? 0) + 1;
    }
};

export type StatutTransfert = 'ok' | 'partiel' | 'erreur' | 'ignore';

export interface ResultatTransfert {
    statut: StatutTransfert;
    transfere: number;
    message?: string;
}

export interface Simulation {
    resultats: Record<string, ResultatTransfert>; // par id d'ordre
    utilises: number;   // transferts comptés dans la limite
    apres: Inventaires;
}

export const simulerTransferts = (avant: Inventaires, ordres: TransfertOrdre[], max: number): Simulation => {
    const apres = copierInventaires(avant);
    const resultats: Record<string, ResultatTransfert> = {};
    let utilises = 0;
    ordres.forEach(o => {
        const s1 = apres[posToString(o.de)];
        const s2 = apres[posToString(o.vers)];
        const erreur = (message: string) => { resultats[o.id] = { statut: 'erreur', transfere: 0, message }; };
        if (!s1) return erreur('Système de départ non possédé');
        if (!s2) return erreur("Système d'arrivée non possédé");
        if (o.planeteDe !== null && o.planeteDe >= s1.nbPla) return erreur(`Pas de planète ${o.planeteDe + 1} au départ`);
        if (o.planeteVers !== null && o.planeteVers >= s2.nbPla) return erreur(`Pas de planète ${o.planeteVers + 1} à l'arrivée`);
        if (!(o.nombre > 0)) return erreur('Quantité nulle');
        if (utilises >= max) {
            resultats[o.id] = { statut: 'ignore', transfere: 0, message: `Saturation porte spatiale (max ${max}) : ordre ignoré` };
            return;
        }
        const transfere = retirer(s1, o.code, Math.floor(o.nombre), o.planeteDe);
        // Une marchandise sans stock échoue sans compter ; les autres objets comptent même vides
        if (typeObjet(o.code) === 'marchandise' && transfere === 0) return erreur('Stock vide au départ');
        ajouter(s2, o.code, transfere, o.planeteVers);
        utilises++;
        resultats[o.id] = transfere < o.nombre
            ? { statut: 'partiel', transfere, message: `Stock insuffisant : ${transfere} sur ${Math.floor(o.nombre)} transférés` }
            : { statut: 'ok', transfere };
    });
    return { resultats, utilises, apres };
};
