import React, { useEffect, useRef } from 'react';
import { useReport } from '../../context/ReportContext';
import { BOUNDS, wrapX, wrapY } from '../../utils/position';
import {colorForOwnership} from "./CanvasMap";

type Props = {
  onCenter: (x: number, y: number) => void;
};

function torusDelta(a: number, b: number, max: number): number {
  // delta minimal sur tore de a -> b (dans [-max/2, max/2])
  let d = b - a;
  const half = max / 2;
  while (d > half) d -= max;
  while (d < -half) d += max;
  return d;
}

export default function MiniMap({ onCenter }: Props) {
  const { rapport, center, viewportCols, viewportRows } = useReport();
  const ref = useRef<HTMLCanvasElement>(null);
  const playerId = rapport?.joueur?.numero || 0;

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
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, cvs.clientWidth, cvs.clientHeight);

    // Si on a un centre, on centre la minimap dessus
    const midX = cvs.clientWidth / 2;  // horizontal (colonnes/Y)
    const midY = cvs.clientHeight / 2; // vertical (lignes/X)

    const drawPointRel = (x: number, y: number, color: string) => {
      if (!center) return;
      const dRow = torusDelta(center.x, x, BOUNDS.maxX); // déplacement en lignes
      const dCol = torusDelta(center.y, y, BOUNDS.maxY); // déplacement en colonnes
      const px = midX + (dCol / BOUNDS.maxY) * cvs.clientWidth;
      const py = midY + (dRow / BOUNDS.maxX) * cvs.clientHeight;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, 2, 2);
    };

    rapport?.systemesJoueur.forEach(s => drawPointRel(s.pos.x, s.pos.y,
        colorForOwnership(playerId, [playerId], [], [])
    ));
    rapport?.systemesDetectes.forEach(s => drawPointRel(s.pos.x, s.pos.y,
        colorForOwnership(playerId, s.proprietaires, rapport?.joueur.alliances, rapport?.joueur.pna)
    ));
    rapport?.flottesJoueur.forEach(f => drawPointRel(f.pos.x, f.pos.y,
        colorForOwnership(playerId, [playerId], rapport?.joueur.alliances, rapport?.joueur.pna)
    ));
    rapport?.flottesDetectees.forEach(f => drawPointRel(f.pos.x, f.pos.y,
        colorForOwnership(playerId, [f.proprio || 0], rapport?.joueur.alliances, rapport?.joueur.pna)
    ));

    // Rectangle du viewport, centré au milieu de la minimap
    if (center && viewportCols > 0 && viewportRows > 0) {
      const rectW = Math.min(1, viewportCols / BOUNDS.maxY) * cvs.clientWidth;
      const rectH = Math.min(1, viewportRows / BOUNDS.maxX) * cvs.clientHeight;
      ctx.strokeStyle = '#71deff';
      ctx.lineWidth = 2;
      ctx.strokeRect(midX - rectW / 2, midY - rectH / 2, rectW, rectH);
    }
  }, [rapport, playerId, center, viewportCols, viewportRows]);

  return (
    <canvas
      ref={ref}
      className="mini-map"
      onClick={(e) => {
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const clickYpx = e.clientY - rect.top;    // vertical -> lignes X
        const clickXpx = e.clientX - rect.left;   // horizontal -> colonnes Y
        const midX = rect.width / 2;
        const midY = rect.height / 2;

        // Offsets relatifs au centre courant
        const dRows = Math.round(((clickYpx - midY) / rect.height) * BOUNDS.maxX);
        const dCols = Math.round(((clickXpx - midX) / rect.width) * BOUNDS.maxY);

        // Nouveau centre sur le tore
        if (center) {
          const nx = wrapX(center.x + dRows);
          const ny = wrapY(center.y + dCols);
          onCenter(nx, ny);
        }
      }}
    />
  );
}
