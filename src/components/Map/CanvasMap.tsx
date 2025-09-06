import React, { useEffect, useMemo, useRef } from 'react';
import { useReport } from '../../context/ReportContext';
import { BOUNDS, torusDelta, wrapX, wrapY } from '../../utils/position';
import { XY } from '../../types';

type Props = {
  onSelect: (xy: XY) => void;
};

function colorForOwnership(currentPlayerId?: number, owners?: number[], alliances?: number[], pna?: number[]) {
  if (!owners || owners.length === 0) return '#999';
  const owner = owners[0];
  if (currentPlayerId && owners.includes(currentPlayerId)) return 'green';
  if (alliances && alliances.includes(owner)) return 'blue';
  if (pna && pna.includes(owner)) return 'yellow';
  return 'red';
}

export default function CanvasMap({ onSelect }: Props) {
  const { rapport, cellSize, center, setCenter } = useReport();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentPlayerId = 0; // placeholder si besoin d'ID joueur

  const systems = useMemo(() => {
    if (!rapport) return [];
    return [
      ...rapport.systemesJoueur.map(s => ({
        ...s,
        owners: s.proprietaires?.length ? s.proprietaires : [currentPlayerId],
      })),
      ...rapport.systemesDetectes.map(s => ({
        ...s,
        owners: s.proprietaires,
      })),
    ];
  }, [rapport]);

  const fleets = useMemo(() => {
    if (!rapport) return [];
    return [
      ...rapport.flottesJoueur.map(f => ({
        ...f,
        owner: currentPlayerId,
      })),
      ...rapport.flottesDetectees.map(f => ({
        ...f,
        owner: f.proprio,
      })),
    ];
  }, [rapport]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !center) return;
    const dpr = window.devicePixelRatio || 1;
    const width = cvs.clientWidth * dpr;
    const height = cvs.clientHeight * dpr;
    cvs.width = width;
    cvs.height = height;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // fond
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cvs.clientWidth, cvs.clientHeight);

    // dimensions
    const cols = Math.floor(cvs.clientWidth / cellSize);
    const rows = Math.floor(cvs.clientHeight / cellSize);
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);

    const topX = wrapX(center.x - halfRows);
    const leftY = wrapY(center.y - halfCols);

    // grille + en-têtes
    for (let r = 0; r <= rows; r++) {
      const xCoord = torusDelta(center.x, r - halfRows, BOUNDS.maxX);
      const yPos = r * cellSize;
      if ((xCoord - 1) % 20 === 0) ctx.strokeStyle = '#123b66';
      else if ((xCoord - 1) % 5 === 0) ctx.strokeStyle = '#661212';
      else ctx.strokeStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(cols * cellSize, yPos);
      ctx.stroke();

      ctx.fillStyle = '#ccc';
      ctx.font = '12px sans-serif';
      ctx.fillText(String(xCoord), 4, yPos + 12);
    }

    for (let c = 0; c <= cols; c++) {
      const yCoord = torusDelta(center.y, c - halfCols, BOUNDS.maxY);
      const xPos = c * cellSize;
      if ((yCoord - 1) % 20 === 0) ctx.strokeStyle = '#123b66';
      else if ((yCoord - 1) % 5 === 0) ctx.strokeStyle = '#661212';
      else ctx.strokeStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, rows * cellSize);
      ctx.stroke();

      ctx.fillStyle = '#ccc';
      ctx.font = '12px sans-serif';
      ctx.fillText(String(yCoord), xPos + 4, 12);
    }

    // cache images
    const etoileCache: Record<number, HTMLImageElement> = {};
    function getStarImg(t: number): HTMLImageElement {
      if (!etoileCache[t]) {
        const img = new Image();
        img.src = `/img/etoile${t}.gif`;
        etoileCache[t] = img;
      }
      return etoileCache[t];
    }
    const shipImg = new Image();
    shipImg.src = '/img/flotte.png';

    // systèmes
    systems.forEach(s => {
      const dx = ((s.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
      const dy = ((s.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
      const px = dx * cellSize;
      const py = dy * cellSize;
      if (px < 0 || py < 0 || px >= cols * cellSize || py >= rows * cellSize) return;

      const img = getStarImg(s.typeEtoile);
      try { (ctx as CanvasRenderingContext2D).drawImage(img, px, py, cellSize, cellSize); } catch {}

      const col = colorForOwnership(currentPlayerId, (s as any).owners, rapport?.joueur.alliances, rapport?.joueur.pna);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    });

    // flottes
    fleets.forEach(f => {
      const dx = ((f.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
      const dy = ((f.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
      const px = dx * cellSize;
      const py = dy * cellSize;
      if (px < 0 || py < 0 || px >= cols * cellSize || py >= rows * cellSize) return;

      const size = Math.max(16, Math.floor(cellSize * 0.5));
      try {
          (ctx as CanvasRenderingContext2D).drawImage(shipImg, px + cellSize - size, py, size, size);
          // console.log(shipImg, px + cellSize - size, py, size, size)

      } catch(e) { console.error(e);}
      const col = colorForOwnership(currentPlayerId, [ (f as any).owner ], rapport?.joueur.alliances, rapport?.joueur.pna);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + cellSize - size, py, size, size);
    });

  }, [rapport, systems, fleets, cellSize, center]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!center) return;
      const step = e.ctrlKey ? 5 : 1;
      if (e.key === 'ArrowUp') {
        setCenter({ x: wrapX(center.x - step), y: center.y });
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setCenter({ x: wrapX(center.x + step), y: center.y });
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        setCenter({ x: center.x, y: wrapY(center.y - step) });
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        setCenter({ x: center.x, y: wrapY(center.y + step) });
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [center, setCenter]);

  const handleClick = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = evt.clientX - rect.left;
    const cy = evt.clientY - rect.top;
    const col = Math.floor(cx / cellSize);
    const row = Math.floor(cy / cellSize);

    if (!center || !canvasRef.current) return;

    const cols = Math.floor(canvasRef.current.clientWidth / cellSize);
    const rows = Math.floor(canvasRef.current.clientHeight / cellSize);
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);

    const x = torusDelta(center.x, row - halfRows, BOUNDS.maxX);
    const y = torusDelta(center.y, col - halfCols, BOUNDS.maxY);

    onSelect({ x, y });
  };

  return (
    <div className="canvas-host">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        onClick={handleClick}
      />
    </div>
  );
}
