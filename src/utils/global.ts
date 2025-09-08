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
