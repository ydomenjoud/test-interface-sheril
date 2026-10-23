import {GlobalData, XY} from '../types';
import {BOUNDS} from './position';
import {getSectorGridCoords} from './sectors';

// Couche « présence » : qui est où, calculée sur TOUTE la galaxie (pas seulement le viewport),
// à partir des systèmes connus (propre rapport + détections) avec un poids qui décroît avec l'âge
// de la détection. Contrairement à l'influence (Voronoi dur), une case lointaine de tout système
// connu reste « inconnue » au lieu d'être attribuée au propriétaire le plus proche.

export type PresenceInputs = {
    tour: number;
    systemesJoueur?: { pos: XY; proprietaires?: number[] }[];
    systemesDetectes?: { pos: XY; proprietaires?: number[]; tour?: number }[];
};

export type PresenceOptions = {
    /** Âge (en tours) auquel le poids d'une détection atteint 0 (défaut 10). */
    decayTurns?: number;
};

export type SectorSummary = {
    row: number;
    col: number;
    /** Poids cumulé par commandant (détecteurs neutres exclus). */
    counts: Map<number, number>;
    /** Poids cumulé des systèmes connus neutres. */
    neutral: number;
    /** Systèmes de la carte galactique (data.xml) jamais observés dans ce secteur. */
    unobserved: number;
    /** Commandant au poids maximal, -1 si aucun ou en cas d'égalité. */
    dominant: number;
};

export type PresenceData = {
    maxX: number;
    maxY: number;
    /** (x-1)*maxY + (y-1) -> commandant dominant, -1 si aucune présence significative. */
    winner: Int16Array;
    /** Densité du gagnant par case (0 si inconnue). */
    density: Float32Array;
    /** Maximum de densité du gagnant sur toute la galaxie (≥ 1, pour normaliser l'opacité). */
    densityMax: number;
    /** Clé `${row}_${col}` -> résumé du secteur. */
    sectors: Map<string, SectorSummary>;
    /** Cases `${x}_${y}` où un système existe (carte galactique) sans propriétaire connu. */
    unknownCells: Set<string>;
};

export const PRESENCE_DEFAULTS = {
    decayTurns: 10,
    /** Âge (tours) en dessous duquel une détection garde son plein poids. */
    fullWeightAge: 3,
    /** Poids fixe des détections d'âge inconnu (anciens caches). */
    unknownAgeWeight: 0.25,
    sigmaMin: 3,
    sigmaMax: 8,
    sigmaDefault: 6,
    /** Contributions négligées au-delà de ce multiple de sigma. */
    cutoffSigma: 2.5,
    /** Densité minimale pour qu'une case soit attribuée à un commandant. */
    minDensity: 0.02,
};

const D = PRESENCE_DEFAULTS;

/**
 * Poids d'une détection selon son âge : 1 jusqu'à `fullWeightAge` tours,
 * décroissance linéaire jusqu'à 0 à `decayTurns` tours, 0.25 si l'âge est inconnu.
 */
export function detectionWeight(rapportTour: number, seenTour: number | undefined, decayTurns: number = D.decayTurns): number {
    if (seenTour == null) return D.unknownAgeWeight;
    const decay = Math.max(D.fullWeightAge + 1, decayTurns);
    const age = rapportTour - seenTour;
    if (age <= D.fullWeightAge) return 1;
    if (age >= decay) return 0;
    return 1 - (age - D.fullWeightAge) / (decay - D.fullWeightAge);
}

/** Distance euclidienne sur le tore (le plus court chemin par axe). */
export function torusEuclidean(p1: XY, p2: XY): number {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    const adx = Math.min(dx, BOUNDS.maxX - dx);
    const ady = Math.min(dy, BOUNDS.maxY - dy);
    return Math.sqrt(adx * adx + ady * ady);
}

/**
 * Bande (sigma) estimée d'après l'écart médian au voisin le plus proche, bornée à [3, 8].
 * Renvoie 0 s'il y a moins de 2 positions (aucune donnée : le caller choisit un repli).
 */
export function sigmaForPositions(positions: XY[]): number {
    if (!positions || positions.length < 2) return 0;
    const nn: number[] = [];
    for (let i = 0; i < positions.length; i++) {
        let best = Infinity;
        for (let j = 0; j < positions.length; j++) {
            if (j === i) continue;
            const d = torusEuclidean(positions[i], positions[j]);
            if (d < best) best = d;
        }
        if (best < Infinity) nn.push(best);
    }
    if (nn.length === 0) return 0;
    nn.sort((a, b) => a - b);
    const median = nn.length % 2 === 1
        ? nn[(nn.length - 1) / 2]
        : (nn[nn.length / 2 - 1] + nn[nn.length / 2]) / 2;
    return Math.max(D.sigmaMin, Math.min(D.sigmaMax, median));
}

const wrapCoord = (v: number, size: number): number => ((v - 1) % size + size) % size + 1;

/**
 * Décalages (avec leur distance) couvrant chaque case de l'axe UNE seule fois sur le tore,
 * filtrés par `cutoff` (gère le cas pair : l'antipode n'est ajouté qu'à portée suffisante).
 */
function axisOffsets(size: number, cutoff: number): { off: number; d: number }[] {
    const out: { off: number; d: number }[] = [];
    const a = size % 2 === 1 ? (size - 1) / 2 : size / 2 - 1;
    for (let off = -a; off <= a; off++) {
        const d = Math.abs(off);
        if (d <= cutoff) out.push({ off, d });
    }
    if (size % 2 === 0 && size / 2 <= cutoff) out.push({ off: size / 2, d: size / 2 });
    return out;
}

/**
 * Calcule la présence sur toute la galaxie : grille de gagnant/densité (noyau gaussien
 * « splat » par système connu, pondéré par fraîcheur), résumés par secteur et cases
 * à propriétaire inconnu (carte galactique jamais observée).
 */
export function computePresence(rapport: PresenceInputs, global: GlobalData | null | undefined, playerId: number, options: PresenceOptions = {}): PresenceData {
    const decayTurns = options.decayTurns ?? D.decayTurns;
    const maxX = BOUNDS.maxX;
    const maxY = BOUNDS.maxY;
    const size = maxX * maxY;

    // ---- 1. Attracteurs pondérés par commandant -------------------------------------
    const byPlayer = new Map<number, { pos: XY; weight: number }[]>();
    const add = (player: number, pos: XY, weight: number): void => {
        if (player === 0 || weight <= 0) return;
        let list = byPlayer.get(player);
        if (!list) {
            list = [];
            byPlayer.set(player, list);
        }
        list.push({ pos, weight });
    };

    rapport.systemesJoueur?.forEach(s => {
        const owners = (s.proprietaires || []).filter(o => o !== 0);
        (owners.length ? owners : [playerId]).forEach(o => add(o, s.pos, 1));
    });
    rapport.systemesDetectes?.forEach(s => {
        const w = detectionWeight(rapport.tour, s.tour, decayTurns);
        if (w <= 0) return;
        (s.proprietaires || []).forEach(o => add(o, s.pos, w));
    });

    // ---- 2. Sigma par commandant (repli : écart de ses propres systèmes, puis défaut) --
    const ownSigma = sigmaForPositions((rapport.systemesJoueur || []).map(s => s.pos));
    const sigmas = new Map<number, number>();
    byPlayer.forEach((list, player) => {
        sigmas.set(player, sigmaForPositions(list.map(a => a.pos)) || ownSigma || D.sigmaDefault);
    });

    // ---- 3. Grille de densité par commandant (splat gaussien borné) --------------------
    const grids = new Map<number, Float32Array>();
    byPlayer.forEach((list, player) => {
        const sigma = sigmas.get(player) as number;
        const cutoff = D.cutoffSigma * sigma;
        const cutoff2 = cutoff * cutoff;
        const inv2s2 = 1 / (2 * sigma * sigma);
        const grid = new Float32Array(size);
        grids.set(player, grid);
        const offsX = axisOffsets(maxX, cutoff);
        const offsY = axisOffsets(maxY, cutoff);
        list.forEach(a => {
            offsX.forEach(ox => {
                const cx = wrapCoord(a.pos.x + ox.off, maxX);
                offsY.forEach(oy => {
                    const d2 = ox.d * ox.d + oy.d * oy.d;
                    if (d2 > cutoff2) return;
                    const cy = wrapCoord(a.pos.y + oy.off, maxY);
                    grid[(cx - 1) * maxY + (cy - 1)] += a.weight * Math.exp(-d2 * inv2s2);
                });
            });
        });
    });

    // ---- 4. Gagnant par case (densité > seuil ; égalité -> joueur courant) ------------
    const winner = new Int16Array(size);
    winner.fill(-1);
    const density = new Float32Array(size);
    let densityMax = 0;
    for (let x = 1; x <= maxX; x++) {
        for (let y = 1; y <= maxY; y++) {
            const i = (x - 1) * maxY + (y - 1);
            let best = D.minDensity;
            let bestOwner = -1;
            grids.forEach((g, player) => {
                const d = g[i];
                if (d > best || (d === best && player === playerId && bestOwner !== playerId)) {
                    best = d;
                    bestOwner = player;
                }
            });
            winner[i] = bestOwner;
            if (bestOwner >= 0) {
                density[i] = best;
                if (best > densityMax) densityMax = best;
            }
        }
    }
    if (densityMax < 1) densityMax = 1;

    // ---- 5. Résumés par secteur 10×10 (toujours sur la donnée complète, pas le focus) --
    const sectors = new Map<string, SectorSummary>();
    const sectorOf = (x: number, y: number): SectorSummary => {
        const {row, col} = getSectorGridCoords(x, y);
        const key = `${row}_${col}`;
        let s = sectors.get(key);
        if (!s) {
            s = {row, col, counts: new Map<number, number>(), neutral: 0, unobserved: 0, dominant: -1};
            sectors.set(key, s);
        }
        return s;
    };

    const observed = new Set<string>();
    rapport.systemesJoueur?.forEach(s => observed.add(`${s.pos.x}_${s.pos.y}`));
    rapport.systemesDetectes?.forEach(s => observed.add(`${s.pos.x}_${s.pos.y}`));

    rapport.systemesJoueur?.forEach(s => {
        const sec = sectorOf(s.pos.x, s.pos.y);
        const owners = (s.proprietaires || []).filter(o => o !== 0);
        if (owners.length) owners.forEach(o => sec.counts.set(o, (sec.counts.get(o) || 0) + 1));
        else sec.neutral += 1;
    });
    rapport.systemesDetectes?.forEach(s => {
        const w = detectionWeight(rapport.tour, s.tour, decayTurns);
        if (w <= 0) return;
        const sec = sectorOf(s.pos.x, s.pos.y);
        const owners = (s.proprietaires || []).filter(o => o !== 0);
        if (!owners.length) sec.neutral += w;
        else owners.forEach(o => sec.counts.set(o, (sec.counts.get(o) || 0) + w));
    });
    (global?.systemes || []).forEach(s => {
        if (s.pos.x < 1 || s.pos.x > maxX || s.pos.y < 1 || s.pos.y > maxY) return;
        if (observed.has(`${s.pos.x}_${s.pos.y}`)) return;
        sectorOf(s.pos.x, s.pos.y).unobserved += 1;
    });
    sectors.forEach(sec => {
        let maxCount = 0;
        sec.counts.forEach(c => {
            if (c > maxCount) maxCount = c;
        });
        if (maxCount <= 1e-9) {
            sec.dominant = -1;
            return;
        }
        let nMax = 0;
        let dom = -1;
        sec.counts.forEach((c, p) => {
            if (c >= maxCount - 1e-9) {
                nMax++;
                dom = p;
            }
        });
        sec.dominant = nMax === 1 ? dom : -1;
    });

    // ---- 6. Cases « système connu, propriétaire inconnu » (carte galactique non observée)
    const unknownCells = new Set<string>();
    (global?.systemes || []).forEach(s => {
        if (s.pos.x < 1 || s.pos.x > maxX || s.pos.y < 1 || s.pos.y > maxY) return;
        const key = `${s.pos.x}_${s.pos.y}`;
        if (!observed.has(key)) unknownCells.add(key);
    });

    return {maxX, maxY, winner, density, densityMax, sectors, unknownCells};
}