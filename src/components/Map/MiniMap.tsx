import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReport } from '../../context/ReportContext';
import {BOUNDS, CENTER, wrapX, wrapY} from '../../utils/position';
import {colorForOwnership} from "./CanvasMap";
import {getSectorGridCoords} from '../../utils/sectors';
import {PresenceData, SectorSummary} from '../../utils/presence';

type Props = {
  onCenter: (x: number, y: number) => void;
  colorMode?: 'status' | 'race' | 'player';
  sectorData?: PresenceData | null; // aperçu par secteurs (couche présence)
  focusPlayer?: number | null; // commandant isolé
};

function torusDelta(a: number, b: number, max: number): number {
  // delta minimal sur tore de a -> b (dans [-max/2, max/2])
  let d = b - a;
  const half = max / 2;
  while (d > half) d -= max;
  while (d < -half) d += max;
  return d;
}

export default function MiniMap({ onCenter, colorMode = 'status', sectorData = null, focusPlayer = null }: Props) {
  const { rapport, center, viewportCols, viewportRows, global } = useReport();
  const currentCenter = useMemo(() => center || CENTER, [center]);
  const ref = useRef<HTMLCanvasElement>(null);
  const playerId = rapport?.joueur?.numero || 0;
  const [hoverSector, setHoverSector] = useState<{ key: string; summary: SectorSummary } | null>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth * dpr;
    const h = cvs.clientHeight * dpr;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(0, 0, cvs.clientWidth, cvs.clientHeight);

    // Si on a un centre, on centre la minimap dessus
    const midX = cvs.clientWidth / 2;  // horizontal (colonnes/Y)
    const midY = cvs.clientHeight / 2; // vertical (lignes/X)

    const cellW = cvs.clientWidth / BOUNDS.maxY; // largeur d'une colonne
    const cellH = cvs.clientHeight / BOUNDS.maxX; // hauteur d'une ligne
    const cellCenter = (x: number, y: number): { px: number; py: number } => {
      const dRow = torusDelta(currentCenter.x, x, BOUNDS.maxX); // déplacement en lignes
      const dCol = torusDelta(currentCenter.y, y, BOUNDS.maxY); // déplacement en colonnes
      return { px: midX + (dCol / BOUNDS.maxY) * cvs.clientWidth, py: midY + (dRow / BOUNDS.maxX) * cvs.clientHeight };
    };

    // Aperçu par secteurs : teinte la case à la couleur du commandant dominant du secteur
    // (ou du commandant focus, si un focus est actif). Un secteur sans donnée reste sombre.
    if (sectorData) {
      let maxCount = 0;
      sectorData.sectors.forEach(sec => {
        const c = focusPlayer != null
          ? (sec.counts.get(focusPlayer) || 0)
          : (sec.dominant >= 0 ? (sec.counts.get(sec.dominant) || 0) : 0);
        if (c > maxCount) maxCount = c;
      });
      if (maxCount <= 0) maxCount = 1;
      for (let x = 1; x <= BOUNDS.maxX; x++) {
        for (let y = 1; y <= BOUNDS.maxY; y++) {
          const { row, col } = getSectorGridCoords(x, y);
          const sec = sectorData.sectors.get(`${row}_${col}`);
          if (!sec) continue;
          let owner = -1;
          let count = 0;
          if (focusPlayer != null) {
            const f = sec.counts.get(focusPlayer) || 0;
            if (f > 0) { owner = focusPlayer; count = f; }
          } else {
            owner = sec.dominant;
            count = owner >= 0 ? (sec.counts.get(owner) || 0) : 0;
          }
          if (owner < 0 || count <= 0) continue;
          const { px, py } = cellCenter(x, y);
          ctx.globalAlpha = 0.10 + 0.30 * Math.min(1, count / maxCount);
          ctx.fillStyle = colorForOwnership(playerId, [owner], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global);
          ctx.fillRect(px - cellW / 2, py - cellH / 2, cellW, cellH);
        }
      }
      ctx.globalAlpha = 1;
    }

    const drawPointRel = (x: number, y: number, color: string) => {
      const { px, py } = cellCenter(x, y);
      ctx.fillStyle = color;
      ctx.fillRect(px, py, 2, 2);
    };

    rapport?.systemesJoueur.forEach(s => drawPointRel(s.pos.x, s.pos.y,
        colorForOwnership(playerId, [playerId], [], [], colorMode, global)
    ));
    rapport?.systemesDetectes.forEach(s => drawPointRel(s.pos.x, s.pos.y,
        colorForOwnership(playerId, s.proprietaires, rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global)
    ));
    rapport?.flottesJoueur.forEach(f => drawPointRel(f.pos.x, f.pos.y,
        colorForOwnership(playerId, [playerId], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global)
    ));
    rapport?.flottesDetectees.forEach(f => drawPointRel(f.pos.x, f.pos.y,
        colorForOwnership(playerId, [f.proprio || 0], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global)
    ));

    // Rectangle du viewport, centré au milieu de la minimap
    if (viewportCols > 0 && viewportRows > 0) {
      const rectW = Math.min(1, viewportCols / BOUNDS.maxY) * cvs.clientWidth;
      const rectH = Math.min(1, viewportRows / BOUNDS.maxX) * cvs.clientHeight;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(midX - rectW / 2, midY - rectH / 2, rectW, rectH);
    }
  }, [rapport, playerId, currentCenter, viewportCols, viewportRows, colorMode, global, sectorData, focusPlayer]);

  // Secteur sous le curseur (même math que le clic, sans arrondi) -> infobulle de composition
  const sectorAtCursor = (e: React.MouseEvent<HTMLCanvasElement>): { key: string; summary: SectorSummary } | null => {
    if (!sectorData) return null;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const clickYpx = e.clientY - rect.top;
    const clickXpx = e.clientX - rect.left;
    const midX = rect.width / 2;
    const midY = rect.height / 2;

    const dRows = ((clickYpx - midY) / rect.height) * BOUNDS.maxX;
    const dCols = ((clickXpx - midX) / rect.width) * BOUNDS.maxY;

    const nx = wrapX(Math.round(currentCenter.x + dRows));
    const ny = wrapY(Math.round(currentCenter.y + dCols));
    const { row, col } = getSectorGridCoords(nx, ny);
    const key = `${row}_${col}`;
    const summary = sectorData.sectors.get(key);
    return summary ? { key, summary } : null;
  };

  return (
    <div className="mini-map-wrap">
      <canvas
        ref={ref}
        className="mini-map"
        onClick={(e) => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const clickYpx = e.clientY - rect.top;    // vertical -> lignes X
          const clickXpx = e.clientX - rect.left;    // horizontal -> colonnes Y
          const midX = rect.width / 2;
          const midY = rect.height / 2;

          // Offsets relatifs au centre courant
          const dRows = Math.round(((clickYpx - midY) / rect.height) * BOUNDS.maxX);
          const dCols = Math.round(((clickXpx - midX) / rect.width) * BOUNDS.maxY);

          // Nouveau centre sur le tore
          const nx = wrapX(currentCenter.x + dRows);
          const ny = wrapY(currentCenter.y + dCols);
          onCenter(nx, ny);
        }}
        onMouseMove={(e) => {
          const s = sectorAtCursor(e);
          setHoverSector(prev => (s && prev && prev.key === s.key) ? prev : s);
        }}
        onMouseLeave={() => setHoverSector(null)}
      />
      {sectorData && hoverSector && (
        <div className="mini-map-tooltip">
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Secteur {hoverSector.summary.row + 1}·{hoverSector.summary.col + 1}
          </div>
          {Array.from(hoverSector.summary.counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([owner, count]) => (
              <div key={owner} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorForOwnership(playerId, [owner], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global), display: 'inline-block' }} />
                <span>{owner === playerId ? 'moi' : `#${owner}`}</span>
                <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{Math.round(count * 10) / 10}</span>
              </div>
            ))}
          {hoverSector.summary.neutral > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
              <span>neutres</span>
              <span style={{ marginLeft: 'auto' }}>{Math.round(hoverSector.summary.neutral * 10) / 10}</span>
            </div>
          )}
          {hoverSector.summary.unobserved > 0 && (
            <div style={{ color: '#64748b', fontSize: '0.9em', marginTop: 2 }}>
              {hoverSector.summary.unobserved} système(s) jamais observé(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}