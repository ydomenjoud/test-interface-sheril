import { FlotteJoueur, XY } from '../types';
import { getTorusDistance } from './position';
import { codeDirective, DeplacementEnAttente, DeplacementOrdre, OPTIONS_DIRECTIVES, ordreDeplacement, PRECISION_DEFAUT } from './ordreDeplacement';
import { ajouterPrefixeSchema, serialiserSchema, SEPARATEUR_SCHEMA } from './ordreSchema';

// Ordres de fusion et de division de flottes (tables « fusionner_flotte », « diviser_flotte » et
// « diviser_flotte_ajouter » du moteur — ReceptionOrdres.java). Détail des règles : docs/ordres-flottes.md.
//
// Ordre de résolution du tour (Const.NOMS_TABLES_ORDRES) : diviser_flotte (32) → deplacer_flotte (33,
// suivi du mouvement réel) → pister (34) → fusionner_flotte (35). Donc :
// - une division se fait sur la case de DÉPART, avant le mouvement ;
// - une fusion se fait sur la case d'ARRIVÉE : les flottes doivent y être après leur déplacement.

// Fusion de plusieurs flottes en une : le moteur fusionne deux à deux et garde le plus petit numéro.
export interface FusionOrdre {
    flottes: number[];  // num des flottes (identité rapport, 0-based), au moins 2
    directive: number;  // directive de la flotte fusionnée (code du jeu 0..8), elle remplace celle du déplacement
    precision?: number; // paramètre n° de la directive (commandant visé ou planète)
}

// Division d'une flotte : les vaisseaux listés partent dans une nouvelle flotte.
export interface DivisionOrdre {
    numero: number;                    // n° local de division (1, 2…) : la nouvelle flotte est div.<numero> (10000 + numero dans l'outil)
    fleetNum: number;                  // flotte divisée (num rapport, 0-based)
    nom: string;                       // nom de la nouvelle flotte
    vaisseaux: Record<string, number>; // plan → nombre de vaisseaux à détacher
}

// Ordres de flottes d'un tour (stockage)
export interface OrdresFlottes {
    fusions: FusionOrdre[];
    divisions: DivisionOrdre[];
}

export const ORDRES_FLOTTES_VIDES: OrdresFlottes = { fusions: [], divisions: [] };

// Dans l'outil, la nouvelle flotte d'une division a le num 10000 + n° de division (comme dans le moteur),
// mais ce n° est LOCAL : la console d'ordres numérote elle-même les divisions à la réception. Le schéma
// désigne donc ces flottes par une référence « div.<n°> » que la console remplace par le vrai numéro ;
// tout ordre qui vise une flotte divisée (déplacement, fusion) voyage dans le même schéma que la division.
export const DECALAGE_FLOTTE_DIVISEE = 10000;

// Num de la nouvelle flotte d'une division, et test inverse
export const numFlotteDivisee = (numero: number): number => DECALAGE_FLOTTE_DIVISEE + numero;
export const estFlotteDivisee = (num: number): boolean => num >= DECALAGE_FLOTTE_DIVISEE;

// N° libre pour une nouvelle division (le plus grand + 1 : un n° retiré n'est pas réutilisé tant que des
// divisions plus récentes existent). L'ordre des n° est celui des divisions dans le schéma, donc celui
// des numéros donnés par la console : « la plus petite flotte » d'une fusion reste la même.
export const prochainNumeroDivision = (divisions: DivisionOrdre[]): number =>
    divisions.reduce((m, d) => Math.max(m, d.numero), 0) + 1;

// Libellé court d'une flotte dans l'interface : « #03 » (num rapport + 1), « div.2 » pour une flotte divisée
export const libelleNumFlotte = (num: number): string =>
    estFlotteDivisee(num) ? `div.${num - DECALAGE_FLOTTE_DIVISEE}` : `#${String(num + 1).padStart(2, '0')}`;

// Désignation d'une flotte dans le schéma : num rapport (0-based), ou « div.<n°> » pour une flotte divisée
export const referenceFlotte = (num: number): string =>
    estFlotteDivisee(num) ? `div.${num - DECALAGE_FLOTTE_DIVISEE}` : String(num);

// Un texte (nom, plan) qui contient un séparateur du schéma casserait l'ordre
export const texteCompatibleSchema = (s: string): boolean => !s.includes(':') && !s.includes(SEPARATEUR_SCHEMA);

// Numéro de la flotte qui reste après la fusion (le moteur garde le plus petit)
export const flotteResultante = (f: FusionOrdre): number => Math.min(...f.flottes);

// Ordres fusionner_flotte : [table, flotte gardée, flotte absorbée, directive]
// Fusions en chaîne sur la plus petite : (A,B) puis (A,C) — A absorbe B puis C.
export const ordresFusion = (f: FusionOrdre): string[][] => {
    const nums = Array.from(new Set(f.flottes)).sort((a, b) => a - b);
    if (nums.length < 2) return [];
    const option = OPTIONS_DIRECTIVES.find(o => o.value === f.directive);
    const precision = option?.precision ? (f.precision ?? PRECISION_DEFAUT) : 0;
    const directive = String(codeDirective(f.directive, precision));
    const [garde, ...absorbees] = nums;
    return absorbees.map(n => ['fusionner_flotte', referenceFlotte(garde), referenceFlotte(n), directive]);
};

// Ordres d'une division :
// - diviser_flotte : [table, flotte, nom de la nouvelle flotte, div.<n°>]
// - diviser_flotte_ajouter : [table, div.<n°>, plan, nombre] — une ligne par plan
export const ordresDivision = (d: DivisionOrdre): string[][] => {
    const ref = referenceFlotte(numFlotteDivisee(d.numero));
    const details = Object.entries(d.vaisseaux)
        .filter(([, nb]) => nb > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([plan, nb]) => ['diviser_flotte_ajouter', ref, plan, String(nb)]);
    if (details.length === 0) return [];
    return [['diviser_flotte', String(d.fleetNum), d.nom, ref], ...details];
};

// Déplacement d'une flotte divisée : [table, div.<n°>, 0_x_y, directive, stratégie] (comme le schéma de déplacement)
export const ordreDeplacementDivisee = (d: DeplacementOrdre): string[] => {
    const [, position, directive, strategie] = ordreDeplacement(d);
    return ['deplacer_flotte', referenceFlotte(d.fleetNum), position, directive, strategie];
};

// Tous les ordres du schéma, dans l'ordre de résolution du moteur : divisions, déplacements des flottes
// divisées (les autres déplacements sont dans le schéma de déplacement), fusions
export const ordresFlottes = (o: OrdresFlottes, deplacements: DeplacementOrdre[] = []): string[][] => [
    ...[...o.divisions].sort((a, b) => a.numero - b.numero).flatMap(ordresDivision),
    ...deplacements.filter(d => estFlotteDivisee(d.fleetNum)).sort((a, b) => a.fleetNum - b.fleetNum).map(ordreDeplacementDivisee),
    ...o.fusions.flatMap(ordresFusion),
];

// Schéma « flotte|base64 » : un ordre « table:param:… » par enregistrement, comme le schéma des revenus
export const schemaOrdresFlottes = (o: OrdresFlottes, deplacements: DeplacementOrdre[] = []): string =>
    ajouterPrefixeSchema('flotte', serialiserSchema(ordresFlottes(o, deplacements)));

// Nombre de vaisseaux par plan dans une flotte du rapport (une entrée <vaisseau> = un vaisseau,
// sauf si le rapport donne un nombre)
export const compositionParPlan = (f: FlotteJoueur): Record<string, number> => {
    const compo: Record<string, number> = {};
    for (const v of f.vaisseaux) compo[v.plan] = (compo[v.plan] ?? 0) + (v.nb ?? 1);
    return compo;
};

// Où sera la flotte au moment des fusions (après le mouvement) :
// - sans déplacement : sur sa case ;
// - avec un déplacement à portée : sur la destination ;
// - hors de portée : quelque part en chemin (horsPortee) — elle n'atteindra pas la case visée.
export interface PositionFinale {
    pos: XY;
    arrive: boolean;     // la flotte vient d'ailleurs ce tour
    horsPortee: boolean; // déplacement commandé au-delà de la vitesse : la flotte n'atteindra pas pos
}
export const positionFinale = (f: FlotteJoueur, deplacement: DeplacementEnAttente | undefined): PositionFinale => {
    if (!deplacement) return { pos: f.pos, arrive: false, horsPortee: false };
    return { pos: deplacement.to, arrive: true, horsPortee: getTorusDistance(f.pos, deplacement.to) > f.vitesse };
};

// Flottes du joueur au moment des déplacements, après les divisions du tour :
// - la flotte divisée perd les vaisseaux détachés (elle disparaît si elle est vidée, comme dans le jeu) ;
// - la nouvelle flotte (num 10000 + n°) est sur la même case, avec les vaisseaux détachés et, faute de
//   mieux, la vitesse de la flotte d'origine (le jeu la recalcule : elle ne peut pas être plus lente).
// Une division dont la flotte est absente, ou qui ne détache rien, est ignorée.
export const appliquerDivisions = (flottes: FlotteJoueur[], divisions: DivisionOrdre[]): FlotteJoueur[] => {
    if (divisions.length === 0) return flottes;
    const parNum = new Map(flottes.map(f => [f.num, { ...f, vaisseaux: [...f.vaisseaux] }]));
    const nouvelles: FlotteJoueur[] = [];
    for (const d of [...divisions].sort((a, b) => a.numero - b.numero)) {
        const parent = parNum.get(d.fleetNum);
        if (!parent) continue;
        const detaches: FlotteJoueur['vaisseaux'] = [];
        for (const [plan, nb] of Object.entries(d.vaisseaux)) {
            let reste = nb;
            while (reste > 0) {
                const i = parent.vaisseaux.findIndex(v => v.plan === plan);
                if (i === -1) break;
                detaches.push(parent.vaisseaux[i]);
                parent.vaisseaux.splice(i, 1);
                reste--;
            }
        }
        if (detaches.length === 0) continue;
        parent.nbVso = parent.vaisseaux.length;
        nouvelles.push({
            ...parent,
            num: numFlotteDivisee(d.numero),
            nom: d.nom,
            vaisseaux: detaches,
            nbVso: detaches.length,
            direction: undefined,
            as: undefined,
            ap: undefined,
        });
    }
    return [...Array.from(parNum.values()).filter(f => f.vaisseaux.length > 0), ...nouvelles];
};
