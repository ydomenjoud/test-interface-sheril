import { XY } from '../types';

// Séparateur entre ordres d'un schéma de la console d'ordres
export const SEPARATEUR_SCHEMA = '%#!%';

// Type d'un schéma, écrit en préfixe « type|base64 » pour que la console d'ordres sache quoi importer
export type TypeSchema = 'plan' | 'revenus' | 'construction' | 'deplacement' | 'recherche';

export const ajouterPrefixeSchema = (type: TypeSchema, schema: string): string => `${type}|${schema}`;

// Enlève le préfixe « type| » éventuel (les schémas sans préfixe restent valides)
export const retirerPrefixeSchema = (schema: string): string => schema.replace(/^[a-z]+\|/, '').trim();

// Un système est désigné dans les ordres par « 0_x_y »
export const codePositionOrdre = (pos: XY): string => `0_${pos.x}_${pos.y}`;

// Schéma à coller dans la console d'ordres : « table:param:param » par ordre, séparés par %#!%, le tout en base64 (UTF-8)
export const serialiserSchema = (ordres: string[][]): string => {
    const texte = ordres.map(o => o.join(':')).join(SEPARATEUR_SCHEMA);
    const octets = new TextEncoder().encode(texte);
    return btoa(octets.reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
};

// Inverse de serialiserSchema (base64 → UTF-8 → ordres)
export const deserialiserSchema = (schema: string): string[][] => {
    const binaire = atob(retirerPrefixeSchema(schema));
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) {
        octets[i] = binaire.charCodeAt(i);
    }
    const texte = new TextDecoder().decode(octets);
    return texte.split(SEPARATEUR_SCHEMA).map(ordre => ordre.split(':'));
};

// Copie le schéma dans le presse-papiers ; true si réussi, false (et console.error) sinon
// (navigator.clipboard est absent en contexte non sécurisé : on renvoie false au lieu de jeter)
export const copierSchema = (schema: string): Promise<boolean> => {
    if (!navigator.clipboard) {
        console.error('Copie impossible : presse-papiers indisponible');
        return Promise.resolve(false);
    }
    return navigator.clipboard.writeText(schema)
        .then(() => true)
        .catch(err => {
            console.error('Erreur copie du schéma', err);
            return false;
        });
};