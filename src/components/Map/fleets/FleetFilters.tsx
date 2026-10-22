import React from 'react';
import {FLEET_SIZE_BAND_OPTIONS, FleetOwnerVisibility, FleetSizeBand} from '../../../utils/fleetModel';
import './FleetFilters.css';

type Props = {
    enabled: boolean;
    focus: boolean;
    bands: readonly FleetSizeBand[];
    visibility: FleetOwnerVisibility;
    visibleCount: number;
    totalCount: number;
    onFocusChange: (focus: boolean) => void;
    onBandsChange: (bands: FleetSizeBand[]) => void;
    onVisibilityChange: (visibility: FleetOwnerVisibility) => void;
};

/** Compteurs et contrôles de flottes restent dans Filtres, pas dans la barre d'outils. */
export default function FleetFilters({enabled, focus, bands, visibility, visibleCount, totalCount,
    onFocusChange, onBandsChange, onVisibilityChange}: Props) {
    const changeBands = (next: readonly FleetSizeBand[]) => onBandsChange(Array.from(new Set<FleetSizeBand>([...next, 'unknown'])));
    return (
        <div role="group" aria-label="Filtres des flottes" className="fleet-filter-section">
            <div className="fleet-filter-heading">
                <span>Flottes</span>
                <span role="status" aria-label="Flottes visibles après filtres" title="Après filtres / total du rapport">
                    {visibleCount}/{totalCount} visibles
                </span>
            </div>
            <label><input type="checkbox" checked={focus} onChange={event => onFocusChange(event.target.checked)} />Mode focus</label>
            <div className="fleet-filter-owners">
                <label title="Afficher mes flottes, en respectant les tailles sélectionnées">
                    <input type="checkbox" checked={visibility.showOwn} disabled={!enabled}
                        onChange={event => onVisibilityChange({...visibility, showOwn: event.target.checked})} />
                    Mes flottes
                </label>
                <label title="Afficher les flottes du propriétaire neutre (0), en respectant les tailles sélectionnées">
                    <input type="checkbox" checked={visibility.showNeutral} disabled={!enabled}
                        onChange={event => onVisibilityChange({...visibility, showNeutral: event.target.checked})} />
                    Flottes neutres
                </label>
            </div>
            <div className="fleet-filter-segments" role="group" aria-label="Tailles de flottes">
                {FLEET_SIZE_BAND_OPTIONS.filter(option => option.value !== 'unknown').map(option => (
                    <button key={option.value} type="button" title={option.title} aria-label={option.label}
                        aria-pressed={bands.includes(option.value)}
                        disabled={!enabled} onClick={() => changeBands(bands.includes(option.value)
                            ? bands.filter(band => band !== option.value) : [...bands, option.value])}>
                        {option.shortLabel}
                    </button>
                ))}
            </div>
        </div>
    );
}
