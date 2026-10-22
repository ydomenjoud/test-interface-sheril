import React, {useEffect, useMemo, useRef, useState} from 'react';
import {XY} from '../../../types';
import {
    ALL_FLEET_SIZE_BANDS, buildFleetFormations, FleetCellSummary, fleetStrength,
    formationStrengthLabel, verboseCompositionLabel,
} from '../../../utils/fleetModel';
import './FleetRoster.css';

export type FleetInspection = {pos: XY; owner?: number; focus?: boolean};
type Props = {
    summary: FleetCellSummary;
    inspection?: FleetInspection;
    getOwnerName: (owner: number) => string;
    getOwnerColor: (owner: number) => string;
    onFleetHover?: (pos: XY | undefined) => void;
    onOpenFleetPicker?: (pos: XY, clientX: number, clientY: number) => void;
};

export default function FleetRoster({summary, inspection, getOwnerName, getOwnerColor, onFleetHover, onOpenFleetPicker}: Props) {
    const [expandedOwner, setExpandedOwner] = useState<number | undefined>();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const id = `fleet-roster-${summary.pos.x}-${summary.pos.y}`;
    // Le modèle de carte fournit les données brutes et visibles ; le détail garde accès aux masquées.
    const allGroups = useMemo(() => buildFleetFormations(summary.fleets, ALL_FLEET_SIZE_BANDS), [summary.fleets]);
    const visible = useMemo(() => new Map(summary.formations.map(group => [group.owner, group])), [summary.formations]);
    useEffect(() => {
        setExpandedOwner(inspection?.owner);
        if (inspection?.focus) {
            const target = inspection.owner === undefined ? headingRef.current : document.getElementById(`${id}-owner-${inspection.owner}`);
            target?.focus();
        }
    }, [inspection, id]);
    useEffect(() => () => onFleetHover?.(undefined), [onFleetHover]);

    return (
        <section className="info-block fleet-roster" aria-labelledby={`${id}-heading`}
            onKeyDown={event => {
                if (event.key === 'Escape' && expandedOwner !== undefined) {
                    event.preventDefault();
                    event.stopPropagation();
                    document.getElementById(`${id}-owner-${expandedOwner}`)?.focus();
                    setExpandedOwner(undefined);
                }
            }}>
            <h4 ref={headingRef} id={`${id}-heading`} tabIndex={-1}>Présence de flottes</h4>
            <p className="fleet-roster-counts">
                {summary.visibleCount}/{summary.totalCount} flottes visibles · {summary.ownerCount} commandant{summary.ownerCount > 1 ? 's' : ''}
            </p>
            {summary.hiddenCount > 0 && (
                <p className="fleet-roster-filter" role="status">
                    {summary.hiddenCount} flotte{summary.hiddenCount > 1 ? 's masquées' : ' masquée'} par le filtre de carte.
                    {' '}Elles restent consultables ci-dessous.
                </p>
            )}
            {allGroups.map(group => {
                const color = getOwnerColor(group.owner);
                const name = getOwnerName(group.owner);
                const shown = visible.get(group.owner);
                const expanded = expandedOwner === group.owner;
                return (
                    <div className={`fleet-roster-owner${shown ? '' : ' is-filtered'}`} key={group.owner} style={{borderLeftColor: color}}>
                        <button
                            className="fleet-roster-toggle" type="button" id={`${id}-owner-${group.owner}`}
                            aria-expanded={expanded} aria-controls={`${id}-detail-${group.owner}`}
                            aria-label={`Inspecter ${name} (#${group.owner}) : ${group.count} flotte${group.count > 1 ? 's' : ''}`}
                            onClick={() => setExpandedOwner(expanded ? undefined : group.owner)}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden="true">
                                <path d="m12 1 3 8v10l-3-2-3 2V9ZM4 9l2 6v7l-2-2-2 2v-7Zm16 0 2 6v7l-2-2-2 2v-7Z" />
                            </svg>
                            <span className="fleet-roster-owner-name"><strong>{name}</strong> <span>#{group.owner}</span></span>
                            <span className="fleet-roster-multiplicity">×{group.count} {expanded ? '−' : '+'}</span>
                        </button>
                        <div className="fleet-roster-owner-meta">
                            <span>{shown ? `Max. connu visible : ${formationStrengthLabel(shown)}` : 'Aucune flotte visible sur la carte'}</span>
                            <span>{group.detected ? 'Détection' : 'Données propres'}</span>
                        </div>
                        <div id={`${id}-detail-${group.owner}`} hidden={!expanded} className="fleet-roster-detail">
                            <p className="fleet-roster-composition">Rapport : {verboseCompositionLabel(group)}</p>
                            <table className="tech-table" aria-label={`Flottes de ${name} (#${group.owner})`}>
                                <thead><tr><th># / Nom</th><th>Vaisseaux</th><th>Puissance</th></tr></thead>
                                <tbody>
                                {group.fleets.map(fleet => {
                                    const visibleFleet = shown?.fleets.some(item => item.num === fleet.num);
                                    const strength = fleetStrength(fleet);
                                    return (
                                        <tr key={`${fleet.owner}:${fleet.num}`} className={visibleFleet ? '' : 'fleet-roster-hidden-fleet'}
                                            onMouseEnter={() => onFleetHover?.(fleet.pos)} onMouseLeave={() => onFleetHover?.(undefined)}>
                                            <td><strong>#{fleet.num + 1} {fleet.nom}</strong>
                                                {!visibleFleet && <small>Masquée sur la carte</small>}
                                                {fleet.type === 'joueur' && <small>Vitesse {fleet.vitesse} · AS {fleet.as ?? '—'} / AP {fleet.ap ?? '—'}</small>}
                                            </td>
                                            <td>{fleet.nbVso > 0 ? fleet.nbVso : '—'}</td>
                                            <td>{strength.band === 'unknown' ? 'Inconnue' : strength.label}
                                                {strength.band === 'unknown' && <small>Rapport : {strength.label}</small>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                            {group.own && onOpenFleetPicker && (
                                <button type="button" className="carte-btn fleet-roster-move"
                                    onClick={event => {
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        onOpenFleetPicker(summary.pos, rect.left, rect.bottom);
                                    }}>Préparer un déplacement de mes flottes d’ici</button>
                            )}
                        </div>
                    </div>
                );
            })}
            <p className="fleet-roster-explanation">Max. connu = plus forte flotte connue, jamais une somme. ×N = flottes ; c / cdt = commandants ; ? = puissance inconnue.</p>
        </section>
    );
}
