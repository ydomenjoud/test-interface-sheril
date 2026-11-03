import React from 'react';
import {FleetOwnerVisibility, FleetPowerRange, MAX_POWER_LEVEL} from '../../../utils/fleetModel';
import {PUISSANCE_STOPS} from '../../../utils/puissance';
import './FleetFilters.css';

type Props = {
    enabled: boolean;
    range: FleetPowerRange;
    visibility: FleetOwnerVisibility;
    visibleCount: number;
    totalCount: number;
    onRangeChange: (range: FleetPowerRange) => void;
    onVisibilityChange: (visibility: FleetOwnerVisibility) => void;
};

const maxLabel = (max: number) => max === MAX_POWER_LEVEL ? `${PUISSANCE_STOPS[max]}+` : `${PUISSANCE_STOPS[max]}`;

/** Compteurs et contrôles de flottes restent dans Filtres, pas dans la barre d'outils. */
export default function FleetFilters({enabled, range, visibility, visibleCount, totalCount,
    onRangeChange, onVisibilityChange}: Props) {
    // Poignées superposées à l'extrémité haute : on garde la poignée basse accessible.
    const stuckAtTop = range.min === range.max && range.max === MAX_POWER_LEVEL;
    const minPct = (range.min / MAX_POWER_LEVEL) * 100;
    const maxPct = (range.max / MAX_POWER_LEVEL) * 100;
    return (
        <div role="group" aria-label="Filtres des flottes" className="fleet-filter-section">
            <div className="fleet-filter-heading">
                <span>Flottes</span>
                <span role="status" aria-label="Flottes visibles après filtres" title="Après filtres / total du rapport">
                    {visibleCount}/{totalCount} visibles
                </span>
            </div>
            <div className="fleet-filter-owners">
                <label title="Afficher mes flottes, en respectant la plage de puissance">
                    <input type="checkbox" checked={visibility.showOwn} disabled={!enabled}
                        onChange={event => onVisibilityChange({...visibility, showOwn: event.target.checked})} />
                    Mes flottes
                </label>
                <label title="Afficher les flottes du propriétaire neutre (0), en respectant la plage de puissance">
                    <input type="checkbox" checked={visibility.showNeutral} disabled={!enabled}
                        onChange={event => onVisibilityChange({...visibility, showNeutral: event.target.checked})} />
                    Flottes neutres
                </label>
            </div>
            <div className="fleet-filter-range" role="group" aria-label="Plage de puissance des flottes">
                <div className="fleet-filter-range-sliders">
                    <div className="fleet-filter-range-track" />
                    <div className="fleet-filter-range-fill" style={{left: `${minPct}%`, width: `${maxPct - minPct}%`}} />
                    <input type="range" min={0} max={MAX_POWER_LEVEL} step={1} value={range.min} disabled={!enabled}
                        aria-label="Puissance minimale" title={`Seuil bas : ${PUISSANCE_STOPS[range.min]}`}
                        style={{zIndex: stuckAtTop ? 3 : 2}}
                        onChange={event => onRangeChange({min: Math.min(event.target.valueAsNumber, range.max), max: range.max})} />
                    <input type="range" min={0} max={MAX_POWER_LEVEL} step={1} value={range.max} disabled={!enabled}
                        aria-label="Puissance maximale" title={`Seuil haut : ${maxLabel(range.max)}`}
                        style={{zIndex: stuckAtTop ? 2 : 3}}
                        onChange={event => onRangeChange({min: range.min, max: Math.max(event.target.valueAsNumber, range.min)})} />
                </div>
                <span className="fleet-filter-range-values" title="Plage de puissance (seuils de changement de nom de puissance)">
                    {PUISSANCE_STOPS[range.min]} – {maxLabel(range.max)}
                </span>
            </div>
        </div>
    );
}
