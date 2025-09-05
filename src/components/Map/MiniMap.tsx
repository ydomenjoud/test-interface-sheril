import React, { useEffect, useRef } from 'react';
import { useReport } from '../../context/ReportContext';
import { BOUNDS } from '../../utils/position';

type Props = {
  onCenter: (x: number, y: number) => void;
};

export default function MiniMap({ onCenter }: Props) {
  const { rapport } = useReport();
  const ref = useRef<HTMLCanvasElement>(null);

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
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, cvs.clientWidth, cvs.clientHeight);

    const drawPoint = (x: number, y: number, color: string) => {
      const px = (y - 1) / (BOUNDS.maxY - 1) * cvs.clientWidth;
      const py = (x - 1) / (BOUNDS.maxX - 1) * cvs.clientHeight;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, 2, 2);
    };

    rapport?.systemesJoueur.forEach(s => drawPoint(s.pos.x, s.pos.y, '#0f0'));
    rapport?.systemesDetectes.forEach(s => drawPoint(s.pos.x, s.pos.y, '#f00'));
    rapport?.flottesJoueur.forEach(f => drawPoint(f.pos.x, f.pos.y, '#0f0'));
    rapport?.flottesDetectees.forEach(f => drawPoint(f.pos.x, f.pos.y, '#ff0'));
  }, [rapport]);

  return (
    <canvas
      ref={ref}
      className="mini-map"
      onClick={(e) => {
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const x = e.clientY - rect.top;
        const y = e.clientX - rect.left;
        const gridX = Math.round(1 + (x / rect.height) * (BOUNDS.maxX - 1));
        const gridY = Math.round(1 + (y / rect.width) * (BOUNDS.maxY - 1));
        onCenter(gridX, gridY);
      }}
    />
  );
}
