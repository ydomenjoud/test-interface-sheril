/**
 * static retournerNiveauPuissance(entree) {
 *     const BASE = Const.BASE_NIVEAU_PUISSANCE;
 *
 *     if (entree < BASE) return 0;
 *     if (entree < 2 * BASE) return 1;
 *     if (entree < 4 * BASE) return 2;
 *     if (entree < 8 * BASE) return 3;
 *     if (entree < 20 * BASE) return 4;
 *     if (entree < 40 * BASE) return 5;
 *     if (entree < 80 * BASE) return 6;
 *     if (entree < 200 * BASE) return 7;
 *     if (entree < 400 * BASE) return 8;
 *     if (entree < 720 * BASE) return 9;
 *     return 10;
 *   }
 */
import {FlotteJoueur} from "../types";

const B = 25;

const seuil = [B, 2 * B, 4 * B, 8 * B, 20 * B, 40 * B, 80 * B, 200 * B, 400 * B, 720 * B,];

const desc = ["insignifiante", "ridicule", "très petite", "petite", "moyenne", "assez grande", "grande", "très grande", "gigantesque", "titanesque", "inimaginable"]

export function getPuissance(fleet: FlotteJoueur) {
    return (fleet.as || 0) + (fleet.ap || 0) / 2;
}

export function getDescriptionPuissance(p: number) {
    for (let i = 0; i < seuil.length; i++) {
        if(p < seuil[i]) {
            return desc[i];
        }
    }
    return "??????";
}

export function getPuissanceFromString(p: string){
    const index = desc.indexOf(p.toLowerCase());
    if(index < 0 ){
        return "";
    }
    if (index === 0){
        return `0-${seuil[0]}`
    }

    return `${seuil[index-1]}-${seuil[index]}`;
}
