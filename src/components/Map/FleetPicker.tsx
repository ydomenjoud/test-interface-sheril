import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {FlotteJoueur, XY} from '../../types';
import {codePositionOrdre} from '../../utils/ordreSchema';

export interface FleetPickerProps {
    anchor: {x: number; y: number}; // clientX/clientY (coordonnées viewport) du mousedown d'origine
    fleets: {fleet: FlotteJoueur; deplacement: XY | undefined}[]; // deplacement = cible déjà commandée (si ordres)
    dragNum?: number; // flotte en cours de glisser-déposer : sa ligne est surbrillance (le sélecteur reste ouvert pendant le drag)
    onSelectFleet: (fleetNum: number) => void; // drag d'une ligne démarré
    onDragEnd: () => void; // drag terminé (drop ou annulation)
    onClose: () => void;
}

const OFFSET = 12; // écart entre l'ancre et le panneau
const EDGE = 4; // marge minimum par rapport au bord de la fenêtre

export function FleetPicker({anchor, fleets, dragNum, onSelectFleet, onDragEnd, onClose}: FleetPickerProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [hoverNum, setHoverNum] = useState<number | undefined>(undefined);
    // Hors écran le temps de mesurer le panneau (useLayoutEffect : avant le premier paint, pas de flash)
    const [pos, setPos] = useState<{left: number; top: number}>({left: -9999, top: -9999});

    // Ancrage près du clic, retourné à gauche/au-dessus si le panneau déborde de la fenêtre
    useLayoutEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        let left = anchor.x + OFFSET;
        let top = anchor.y + OFFSET;
        if (left + w > window.innerWidth - EDGE) left = anchor.x - w - OFFSET;
        if (top + h > window.innerHeight - EDGE) top = anchor.y - h - OFFSET;
        setPos({left: Math.max(EDGE, left), top: Math.max(EDGE, top)});
    }, [anchor.x, anchor.y]);

    // Échap ferme le sélecteur
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed', left: pos.left, top: pos.top, zIndex: 300, // au-dessus du tooltip (200)
                width: 260, background: '#2a2a2a', border: '1px solid #555', borderRadius: 4,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)', color: '#ddd', fontSize: '0.85em',
            }}
        >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #444'}}>
                <span style={{fontWeight: 'bold', color: '#ffe600'}}>Déplace une flotte</span>
                <button
                    type="button"
                    title="Fermer"
                    onClick={onClose}
                    style={{background: 'none', border: 'none', color: '#aaa', fontSize: '1.2em', cursor: 'pointer', lineHeight: 1, padding: '0 2px'}}
                >×</button>
            </div>
            <div style={{padding: '4px 0'}}>
                {fleets.map(({fleet, deplacement}) => (
                    <div
                        key={fleet.num}
                        draggable
                        onDragStart={e => {
                            e.dataTransfer.setData('application/x-fleet-num', String(fleet.num));
                            e.dataTransfer.effectAllowed = 'move';
                            // L'image de drag par défaut du navigateur est la ligne « Flotte #X » en
                            // translucide : on la remplace par un pixel transparent — la flotte en
                            // déplacement reste identifiable via la surbrillance de sa ligne ici
                            const fantome = document.createElement('canvas');
                            fantome.width = 1;
                            fantome.height = 1;
                            e.dataTransfer.setDragImage(fantome, 0, 0);
                            onSelectFleet(fleet.num);
                        }}
                        onDragEnd={onDragEnd}
                        onMouseEnter={() => setHoverNum(fleet.num)}
                        onMouseLeave={() => setHoverNum(n => (n === fleet.num ? undefined : n))}
                        style={{
                            padding: '5px 10px', cursor: 'grab', userSelect: 'none',
                            // Flotte en cours de drag : surbrillance claire (au-dessus du survol)
                            background: dragNum === fleet.num
                                ? 'rgba(255, 230, 0, 0.18)'
                                : hoverNum === fleet.num ? '#3a3a3a' : 'transparent',
                            borderBottom: '1px solid #333',
                        }}
                    >
                        <div style={{color: '#fff'}}>Flotte #{fleet.num + 1} — {fleet.nom}</div>
                        <div style={{color: '#9fc6ff', fontSize: '0.9em'}}>
                            vitesse {fleet.vitesse} · {fleet.nbVso} vaisseau{fleet.nbVso > 1 ? 'x' : ''}
                        </div>
                        {deplacement && (
                            <div style={{color: '#ff9800', fontSize: '0.9em'}}>
                                déjà déplacée → {codePositionOrdre(deplacement)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}