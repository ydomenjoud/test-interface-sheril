import {FlotteDetectee, FlotteJoueur} from '../types';
import {getDescriptionPuissance, getPuissance} from './puissance';

// Les bandes sont un filtre d'affichage, jamais une estimation de puissance cumulée.
export type FleetSizeBand = 'weak' | 'petite' | 'moyenne' | 'grande' | 'massive' | 'unknown';
export const FLEET_SIZE_BAND_OPTIONS: {value: FleetSizeBand; label: string; shortLabel: string; title: string}[] = [
    {value: 'weak', label: 'Faible', shortLabel: 'Fbl', title: 'Insignifiante, ridicule, très petite ou faible'},
    {value: 'petite', label: 'Petite', shortLabel: 'Pte', title: 'Petite'},
    {value: 'moyenne', label: 'Moyenne', shortLabel: 'Moy', title: 'Moyenne'},
    {value: 'grande', label: 'Grande', shortLabel: 'Grd', title: 'Assez grande ou grande'},
    {value: 'massive', label: 'Très grande +', shortLabel: 'TG+', title: 'Très grande, gigantesque, titanesque ou inimaginable'},
    {value: 'unknown', label: '?', shortLabel: '?', title: 'Puissance inconnue'},
];
export const ALL_FLEET_SIZE_BANDS = FLEET_SIZE_BAND_OPTIONS.map(option => option.value);
export const KNOWN_FLEET_SIZE_BANDS = ALL_FLEET_SIZE_BANDS.filter(band => band !== 'unknown');

export type FleetOwnerVisibility = {showOwn: boolean; showNeutral: boolean};
export const DEFAULT_FLEET_OWNER_VISIBILITY: FleetOwnerVisibility = {showOwn: true, showNeutral: true};

/** Les anciennes préférences conservent les tailles connues ; sans contrôle dédié, les inconnues restent incluses. */
export function restoreFleetSizeBands(saved: string | null): FleetSizeBand[] {
    try {
        const parsed: unknown = saved === null ? ALL_FLEET_SIZE_BANDS : JSON.parse(saved);
        if (!Array.isArray(parsed)) return [...ALL_FLEET_SIZE_BANDS];
        return [...KNOWN_FLEET_SIZE_BANDS.filter(band => parsed.includes(band)), 'unknown'];
    } catch {
        return [...ALL_FLEET_SIZE_BANDS];
    }
}

export type MapFleet = (FlotteJoueur | FlotteDetectee) & {owner: number};
export type FleetStrength = {
    label: string;
    normalized: string;
    band: FleetSizeBand;
};

export function strengthFromLabel(rawLabel?: string): FleetStrength {
    const label = rawLabel?.trim() || 'inconnue';
    const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    const known: [string, FleetSizeBand][] = [
        ['inimaginable', 'massive'],
        ['titanesque', 'massive'],
        ['gigantesque', 'massive'],
        ['tres grande', 'massive'],
        ['assez grande', 'grande'],
        ['grande', 'grande'],
        ['moyenne', 'moyenne'],
        ['tres petite', 'weak'],
        ['petite', 'petite'],
        ['faible', 'weak'],
        ['ridicule', 'weak'],
        ['insignifiante', 'weak'],
    ];
    const match = known.find(([value]) => value === normalized);
    if (match) {
        return {label, normalized, band: match[1]};
    }
    // Une valeur nouvelle reste visible comme renseignement inconnu, pas comme force faible.
    return {label, normalized, band: 'unknown'};
}

export function fleetStrength(fleet: MapFleet): FleetStrength {
    return strengthFromLabel(fleet.type === 'joueur'
        ? getDescriptionPuissance(getPuissance(fleet))
        : fleet.puiss);
}

/** Visibilité d'une flotte : propriétaire (nôtres / neutres) × bandes de taille sélectionnées. */
export function isFleetVisible(fleet: MapFleet, visibleBands: readonly FleetSizeBand[] = ALL_FLEET_SIZE_BANDS,
    visibility: FleetOwnerVisibility = DEFAULT_FLEET_OWNER_VISIBILITY): boolean {
    const ownerVisible = fleet.type === 'joueur' ? visibility.showOwn : fleet.owner !== 0 || visibility.showNeutral;
    return ownerVisible && visibleBands.includes(fleetStrength(fleet).band);
}
