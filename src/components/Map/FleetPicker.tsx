import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {FlotteJoueur, XY} from '../../types';
import {codePositionOrdre} from '../../utils/ordreSchema';
import {isTypingTarget} from '../../utils/keyboard';
import {IconAlert, IconClose, IconFleetMove, IconGrip} from '../icons/Icons';

export interface FleetPickerProps {
    anchor: {x: number; y: number}; // clientX/clientY (coordonnées viewport) du mousedown d'origine
    fleets: {fleet: FlotteJoueur; deplacement: XY | undefined}[]; // deplacement = cible déjà commandée (si ordres)
    dragNum?: number; // flotte en cours de glisser-déposer : sa ligne est en surbrillance
    onSelectFleet: (fleetNum: number) => void; // drag d'une ligne démarré
    onDragEnd: () => void; // drag terminé (drop ou annulation)
    onClose: () => void;
}

const OFFSET = 12; // écart entre l'ancre et le panneau
const EDGE = 6; // marge minimum par rapport au bord de la fenêtre
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
    const isSingle = fleets.length === 1;
    const panelWidth = isSingle ? 240 : 280;

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
        const w = el.offsetWidth || panelWidth;
        const h = el.offsetHeight || 140;
        let left = anchor.x + OFFSET;
        let top = anchor.y + OFFSET;
        if (left + w > window.innerWidth - EDGE) left = anchor.x - w - OFFSET;
        if (top + h > window.innerHeight - EDGE) top = anchor.y - h - OFFSET;
        setPos({left: Math.max(EDGE, left), top: Math.max(EDGE, top)});
    }, [anchor.x, anchor.y, panelWidth]);

    // Échap ferme le sélecteur
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Ne pas fermer quand la saisie est dans un champ (convention commune des raccourcis de l'app)
            if (e.key === 'Escape' && !isTypingTarget(e.target)) onClose();
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
            const w = el ? el.offsetWidth : panelWidth;
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
                position: 'fixed',
                left: pos.left,
                top: pos.top,
                zIndex: 300, // au-dessus du tooltip (200)
                width: panelWidth,
                background: 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #334155',
                borderRadius: 8,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
                color: '#e2e8f0',
                fontSize: '0.85rem',
                overflow: 'hidden',
            }}
        >
            {/* En-tête : compact pour 1 flotte, complet pour plusieurs */}
            <div
                title="Glisser pour repositionner ce panneau"
                onMouseDown={startPanelDrag}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isSingle ? '6px 10px' : '8px 12px',
                    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                    borderBottom: '1px solid #334155',
                    cursor: dragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <IconGrip size={14} color="#94a3b8" />
                    <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: isSingle ? '0.8rem' : '0.875rem', whiteSpace: 'nowrap' }}>
                        {isSingle ? 'Déplacer la flotte' : `Flottes sur la case (${fleets.length})`}
                    </span>
                </div>
                <button
                    type="button"
                    title="Fermer (Échap)"
                    aria-label="Fermer"
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: 4,
                        lineHeight: 1,
                        transition: 'color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <IconClose size={15} />
                </button>
            </div>

            <div style={{ padding: '6px 10px 4px', fontSize: '0.75rem', color: '#94a3b8' }}>
                {isSingle ? 'Glissez la carte ci-dessous vers la cible :' : 'Glissez une flotte vers sa destination :'}
            </div>

            <div style={{ padding: '4px 6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fleets.map(({fleet, deplacement}) => {
                    const isDragging = dragNum === fleet.num;
                    const isHovered = hoverNum === fleet.num;
                    return (
                        <div
                            key={fleet.num}
                            draggable
                            onDragStart={e => {
                                e.dataTransfer.setData('application/x-fleet-num', String(fleet.num));
                                e.dataTransfer.effectAllowed = 'move';
                                // Remplacement du ghost par un pixel transparent pour garder le tracé net
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
                                padding: '8px 10px',
                                cursor: 'grab',
                                userSelect: 'none',
                                borderRadius: 6,
                                background: isDragging
                                    ? 'rgba(56, 189, 248, 0.18)'
                                    : isHovered ? '#1e293b' : 'rgba(30, 41, 59, 0.45)',
                                border: isDragging
                                    ? '1px solid #38bdf8'
                                    : isHovered ? '1px solid #475569' : '1px solid #334155',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    <IconFleetMove size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {fleet.nom}
                                    </span>
                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', flexShrink: 0 }}>
                                        (#{fleet.num + 1})
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#0f172a',
                                    color: '#38bdf8',
                                    border: '1px solid #1e293b',
                                }}>
                                    Vitesse {fleet.vitesse}
                                </span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#0f172a',
                                    color: '#cbd5e1',
                                    border: '1px solid #1e293b',
                                }}>
                                    {fleet.nbVso} vaisseau{fleet.nbVso > 1 ? 'x' : ''}
                                </span>
                            </div>

                            {deplacement && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: '#f59e0b',
                                    fontSize: '0.75rem',
                                    marginTop: 4,
                                    fontWeight: 500,
                                }}>
                                    <IconAlert size={12} style={{ flexShrink: 0 }} />
                                    <span>Déjà déplacée → {codePositionOrdre(deplacement)}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
