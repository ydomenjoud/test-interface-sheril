import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS, wrapX, wrapY} from '../../utils/position';
import {ZoneRect} from './CanvasMap';

type Props = {
    rect: ZoneRect;
    onClose: () => void;
};

const inputStyle: React.CSSProperties = {
    background: '#333', color: '#eee', border: '1px solid #555', padding: '4px 6px', borderRadius: 4, width: '100%', boxSizing: 'border-box',
};

export default function ZoneDialog({rect, onClose}: Props) {
    const {zones, addZone, deleteZone, updateZone} = useReport();
    const pos = {x: rect.x, y: rect.y};
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

    const zonesHere = useMemo(() => zones.filter(z => {
        const dx = wrapX(pos.x - z.x + 1) - 1; // 0-based, tore
        const dy = wrapY(pos.y - z.y + 1) - 1;
        return dx < z.height && dy < z.width;
    }), [zones, pos.x, pos.y]);

    const w = parseInt(width, 10);
    const h = height.trim() === '' ? w : parseInt(height, 10);
    const valid = Number.isFinite(w) && w > 0 && w <= BOUNDS.maxY && Number.isFinite(h) && h > 0 && h <= BOUNDS.maxX;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        addZone({x: pos.x, y: pos.y, width: w, height: h, label: label.trim() || undefined, borderColor, bgColor});
        onClose();
    };

    return (
        <div
            style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                style={{background: '#1e1e1e', color: '#eee', padding: 16, borderRadius: 6, width: 340, display: 'flex', flexDirection: 'column', gap: 10}}
            >
                <h3 style={{margin: 0}}>Nouvelle zone en {pos.x}-{pos.y}</h3>
                <div style={{fontSize: '0.8em', color: '#aaa'}}>Taille issue du tracé (Alt + glisser), modifiable si besoin.</div>

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

                {zonesHere.length > 0 && (
                    <div>
                        <div style={{fontSize: '0.8em', color: '#aaa', marginBottom: 4}}>Zones existantes sur cette case</div>
                        {zonesHere.map(z => (
                            <div key={z.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: '0.85em'}}>
                                <span style={{color: z.borderColor}}>■</span>
                                <input
                                    type="text"
                                    defaultValue={z.label || ''}
                                    placeholder="(sans label)"
                                    list="zone-labels-list"
                                    title="Modifier le label (Entrée ou sortie du champ pour valider)"
                                    onBlur={(e) => {
                                        const next = e.currentTarget.value.trim() || undefined;
                                        if (next !== z.label) updateZone(z.id, {label: next});
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault(); // ne pas soumettre le formulaire de création
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    style={{...inputStyle, flex: 1, padding: '2px 4px'}}
                                />
                                <span style={{whiteSpace: 'nowrap', color: '#aaa'}}>{z.width}×{z.height} en {z.x}-{z.y}</span>
                                <button type="button" onClick={() => deleteZone(z.id)} title="Supprimer" style={{cursor: 'pointer'}}>×</button>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                    <button type="button" onClick={onClose}>Annuler</button>
                    <button type="submit" disabled={!valid} style={{fontWeight: 'bold'}}>Créer</button>
                </div>
            </form>
        </div>
    );
}
