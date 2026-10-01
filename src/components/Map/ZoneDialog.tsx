import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS} from '../../utils/position';
import {ZoneRect} from './CanvasMap';
import {Zone} from '../../types';
import Modal from '../utils/Modal';

type Props = {
    rect: ZoneRect;
    onClose: () => void;
    onPreview: (zone: Omit<Zone, 'id'> | undefined) => void; // aperçu en direct sur la carte (undefined si saisie invalide)
};

const inputStyle: React.CSSProperties = {
    background: '#333', color: '#eee', border: '1px solid #555', padding: '4px 6px', borderRadius: 4, width: '100%', boxSizing: 'border-box',
};

export default function ZoneDialog({rect, onClose, onPreview}: Props) {
    const {zones, addZone} = useReport();
    const [width, setWidth] = useState(String(rect.width));
    const [height, setHeight] = useState(String(rect.height));
    const [label, setLabel] = useState('');
    const [borderColor, setBorderColor] = useState('#ffcc00');
    const [bgColor, setBgColor] = useState('#ffcc00');
    const labelRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        labelRef.current?.focus();
    }, []);

    // Combinaisons (libellé + couleurs) déjà utilisées, dédoublonnées, les plus récentes d'abord
    const recents = useMemo(() => {
        const seen = new Set<string>();
        const list: { label: string; borderColor: string; bgColor: string }[] = [];
        [...zones].reverse().forEach(z => {
            const key = `${z.label || ''}|${z.borderColor}|${z.bgColor}`;
            if (seen.has(key)) return;
            seen.add(key);
            list.push({label: z.label || '', borderColor: z.borderColor, bgColor: z.bgColor});
        });
        return list.slice(0, 12);
    }, [zones]);

    const existingLabels = useMemo(() => Array.from(new Set(zones.map(z => z.label).filter(Boolean))), [zones]);

    const w = parseInt(width, 10);
    const h = height.trim() === '' ? w : parseInt(height, 10);
    const valid = Number.isFinite(w) && w > 0 && w <= BOUNDS.maxY && Number.isFinite(h) && h > 0 && h <= BOUNDS.maxX;

    const trimmedLabel = label.trim() || undefined;
    useEffect(() => {
        onPreview(valid ? {x: rect.x, y: rect.y, width: w, height: h, label: trimmedLabel, borderColor, bgColor} : undefined);
    }, [onPreview, valid, rect.x, rect.y, w, h, trimmedLabel, borderColor, bgColor]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        addZone({x: rect.x, y: rect.y, width: w, height: h, label: trimmedLabel, borderColor, bgColor});
        onClose();
    };

    return (
        // fond peu assombri pour laisser voir l'aperçu de la zone sur la carte
        <Modal title={`Nouvelle zone en ${rect.x}-${rect.y}`} onClose={onClose} backdropOpacity={0.15} panelStyle={{width: 340}}>
            <form onSubmit={submit} style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                <div style={{fontSize: '0.8em', color: '#aaa'}}>Taille issue du tracé (Alt + clic + glisser), modifiable si besoin.</div>

                <div style={{display: 'flex', gap: 8}}>
                    <label style={{flex: 1}}>
                        Largeur *
                        <input type="number" min={1} max={BOUNDS.maxY} value={width} onChange={(e) => setWidth(e.target.value)} style={inputStyle}/>
                    </label>
                    <label style={{flex: 1}}>
                        Hauteur
                        <input type="number" min={1} max={BOUNDS.maxX} value={height} placeholder={width || '= largeur'} onChange={(e) => setHeight(e.target.value)} style={inputStyle}/>
                    </label>
                </div>

                <label>
                    Label
                    <input ref={labelRef} type="text" value={label} list="zone-labels-list" onChange={(e) => setLabel(e.target.value)} style={inputStyle}/>
                    <datalist id="zone-labels-list">
                        {existingLabels.map(l => <option key={l} value={l}/>)}
                    </datalist>
                </label>

                <div style={{display: 'flex', gap: 8}}>
                    <label style={{flex: 1}}>
                        Bordure
                        <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} style={{...inputStyle, padding: 0, height: 28}}/>
                    </label>
                    <label style={{flex: 1}}>
                        Fond
                        <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{...inputStyle, padding: 0, height: 28}}/>
                    </label>
                </div>

                {recents.length > 0 && (
                    <div>
                        <div style={{fontSize: '0.8em', color: '#aaa', marginBottom: 4}}>Déjà utilisés</div>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                            {recents.map((r, i) => (
                                <button
                                    type="button"
                                    key={i}
                                    onClick={() => {
                                        setLabel(r.label);
                                        setBorderColor(r.borderColor);
                                        setBgColor(r.bgColor);
                                    }}
                                    style={{background: r.bgColor + '40', color: '#eee', border: `2px solid ${r.borderColor}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.85em'}}
                                >
                                    {r.label || '(sans label)'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                    <button type="button" onClick={onClose}>Annuler</button>
                    <button type="submit" disabled={!valid} style={{fontWeight: 'bold'}}>Créer</button>
                </div>
            </form>
        </Modal>
    );
}
