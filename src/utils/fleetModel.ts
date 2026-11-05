import {FlotteDetectee, FlotteJoueur} from '../types';
import {PUISSANCE_STOPS, getPuissance, getPuissanceNiveauFromLabel} from './puissance';

export type FleetOwnerVisibility = {showOwn: boolean; showNeutral: boolean};
export const DEFAULT_FLEET_OWNER_VISIBILITY: FleetOwnerVisibility = {showOwn: true, showNeutral: true};

/** Plage de puissance : indices dans PUISSANCE_STOPS ; {0, MAX_POWER_LEVEL} = pas de filtre. */
export type FleetPowerRange = {min: number; max: number};
export const MAX_POWER_LEVEL = PUISSANCE_STOPS.length - 1;
export const DEFAULT_FLEET_POWER_RANGE: FleetPowerRange = {min: 0, max: MAX_POWER_LEVEL};

/** Restaure une plage enregistrée : valeurs bornées dans [0, MAX] et min ≤ max garanti. */
export function restoreFleetPowerRange(saved: string | null): FleetPowerRange {
    const def = DEFAULT_FLEET_POWER_RANGE;
    try {
        const parsed: unknown = saved === null ? null : JSON.parse(saved);
        if (typeof parsed !== 'object' || parsed === null) return {...def};
        const {min, max} = parsed as {min?: unknown; max?: unknown};
        const clamp = (value: unknown, fallback: number) =>
            typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), MAX_POWER_LEVEL) : fallback;
        const lo = clamp(min, def.min);
        const hi = clamp(max, def.max);
        return {min: Math.min(lo, hi), max: Math.max(lo, hi)};
    } catch {
        return {...def};
    }
}

export type MapFleet = (FlotteJoueur | FlotteDetectee) & {owner: number};

/** Critère de filtre : puissance exacte pour nos flottes, borne haute de l'intervalle pour une
 *  détection (inimaginable = sans borne), null si la puissance est inconnue. */
export function fleetPowerCriterion(fleet: MapFleet): number | null {
    if (fleet.type === 'joueur') return getPuissance(fleet);
    const level = getPuissanceNiveauFromLabel(fleet.puiss);
    if (level === null) return null;
    return level === MAX_POWER_LEVEL ? Infinity : PUISSANCE_STOPS[level + 1];
}

/** Visibilité d'une flotte : propriétaire (nôtres / neutres) × plage de puissance (seuils du jeu). */
export function isFleetVisible(fleet: MapFleet, range: FleetPowerRange = DEFAULT_FLEET_POWER_RANGE,
    visibility: FleetOwnerVisibility = DEFAULT_FLEET_OWNER_VISIBILITY): boolean {
    const ownerVisible = fleet.type === 'joueur' ? visibility.showOwn : fleet.owner !== 0 || visibility.showNeutral;
    if (!ownerVisible) return false;
    const criterion = fleetPowerCriterion(fleet);
    if (criterion === null) return range.min === DEFAULT_FLEET_POWER_RANGE.min && range.max === DEFAULT_FLEET_POWER_RANGE.max;
    if (criterion < PUISSANCE_STOPS[range.min]) return false;
    if (range.max < MAX_POWER_LEVEL && criterion > PUISSANCE_STOPS[range.max]) return false;
    return true;
}
