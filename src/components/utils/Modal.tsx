import React, {useEffect, useRef, useState} from 'react';

type Props = {
    title: React.ReactNode; // barre de titre, seule partie par laquelle on déplace la fenêtre
    showCloseButton?: boolean; // bouton × dans la barre de titre
    onClose: () => void;
    children: React.ReactNode;
    backdropOpacity?: number; // assombrissement du fond (0 à 1)
    closeOnBackdrop?: boolean; // fermer en cliquant à côté de la fenêtre
    zIndex?: number;
    panelStyle?: React.CSSProperties; // surcharge du style de la fenêtre
};

const basePanelStyle: React.CSSProperties = {
    background: '#1e1e1e', color: '#eee', padding: 16, borderRadius: 6,
    maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box',
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Fenêtre modale centrée et déplaçable par sa barre de titre :
// fond assombri, fermeture par Échap et (par défaut) par clic à côté
export default function Modal({title, showCloseButton = false, onClose, children, backdropOpacity = 0.5, closeOnBackdrop = true, zIndex = 1000, panelStyle}: Props) {
    const [offset, setOffset] = useState({x: 0, y: 0});
    // Le clic sur le fond ne ferme que s'il a aussi commencé sur le fond (pas en fin de déplacement ou de sélection de texte)
    const pressedOnBackdrop = useRef(false);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault(); // évite la sélection de texte pendant le déplacement
        const start = {mouseX: e.clientX, mouseY: e.clientY, ...offset};

        const onMove = (ev: MouseEvent) => {
            // Le point saisi reste dans la fenêtre du navigateur : la popup ne peut pas être perdue hors écran
            const x = clamp(ev.clientX, 0, window.innerWidth);
            const y = clamp(ev.clientY, 0, window.innerHeight);
            setOffset({x: start.x + x - start.mouseX, y: start.y + y - start.mouseY});
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div
            onMouseDown={(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={(e) => {
                if (closeOnBackdrop && pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
            }}
            style={{position: 'fixed', inset: 0, background: `rgba(0,0,0,${backdropOpacity})`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex}}
        >
            <div style={{...basePanelStyle, ...panelStyle, transform: `translate(${offset.x}px, ${offset.y}px)`}}>
                <div
                    onMouseDown={startDrag}
                    title="Glisser pour déplacer"
                    style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'move', userSelect: 'none'}}
                >
                    <h3 style={{margin: 0}}>{title}</h3>
                    {showCloseButton && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={onClose}
                            title="Fermer (Échap)"
                            style={{cursor: 'pointer'}}
                        >
                            ×
                        </button>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}
