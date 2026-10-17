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
const DRAG_VISIBLE_X = 40; // part du panneau restée visible (gauche/droite) pendant le drag de l'en-tête
const DRAG_VISIBLE_Y = 24; // part du panneau restée visible (haut/bas) pendant le drag de l'en-tête

// Clamp de la position du panneau : il ne doit jamais complètement sortir de la fenêtre
function clampPanelPos(left: number, top: number, w: number, h: number) {
    return {
        left: Math.min(Math.max(left, DRAG_VISIBLE_X - w), window.innerWidth - DRAG_VISIBLE_X),
        top: Math.min(Math.max(top, DRAG_VISIBLE_Y - h), window.innerHeight - DRAG_VISIBLE_Y),
    };
}

export function FleetPicker({anchor, fleets, dragNum, onSelectFleet, onDragEnd, onClose}: FleetPickerProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [hoverNum, setHoverNum] = useState<number | undefined>(undefined);
    // Hors écran le temps de mesurer le panneau (useLayoutEffect : avant le premier paint, pas de flash)
    const [pos, setPos] = useState<{left: number; top: number}>({left: -9999, top: -9999});
    // Drag de l'en-tête : session en cours (point de départ souris + position du panneau au clic)
    const dragPanel = useRef<{mouseX: number; mouseY: number; left: number; top: number} | null>(null);
    const [dragging, setDragging] = useState(false);
    // Handlers window du drag en vol : retirés au démontage pour ne pas fuiter
    const panelDragHandlers = useRef<{onMove: (e: MouseEvent) => void; onUp: () => void} | null>(null);

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

    // Démontage en cours de drag : retirer les listeners window (fermeture Échap comprise)
    useEffect(() => {
        return () => {
            const h = panelDragHandlers.current;
            if (h) {
                window.removeEventListener('mousemove', h.onMove);
                window.removeEventListener('mouseup', h.onUp);
            }
        };
    }, []);

    // Déplacement du panneau : saisie par l'en-tête (les lignes gardent leur propre DnD HTML5)
    const startPanelDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) return; // le bouton × garde la main
        e.preventDefault(); // éviter la sélection de texte pendant le drag
        const session = {mouseX: e.clientX, mouseY: e.clientY, left: pos.left, top: pos.top};
        dragPanel.current = session;
        setDragging(true);
        const onMove = (ev: MouseEvent) => {
            const s = dragPanel.current;
            if (!s) return;
            const el = panelRef.current;
            const w = el ? el.offsetWidth : 260; // taille mesurée (repli 260x200 si non montée)
            const h = el ? el.offsetHeight : 200;
            setPos(clampPanelPos(s.left + (ev.clientX - s.mouseX), s.top + (ev.clientY - s.mouseY), w, h));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            panelDragHandlers.current = null;
            dragPanel.current = null;
            setDragging(false);
        };
        panelDragHandlers.current = {onMove, onUp};
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed', left: pos.left, top: pos.top, zIndex: 300, // au-dessus du tooltip (200)
                width: 260, background: '#2a2a2a', border: '1px solid #555', borderRadius: 4,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)', color: '#ddd', fontSize: '0.85em',
            }}
        >
            <div
                title="Glisser pour déplacer le panneau"
                onMouseDown={startPanelDrag}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderBottom: '1px solid #444',
                    cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none',
                }}
            >
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