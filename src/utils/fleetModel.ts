import {FlotteDetectee, FlotteJoueur, Rapport, XY} from '../types';
import {getDescriptionPuissance, getPuissance} from './puissance';

// Les bandes sont un filtre d'affichage, jamais une estimation de puissance cumulée.
export type FleetSizeBand = 'weak' | 'petite' | 'moyenne' | 'grande' | 'massive' | 'unknown';
export const FLEET_SIZE_BAND_OPTIONS: {value: FleetSizeBand; label: string; title: string}[] = [
    {value: 'weak', label: 'Faible', title: 'Insignifiante, ridicule, très petite ou faible'},
    {value: 'petite', label: 'Petite', title: 'Petite'},
    {value: 'moyenne', label: 'Moyenne', title: 'Moyenne'},
    {value: 'grande', label: 'Grande', title: 'Assez grande ou grande'},
    {value: 'massive', label: 'Très grande +', title: 'Très grande, gigantesque, titanesque ou inimaginable'},
    {value: 'unknown', label: '?', title: 'Puissance inconnue'},
];
export const ALL_FLEET_SIZE_BANDS = FLEET_SIZE_BAND_OPTIONS.map(option => option.value);
export const KNOWN_FLEET_SIZE_BANDS = ALL_FLEET_SIZE_BANDS.filter(band => band !== 'unknown');

export type MapFleet = (FlotteJoueur | FlotteDetectee) & {owner: number};
export type FleetStrength = {
    label: string;
    normalized: string;
    band: FleetSizeBand;
    rank: number;       // famille visuelle 0..4, sans unité physique
    priority: number;   // ordre des catégories du jeu, -1 si inconnue
    shortLabel: string;
};
export type FleetComposition = FleetStrength & {fleets: MapFleet[]; count: number; shipCount: number};
export type FleetFormation = {
    owner: number;
    own: boolean;
    fleets: MapFleet[];
    count: number;           // flottes VISIBLES, pas vaisseaux ni niveau de puissance
    totalCount: number;      // avant filtrage
    shipCount: number;
    composition: FleetComposition[];
    primary: FleetStrength; // plus forte catégorie CONNUE visible, jamais une somme
    unknownCount: number;
    detected: boolean;
};
export type FleetCellSummary = {
    pos: XY;
    fleets: MapFleet[];
    formations: FleetFormation[];
    totalCount: number;
    visibleCount: number;
    hiddenCount: number;
    ownerCount: number;
};

export const fleetCellKey = (pos: XY): string => `${pos.x}_${pos.y}`;

/** Les observations répétées ne doivent pas gonfler les compteurs ; nos données priment. */
export function mapFleetsForReport(rapport?: Rapport): MapFleet[] {
    if (!rapport) return [];
    const candidates: MapFleet[] = [
        ...rapport.flottesJoueur.map(fleet => ({...fleet, owner: rapport.joueur.numero})),
        ...rapport.flottesDetectees.map(fleet => ({...fleet, owner: fleet.proprio})),
    ];
    const seen = new Set<string>();
    return candidates.filter(fleet => {
        const key = `${fleet.owner}:${fleet.num}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function strengthFromLabel(rawLabel?: string): FleetStrength {
    const label = rawLabel?.trim() || 'inconnue';
    const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    const known: [string, FleetSizeBand, number, number, string][] = [
        ['inimaginable', 'massive', 4, 10, 'IM'],
        ['titanesque', 'massive', 4, 9, 'T'],
        ['gigantesque', 'massive', 4, 8, 'GI'],
        ['tres grande', 'massive', 4, 7, 'TG'],
        ['assez grande', 'grande', 3, 5, 'AG'],
        ['grande', 'grande', 3, 6, 'G'],
        ['moyenne', 'moyenne', 2, 4, 'M'],
        ['tres petite', 'weak', 0, 2, 'TP'],
        ['petite', 'petite', 1, 3, 'P'],
        ['faible', 'weak', 0, 2, 'F'],
        ['ridicule', 'weak', 0, 1, 'R'],
        ['insignifiante', 'weak', 0, 0, 'I'],
    ];
    const match = known.find(([value]) => value === normalized);
    if (match) {
        const [, band, rank, priority, shortLabel] = match;
        return {label, normalized, band, rank, priority, shortLabel};
    }
    // Une valeur nouvelle reste visible comme renseignement inconnu, pas comme force faible.
    return {label, normalized, band: 'unknown', rank: 0, priority: -1, shortLabel: '?'};
}

export function fleetStrength(fleet: MapFleet): FleetStrength {
    return strengthFromLabel(fleet.type === 'joueur'
        ? getDescriptionPuissance(getPuissance(fleet))
        : fleet.puiss);
}

/** Le choix « inclure les inconnues » est indépendant des préréglages de tailles connues. */
export function applyFleetSizePreset(current: readonly FleetSizeBand[], preset: readonly FleetSizeBand[]): FleetSizeBand[] {
    return [...preset.filter(band => band !== 'unknown'), ...(current.includes('unknown') ? ['unknown' as const] : [])];
}

export function buildFleetFormations(fleets: readonly MapFleet[], visibleBands: readonly FleetSizeBand[]): FleetFormation[] {
    const byOwner = new Map<number, MapFleet[]>();
    fleets.forEach(fleet => {
        const list = byOwner.get(fleet.owner) || [];
        list.push(fleet);
        byOwner.set(fleet.owner, list);
    });
    const formations: FleetFormation[] = [];
    byOwner.forEach((all, owner) => {
        const byStrength = new Map<string, FleetComposition>();
        const visible = all.filter(fleet => visibleBands.includes(fleetStrength(fleet).band));
        if (!visible.length) return;
        visible.forEach(fleet => {
            const strength = fleetStrength(fleet);
            const ships = Math.max(0, Number(fleet.nbVso) || 0);
            const item = byStrength.get(strength.normalized);
            if (item) {
                item.fleets.push(fleet);
                item.count += 1;
                item.shipCount += ships;
            } else {
                byStrength.set(strength.normalized, {...strength, fleets: [fleet], count: 1, shipCount: ships});
            }
        });
        const composition = Array.from(byStrength.values()).sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
        formations.push({
            owner,
            own: visible.some(fleet => fleet.type === 'joueur'),
            fleets: visible,
            count: visible.length,
            totalCount: all.length,
            shipCount: composition.reduce((sum, category) => sum + category.shipCount, 0),
            composition,
            primary: composition[0],
            unknownCount: composition.filter(category => category.band === 'unknown').reduce((sum, category) => sum + category.count, 0),
            detected: visible.every(fleet => fleet.type !== 'joueur'),
        });
    });
    // Notre commandant reste accessible ; les autres emplacements ne changent pas avec la puissance.
    return formations.sort((a, b) => Number(b.own) - Number(a.own) || a.owner - b.owner);
}

export function buildFleetCells(fleets: readonly MapFleet[], visibleBands: readonly FleetSizeBand[]): Map<string, FleetCellSummary> {
    const byCell = new Map<string, MapFleet[]>();
    fleets.forEach(fleet => {
        const key = fleetCellKey(fleet.pos);
        const list = byCell.get(key) || [];
        list.push(fleet);
        byCell.set(key, list);
    });
    const cells = new Map<string, FleetCellSummary>();
    byCell.forEach((list, key) => {
        const formations = buildFleetFormations(list, visibleBands);
        const visibleCount = formations.reduce((count, formation) => count + formation.count, 0);
        cells.set(key, {
            pos: list[0].pos, fleets: list, formations, visibleCount,
            totalCount: list.length, hiddenCount: list.length - visibleCount,
            ownerCount: new Set(list.map(fleet => fleet.owner)).size,
        });
    });
    return cells;
}

export function formationStrengthLabel(formation: FleetFormation): string {
    if (formation.primary.band === 'unknown') return 'inconnue';
    return `${formation.primary.label}${formation.unknownCount ? ' + ?' : ''}`;
}

export function formationShortLabel(formation: FleetFormation): string {
    return `${formation.primary.shortLabel}${formation.primary.band !== 'unknown' && formation.unknownCount ? '?' : ''}`;
}

export function verboseCompositionLabel(formation: FleetFormation): string {
    return formation.composition.map(category => `${category.label} ×${category.count}`).join(' · ');
}
