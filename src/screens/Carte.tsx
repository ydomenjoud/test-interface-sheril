import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import CanvasMap from '../components/Map/CanvasMap';
import MiniMap from '../components/Map/MiniMap';
import InfoPanel from '../components/Map/InfoPanel';
import { XY } from '../types';

export default function Carte() {
  const { rapport, global, cellSize, setCellSize, center, setCenter } = useReport();
  const [selected, setSelected] = useState<XY | undefined>(undefined);

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
      </div>

      <div className="carte-canvas-area">
        {!rapport ? content : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <CanvasMap onSelect={(xy) => setSelected(xy)} />
            <MiniMap onCenter={(x, y) => setCenter({ x, y })} />
          </div>
        )}
      </div>

      <InfoPanel selected={selected} />
    </div>
  );
}
