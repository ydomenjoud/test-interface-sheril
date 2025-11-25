// Helpers affichage niveau en chiffres romains (niv est 0-based)
import {Technologie} from "../types";

export function toRoman(n: number): string {
    const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    if (n <= 0) return romans[0];
    if (n >= romans.length) return romans[romans.length - 1];
    return romans[n];
}
export function romanFromNiv(niv?: number): string {
    // niv 0 => 1 => I, niv 4 => 5 => V ; cap à X
    const lvl = Math.max(1, Math.min(10, ((niv ?? 0) + 1)));
    return toRoman(lvl);
}
export function formatTechName(t?: Technologie): string {
    if (!t) return '';
    return `${t.nom} ${romanFromNiv(t.niv)}`;
}

/**
 * Éclaircit une couleur hexadécimale d'un pourcentage donné.
 * @param {string} hex - Le code couleur hexadécimal (ex: '#99fa78').
 * @param {number} percent - Le pourcentage d'éclaircissement (ex: 20 pour 20%).
 * @returns {string} Le nouveau code couleur hexadécimal éclairci.
 */
export function lightenHexColor(hex: string, percent: number) {
    // 1. Nettoyer et valider le format hex
    let color = hex.startsWith('#') ? hex.slice(1) : hex;

    // Assurer que l'entrée est au format RRGGBB ou RRRRGGGGBBBB (inhabituel)
    if (color.length !== 6) {
        // Gérer les formats courts (3 caractères) ou invalides
        if (color.length === 3) {
            color = color.split('').map(c => c + c).join('');
        } else {
            // Fallback ou erreur pour les cas non standard
            console.error("Format hex invalide.");
            return hex;
        }
    }

    const factor = 1 + percent / 100;
    let newColor = '#';

    // 2. Traiter chaque composante RVB
    for (let i = 0; i < 3; i++) {
        // Extraire la composante (ex: '99' pour le Rouge)
        let compHex = color.substring(i * 2, i * 2 + 2);

        // Convertir en décimal (0-255)
        let compDec = parseInt(compHex, 16);

        // Appliquer l'éclaircissement et s'assurer de ne pas dépasser 255
        let compLightened = Math.min(255, Math.floor(compDec * factor));

        // Reconvertir en hexadécimal (doit avoir deux chiffres)
        let compNewHex = compLightened.toString(16);

        // Ajouter un '0' devant si nécessaire (ex: 10 en hex est 'a', on veut '0a')
        newColor += compNewHex.length === 1 ? '0' + compNewHex : compNewHex;
    }

    return newColor;
}
