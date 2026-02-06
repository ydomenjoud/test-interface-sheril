import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import CanvasMap from '../components/Map/CanvasMap';
import MiniMap from '../components/Map/MiniMap';
import InfoPanel from '../components/Map/InfoPanel';
import { XY } from '../types';

export default function Carte() {
  const { rapport, global, cellSize, setCellSize, center, setCenter, addDetectedSystemsFromText } = useReport();
  const [selected, setSelected] = useState<XY | undefined>(undefined);
  const [selectedOwners, setSelectedOwners] = useState<number[]>([]);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  const content = useMemo(() => {
    if (!rapport) {
      return (
        <div style={{ color: '#555', padding: 20 }}>
          Veuillez charger votre rapport.xml via le header. Les données globales sont chargées automatiquement.
        </div>
      );
    }
    return null;
  }, [rapport]);

  return (
    <div className="carte-wrap">
      <div className="carte-toolbar">
        <div>
          Taille des cases:
          <input
            type="range"
            min={16}
            max={64}
            step={2}
            value={cellSize}
            onChange={(e) => setCellSize(parseInt(e.target.value, 10))}
            style={{ marginLeft: 8 }}
          />
          <span style={{ marginLeft: 8 }}>{cellSize}px</span>
        </div>
        <div style={{ marginLeft: 20 }}>
          Centre: {center ? `${center.x}-${center.y}` : '—'}
        </div>
        {!global && (
          <div style={{ marginLeft: 20, color: '#a66' }}>
            Données globales en chargement…
          </div>
        )}
        <div style={{ marginLeft: 20 }}>
          Astuce: utilisez les flèches pour naviguer, maintenez Ctrl pour se déplacer par 5.
        </div>
        {/* Filtre multi-sélection des commandants */}
        <div style={{ marginLeft: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="owner-filter">Filtrer par commandant(s):</label>
          <select
            id="owner-filter"
            multiple
            size={4}
            value={selectedOwners.map(String)}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map(o => parseInt(o.value, 10)).filter(n => !Number.isNaN(n));
              setSelectedOwners(values);
            }}
          >
            {(global?.commandants || [])
              .filter(c => typeof c.numero === 'number')
              .map(c => (
                <option key={c.numero} value={String(c.numero)}>
                  {c.nom || `#${c.numero}`}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => { setShowPaste(true); setPasteFeedback(null); }}
            style={{ padding: '4px 8px' }}
            title="Ajouter des détections systèmes depuis un collage"
          >
            + Détections…
          </button>
        </div>
      </div>

      <div className="carte-canvas-area">
        {!rapport ? content : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <CanvasMap onSelect={(xy) => setSelected(xy)} selectedOwners={selectedOwners} />
            <MiniMap onCenter={(x, y) => setCenter({ x, y })} />
          </div>
        )}
      </div>

      <InfoPanel selected={selected} />

      {showPaste && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowPaste(false)}
        >
          <div
            style={{ background: '#1e1e1e', color: '#eee', padding: 16, borderRadius: 6, minWidth: 600, maxWidth: '80%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Ajouter des systèmes détectés</h3>
            <p style={{ marginTop: 0 }}>
              Collez un système par ligne, au format:
              <br/>
              <code>nbpla=16; nom=Nb 9C; pop=3475; popMax=43547; pos=0_1_26; typeEtoile=1; proprios=4,1</code>
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Un système par ligne"}
              style={{ width: '100%', height: 180 }}
            />
            {pasteFeedback && (
              <div style={{ marginTop: 8, color: '#9f9' }}>{pasteFeedback}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setShowPaste(false)}>Annuler</button>
              <button
                type="button"
                onClick={() => {
                  const res = addDetectedSystemsFromText(pasteText);
                  const msgParts = [] as string[];
                  if (res.added > 0) msgParts.push(`${res.added} ajouté(s)`);
                  if (res.errors.length > 0) msgParts.push(`${res.errors.length} erreur(s)`);
                  setPasteFeedback(msgParts.join(' · ') || 'Aucune modification');
                  if (res.errors.length === 0) {
                    // fermer et reset pour un flux rapide
                    setShowPaste(false);
                    setPasteText('');
                  }
                }}
                style={{ fontWeight: 'bold' }}
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
