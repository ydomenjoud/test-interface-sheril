import { XY } from '../types';
import { ajouterPrefixeSchema, codePositionOrdre, serialiserSchema } from './ordreSchema';

// Schéma d'ordres de déplacement (console d'ordres du jeu, table « deplacer_flotte »).
// Principe repris de la planification de construction : un ordre par enregistrement
// « champ:champ:… », les ordres séparés par %#!%, le tout en base64 — sans nom de table
// (l'import côté console sait quelle table il alimente).
//
// Forme d'un ordre : [num de la flotte, 0_x_y, directive, stratégie]
// - directive = code du jeu + 100 × paramètre (n° de planète ou de commandant visé) :
//   ex. 308 = 8 + 100×3 = « attaque des flottes du commandant 3 », 705 = 5 + 100×7 = « attaque de la planète 7 » ;
// - stratégie = nom de la stratégie de combat du joueur (règle 5.4, section STRATEGIES du
//   rapport) ; chaîne vide = la stratégie par défaut du jeu (le moteur retombe dessus aussi si
//   le nom est inconnu) ; le nom ne doit pas contenir « : » ni « %#!% » (séparateurs du schéma) ;
// - un seul déplacement par flotte ; num = numéro de flotte du rapport (0-based).

export const DIRECTIVE_DEFAUT = 1;  // « Attaque système » (choix arbitraire : à confirmer avec le jeu)
export const STRATEGIE_DEFAUT = ''; // '' = la stratégie par défaut du jeu
export const PRECISION_DEFAUT = 0;  // 0 = le neutre pour les commandants ; planète 0 sinon

// Directives de rencontre — codes réels du jeu (Const.java / Messages.DIRECTIVES du serveur,
// cohérents avec la règle 4.4 : https://sheril.pbem-france.net/rule/4_flottes#4.4),
// affichées dans l'ordre de résolution du jeu (Combat.java : cdt → préventive → toute flotte →
// système → pillage système → attaque planète → pillage planète → éradication ; neutre est
// passive) — cet ordre est déterminant.
// label = abrégé pour le menu compact ; full = libellé complet pour l'infobulle ;
// precision = la directive porte un paramètre n° (menu affiché : commandant visé ou planète).
export interface DirectiveOption {
    value: number;   // code réel du jeu (0..8)
    label: string;
    full: string;
    precision?: 'commandant' | 'planete';
}
export const OPTIONS_DIRECTIVES: DirectiveOption[] = [
    { value: 8, label: 'Attaque flottes cdt', full: "Attaque les flottes d'un commandant particulier présentes sur la même case (le neutre est considéré comme un commandant)", precision: 'commandant' },
    { value: 2, label: 'Attaque préventive', full: 'Attaque toutes les flottes qui comptent attaquer le système (ou ses planètes) que la flotte survole' },
    { value: 3, label: 'Attaque toute flotte', full: 'Attaque toute flotte rencontrée, sur la même case (uniquement les flottes)' },
    { value: 1, label: 'Attaque système', full: 'Tente de prendre toutes les planètes du système' },
    { value: 4, label: 'Pillage système', full: 'Tente de piller toutes les planètes du système' },
    { value: 5, label: 'Attaque planète', full: 'Tente de prendre la planète n° visée du système', precision: 'planete' },
    { value: 6, label: 'Pillage planète', full: 'Tente de piller la planète n° visée du système', precision: 'planete' },
    { value: 7, label: 'Eradication planète', full: 'Tente d’éradiquer la planète n° visée du système', precision: 'planete' },
    { value: 0, label: 'Attitude neutre', full: 'La flotte ne fait rien, mais se défend en cas d’agression' },
];
// « Attaque flottes cdt » : précision = commandant visé (0 = le neutre)
export const DIRECTIVE_CDT = 8;
// Bornes du n° de planète proposé dans le menu (bornes du jeu)
export const PRECISION_PLANETE_MIN = 0;
export const PRECISION_PLANETE_MAX = 19;

// Code du jeu d'une directive avec son paramètre : code + 100 × paramètre
export const codeDirective = (directive: number, precision: number): number => directive + 100 * precision;

export interface DeplacementOrdre {
    fleetNum: number;  // num de la flotte (identité rapport, 0-based — l'interface affiche « #num+1 »)
    to: XY;            // destination commandée
    directive: number; // directive commandée (code du jeu 0..8)
    strategy: string;  // nom de la stratégie de combat commandée (vide = par défaut)
    precision?: number; // paramètre n° de la directive (commandant visé ou planète)
}

// Déplacement en attente pour une flotte : destination + directive + stratégie (+ paramètre n°)
export interface DeplacementEnAttente {
    to: XY;
    directive: number;
    strategy: string;
    precision?: number;
}

// Ordre d'un déplacement : [num de flotte, position destination, directive, stratégie]
// Le paramètre n° est piqué dans la directive, uniquement pour les directives qui en ont.
export const ordreDeplacement = (d: DeplacementOrdre): string[] => {
    const option = OPTIONS_DIRECTIVES.find(o => o.value === d.directive);
    const precision = option?.precision ? (d.precision ?? PRECISION_DEFAUT) : 0;
    return [
        String(d.fleetNum),
        codePositionOrdre(d.to),
        String(codeDirective(d.directive, precision)),
        d.strategy ?? '',
    ];
};

// Schéma déterministe : tri par num de flotte, puis serialisation
export const schemaDeplacements = (deplacements: DeplacementOrdre[]): string =>
    ajouterPrefixeSchema('deplacement', serialiserSchema([...deplacements].sort((a, b) => a.fleetNum - b.fleetNum).map(ordreDeplacement)));