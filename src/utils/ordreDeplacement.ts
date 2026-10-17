import { XY } from '../types';
import { codePositionOrdre, serialiserSchema } from './ordreSchema';

// PLACEHOLDER — à remplacer par la vraie syntaxe d'ordre du jeu
// Forme confirmée : (num de la flotte, destination, directive:int, stratégie:int)
export const TABLE_ORDRE_DEPLACEMENT = 'deplacement_flotte'; // à remplacer
// Valeurs par défaut appliquées au dépos, et listes proposées dans les menus du panneau
export const DIRECTIVE_DEFAUT = 1;   // à remplacer
export const STRATEGIE_DEFAUT = 0;   // à remplacer
// PLACEHOLDER — valeurs proposées dans les menus « Directive » / « Stratégie » ; à remplacer
export const OPTIONS_DIRECTIVES = [0, 1, 2, 3, 4, 5, 6, 7];
export const OPTIONS_STRATEGIES = [0, 1, 2, 3, 4, 5, 6, 7];

export interface DeplacementOrdre {
    fleetNum: number;  // num de la flotte (identité rapport)
    from: XY;          // position dans le rapport (pour info/affichage)
    to: XY;            // destination commandée
    directive: number; // directive commandée (int)
    strategy: number;  // stratégie commandée (int)
}

// Déplacement en attente pour une flotte : destination + directive + stratégie
export interface DeplacementEnAttente {
    to: XY;
    directive: number;
    strategy: number;
}

// Ordre d'un déplacement : [table, num de flotte, position destination, directive, stratégie]
export const ordreDeplacement = (d: DeplacementOrdre): string[] => [
    TABLE_ORDRE_DEPLACEMENT,
    String(d.fleetNum),
    codePositionOrdre(d.to),
    String(d.directive),
    String(d.strategy),
];

// Schéma déterministe : tri par num de flotte, puis serialisation
export const schemaDeplacements = (deplacements: DeplacementOrdre[]): string =>
    serialiserSchema([...deplacements].sort((a, b) => a.fleetNum - b.fleetNum).map(ordreDeplacement));