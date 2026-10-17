import { XY } from '../types';
import { codePositionOrdre, serialiserSchema } from './ordreSchema';

// PLACEHOLDER — à remplacer par la vraie syntaxe d'ordre du jeu
// Forme confirmée : (num de la flotte, destination, directive:int, stratégie:int)
export const TABLE_ORDRE_DEPLACEMENT = 'deplacement_flotte'; // à remplacer
export const DIRECTIVE_DEFAUT = 1;   // à remplacer
export const STRATEGIE_DEFAUT = 0;   // à remplacer
// PLACEHOLDER — valeurs proposées dans le menu « Stratégie » ; à remplacer
export const OPTIONS_STRATEGIES = [0, 1, 2, 3, 4, 5, 6, 7];

// Directives de rencontre — règle 4.4 (https://sheril.pbem-france.net/rule/4_flottes#4.4),
// dans l'ordre de résolution du jeu (cet ordre est déterminant).
// value = position dans le tableau (les codes réels du jeu restent à confirmer avec la console — placeholder).
// label = abrégé pour le menu compact ; full = libellé complet pour l'infobulle.
export interface DirectiveOption {
    value: number;
    label: string;
    full: string;
    cdt?: boolean; // la directive porte sur les flottes d'un commandant précis (menu « Cdt » affiché)
}
export const OPTIONS_DIRECTIVES: DirectiveOption[] = [
    { value: 0, label: 'Attaque flottes cdt', cdt: true, full: "Attaque les flottes d'un commandant particulier présentes sur la même case (le neutre est considéré comme un commandant)" },
    { value: 1, label: 'Attaque préventive', full: 'Attaque toutes les flottes qui comptent attaquer le système (ou ses planètes) que la flotte survole' },
    { value: 2, label: 'Attaque toute flotte', full: 'Attaque toute flotte rencontrée, sur la même case (uniquement les flottes)' },
    { value: 3, label: 'Attaque système', full: 'Tente de prendre toutes les planètes du système' },
    { value: 4, label: 'Pillage système', full: 'Tente de piller toutes les planètes du système' },
    { value: 5, label: 'Attaque planète', full: 'Tente de prendre une planète du système' },
    { value: 6, label: 'Pillage planète', full: 'Tente de piller une planète du système' },
    { value: 7, label: 'Eradication planète', full: "Tente d'éradiquer une planète du système" },
    { value: 8, label: 'Attitude neutre', full: 'La flotte ne fait rien, mais se défend en cas d’agression' },
];
export const DIRECTIVE_CDT = 0; // « Attaque flottes cdt » : exige le commandant visé
export const CDT_DEFAUT = 0;    // 0 = le neutre (le jeu le considère comme un commandant)

export interface DeplacementOrdre {
    fleetNum: number;  // num de la flotte (identité rapport)
    from: XY;          // position dans le rapport (pour info/affichage)
    to: XY;            // destination commandée
    directive: number; // directive commandée (int)
    strategy: number;  // stratégie commandée (int)
    cdt?: number;      // commandant visé (directive « Attaque flottes cdt »)
}

// Déplacement en attente pour une flotte : destination + directive + stratégie (+ commandant visé)
export interface DeplacementEnAttente {
    to: XY;
    directive: number;
    strategy: number;
    cdt?: number;
}

// Ordre d'un déplacement : [table, num de flotte, position destination, directive, stratégie]
// (+ commandant visé en 6e position quand la directive est « Attaque flottes cdt » —
// position à confirmer avec la console, placeholder)
export const ordreDeplacement = (d: DeplacementOrdre): string[] => {
    const ordre = [
        TABLE_ORDRE_DEPLACEMENT,
        String(d.fleetNum),
        codePositionOrdre(d.to),
        String(d.directive),
        String(d.strategy),
    ];
    if (d.directive === DIRECTIVE_CDT) ordre.push(String(d.cdt ?? CDT_DEFAUT));
    return ordre;
};

// Schéma déterministe : tri par num de flotte, puis serialisation
export const schemaDeplacements = (deplacements: DeplacementOrdre[]): string =>
    serialiserSchema([...deplacements].sort((a, b) => a.fleetNum - b.fleetNum).map(ordreDeplacement));