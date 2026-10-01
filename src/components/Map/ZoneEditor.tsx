import React, {useEffect, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS, wrapX, wrapY} from '../../utils/position';
import {Zone} from '../../types';

const inputStyle: React.CSSProperties = {
  padding: '2px 6px', background: '#123', color: '#eee', border: '1px solid #345', boxSizing: 'border-box',
};

const arrowStyle: React.CSSProperties = {width: 26, height: 22, padding: 0, cursor: 'pointer'};

// Champ numérique qui ne valide que les valeurs comprises entre 1 et max (on peut vider le champ pendant la saisie)
function SizeInput({value, max, onCommit, title}: { value: number; max: number; onCommit: (v: number) => void; title: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      min={1}
      max={max}
      value={text}
      title={title}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v) && v >= 1 && v <= max) onCommit(v);
      }}
      onBlur={() => setText(String(value))}
      style={{...inputStyle, width: 56}}
    />
  );
}

type Props = {
  zone: Zone;
};

// La liste de suggestions `zone-editor-labels` est fournie par le panneau parent
export default function ZoneEditor({zone: z}: Props) {
  const {updateZone, deleteZone} = useReport();
  const [label, setLabel] = useState(z.label || '');
  useEffect(() => setLabel(z.label || ''), [z.label]);

  const commitLabel = () => {
    const next = label.trim() || undefined;
    if (next !== z.label) updateZone(z.id, {label: next});
  };

  // x = ligne (axe vertical), y = colonne (axe horizontal)
  const move = (dx: number, dy: number) => updateZone(z.id, {x: wrapX(z.x + dx), y: wrapY(z.y + dy)});

  return (
    <div
      style={{
        borderLeft: `4px solid ${z.borderColor}`,
        background: 'rgba(255,255,255,0.05)',
        padding: '6px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: '0.9em',
      }}
    >
      <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
        <input
          type="text"
          value={label}
          placeholder="(sans label)"
          list="zone-editor-labels"
          title="Label (Entrée ou sortie du champ pour valider)"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{...inputStyle, flex: 1}}
        />
        <button
          onClick={() => deleteZone(z.id)}
          style={{background: 'transparent', border: 'none', color: '#a66', cursor: 'pointer', padding: '0 4px', fontSize: '1.1em'}}
          title="Supprimer la zone"
        >
          ×
        </button>
      </div>

      <div style={{display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <span style={{color: '#aaa'}}>Position {z.x}-{z.y}</span>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 2}}>
            <span/>
            <button style={arrowStyle} onClick={() => move(-1, 0)} title="Déplacer vers le haut">↑</button>
            <span/>
            <button style={arrowStyle} onClick={() => move(0, -1)} title="Déplacer vers la gauche">←</button>
            <button style={arrowStyle} onClick={() => move(1, 0)} title="Déplacer vers le bas">↓</button>
            <button style={arrowStyle} onClick={() => move(0, 1)} title="Déplacer vers la droite">→</button>
          </div>
        </div>

        <label style={{display: 'flex', alignItems: 'center', gap: 4, color: '#aaa'}}>
          Largeur
          <SizeInput value={z.width} max={BOUNDS.maxY} title="Nombre de colonnes" onCommit={(v) => updateZone(z.id, {width: v})}/>
        </label>
        <label style={{display: 'flex', alignItems: 'center', gap: 4, color: '#aaa'}}>
          Hauteur
          <SizeInput value={z.height} max={BOUNDS.maxX} title="Nombre de lignes" onCommit={(v) => updateZone(z.id, {height: v})}/>
        </label>
      </div>
    </div>
  );
}
