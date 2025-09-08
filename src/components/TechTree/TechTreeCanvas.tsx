import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Technologie } from '../../types';

type Props = {
  techs: Technologie[];
  knownCodes: Set<string>;
  selectedCode?: string;
  onSelect: (code: string) => void;
  initialCodes: string[]; // codes à afficher quand rien n'est sélectionné
  parentsDepth: number;
  childrenDepth: number;
};

type NodeRect = {
  code: string;
  x: number; // coords logiques (monde)
  y: number; // coords logiques (monde)
  w: number;
  h: number;
  color: string;
  label: string;
  known: boolean;
  stroke?: string; // couleur de bordure (orange pour parents, bleu pour enfants)
};

function toRoman(n: number): string {
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  if (n <= 0) return romans[0];
  if (n >= romans.length) return romans[romans.length - 1];
  return romans[n];
}
function romanFromNiv(niv?: number): string {
  const lvl = Math.max(1, Math.min(10, ((niv ?? 0) + 1)));
  return toRoman(lvl);
}
function formatTechName(t?: Technologie): string {
  if (!t) return '';
  return `${t.nom} ${romanFromNiv(t.niv)}`;
}

export default function TechTreeCanvas({
  techs,
  knownCodes,
  selectedCode,
  onSelect,
  initialCodes,
  parentsDepth,
  childrenDepth
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(1);
  const isPanningRef = useRef(false);
  const dragMovedRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });


  console.log(knownCodes)
  const techByCode = useMemo(() => {
    const m = new Map<string, Technologie>();
    techs.forEach(t => m.set(t.code, t));
    return m;
  }, [techs]);

  const childrenMap = useMemo(() => {
    const cmap = new Map<string, string[]>();
    techs.forEach(t => {
      t.parents?.forEach(p => {
        if (!cmap.has(p)) cmap.set(p, []);
        cmap.get(p)!.push(t.code);
      });
    });
    return cmap;
  }, [techs]);

  // Resize observer pour ajuster la taille du canvas au conteneur
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Helper pour construire niveaux d'ancêtres
  const buildAncestorLevels = useCallback((code: string, depth: number): string[][] => {
    const levels: string[][] = [];
    const visited = new Set<string>([code]);
    let frontier = (techByCode.get(code)?.parents ?? []).filter(c => techByCode.has(c));
    for (let d = 0; d < depth && frontier.length; d++) {
      const uniq = Array.from(new Set(frontier)).filter(c => !visited.has(c));
      levels.push(uniq);
      uniq.forEach(c => visited.add(c));
      frontier = uniq.flatMap(c => techByCode.get(c)?.parents ?? []).filter(c => techByCode.has(c));
    }
    return levels;
  }, [techByCode]);

  // Helper pour construire niveaux de descendants
  const buildDescendantLevels = useCallback((code: string, depth: number): string[][] => {
    const levels: string[][] = [];
    const visited = new Set<string>([code]);
    let frontier = (childrenMap.get(code) ?? []).filter(c => techByCode.has(c));
    for (let d = 0; d < depth && frontier.length; d++) {
      const uniq = Array.from(new Set(frontier)).filter(c => !visited.has(c));
      levels.push(uniq);
      uniq.forEach(c => visited.add(c));
      frontier = uniq.flatMap(c => childrenMap.get(c) ?? []).filter(c => techByCode.has(c));
    }
    return levels;
  }, [childrenMap, techByCode]);

  // Dessin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size.w, size.h);
    ctx.save();

    const baseFont = '14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    const scaledFont = `${Math.max(10, 14 * scale)}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.font = baseFont;

    // Paramètres de layout (unités logiques)
    const nodeHeight = 36;
    const vGap = 16;
    const colWidth = 220;
    const hGap = 80;
    const originX = size.w / 2 + pan.x;
    const originY = size.h / 2 + pan.y;
    const nodePadding = 12;

    const nodes: NodeRect[] = [];
    const nodeByCode = new Map<string, NodeRect>();

    // Helpers
    const measureNodeWidth = (label: string) => {
      // mesurer à l'échelle de base pour des dimensions logiques
      const prev = ctx.font;
      ctx.font = baseFont;
      const tw = ctx.measureText(label).width;
      ctx.font = prev;
      return Math.max(120, tw + nodePadding * 2);
    };
    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, h / 2, w / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    // Construire la liste des nœuds à afficher
    const selected = selectedCode ? techByCode.get(selectedCode) : undefined;

    if (selected) {
      const selLabel = formatTechName(selected);
      const selWidth = measureNodeWidth(selLabel);
      const selNode: NodeRect = {
        code: selected.code,
        x: -selWidth / 2,
        y: -nodeHeight / 2,
        w: selWidth,
        h: nodeHeight,
        color: '#2c3e50',
        label: selLabel,
        known: knownCodes.has(selected.code.toLowerCase()),
      };
      nodes.push(selNode);
      nodeByCode.set(selNode.code, selNode);

      // Niveaux ancêtres (à gauche)
      const leftLevels = buildAncestorLevels(selected.code, Math.max(0, parentsDepth));
      leftLevels.forEach((codes, idx) => {
        const startY = -((codes.length - 1) * (nodeHeight + vGap)) / 2;
        const x = -(selWidth / 2 + hGap + colWidth * (idx + 1));
        codes.forEach((code, i) => {
          const t = techByCode.get(code)!;
          const label = formatTechName(t);
          const w = measureNodeWidth(label);
          const y = startY + i * (nodeHeight + vGap);
          const node: NodeRect = {
            code, x, y, w, h: nodeHeight,
            color: '#f39c12',
            label,
            known: knownCodes.has(code.toLowerCase()),
            stroke: '#f39c12' // bordure orange pour parents
          };
          nodes.push(node);
          nodeByCode.set(code, node);
        });
      });

      // Niveaux descendants (à droite)
      const rightLevels = buildDescendantLevels(selected.code, Math.max(0, childrenDepth));
      rightLevels.forEach((codes, idx) => {
        const startY = -((codes.length - 1) * (nodeHeight + vGap)) / 2;
        const x = selWidth / 2 + hGap + colWidth * idx;
        codes.forEach((code, i) => {
          const t = techByCode.get(code)!;
          const label = formatTechName(t);
          const w = measureNodeWidth(label);
          const y = startY + i * (nodeHeight + vGap);
          const node: NodeRect = {
            code, x, y, w, h: nodeHeight,
            color: '#3498db',
            label,
            known: knownCodes.has(code.toLowerCase()),
            stroke: '#3498db' // bordure bleue pour enfants
          };
          nodes.push(node);
          nodeByCode.set(code, node);
        });
      });

      // Dessiner les arêtes (conversion en pixels avec scale)
      ctx.strokeStyle = '#999';
      ctx.lineWidth = Math.max(1, 2 * scale);

      // Parents immédiats -> sélection
      const immParents = (selected.parents ?? []).filter(c => nodeByCode.has(c));
      immParents.forEach((p) => {
        const nParent = nodeByCode.get(p)!;
        const aX = originX + (nParent.x + nParent.w) * scale;
        const aY = originY + (nParent.y + nParent.h / 2) * scale;
        const bX = originX + (selNode.x) * scale;
        const bY = originY + (selNode.y + selNode.h / 2) * scale;
        ctx.beginPath();
        ctx.moveTo(aX, aY);
        ctx.lineTo(bX, bY);
        ctx.stroke();
      });

      // Ancêtres entre colonnes (L -> L-1)
      for (let li = 1; li < leftLevels.length; li++) {
        const level = leftLevels[li];
        const prevLevelSet = new Set(leftLevels[li - 1]);
        level.forEach(code => {
          const node = nodeByCode.get(code)!;
          const children = (childrenMap.get(code) ?? []).filter(c => prevLevelSet.has(c));
          children.forEach(ch => {
            const nChild = nodeByCode.get(ch);
            if (!nChild) return;
            const aX = originX + (node.x + node.w) * scale;
            const aY = originY + (node.y + node.h / 2) * scale;
            const bX = originX + (nChild.x) * scale;
            const bY = originY + (nChild.y + nChild.h / 2) * scale;
            ctx.beginPath();
            ctx.moveTo(aX, aY);
            ctx.lineTo(bX, bY);
            ctx.stroke();
          });
        });
      }

      // Sélection -> enfants immédiats
      const immChildren = (childrenMap.get(selected.code) ?? []).filter(c => nodeByCode.has(c));
      immChildren.forEach(ch => {
        const nChild = nodeByCode.get(ch)!;
        const aX = originX + (selNode.x + selNode.w) * scale;
        const aY = originY + (selNode.y + selNode.h / 2) * scale;
        const bX = originX + (nChild.x) * scale;
        const bY = originY + (nChild.y + nChild.h / 2) * scale;
        ctx.beginPath();
        ctx.moveTo(aX, aY);
        ctx.lineTo(bX, bY);
        ctx.stroke();
      });

      // Descendants entre colonnes (L-1 -> L)
      for (let ri = 1; ri < rightLevels.length; ri++) {
        const level = rightLevels[ri];
        const prevLevelSet = new Set(rightLevels[ri - 1]);
        level.forEach(code => {
          const node = nodeByCode.get(code)!;
          const parents = (techByCode.get(code)?.parents ?? []).filter(p => prevLevelSet.has(p));
          parents.forEach(p => {
            const nParent = nodeByCode.get(p);
            if (!nParent) return;
            const aX = originX + (nParent.x + nParent.w) * scale;
            const aY = originY + (nParent.y + nParent.h / 2) * scale;
            const bX = originX + (node.x) * scale;
            const bY = originY + (node.y + node.h / 2) * scale;
            ctx.beginPath();
            ctx.moveTo(aX, aY);
            ctx.lineTo(bX, bY);
            ctx.stroke();
          });
        });
      }
    } else {
      // Affichage initial: seulement les technos connues de niveau le plus bas (par base)
      const list = initialCodes
        .map(code => techByCode.get(code))
        .filter((t): t is Technologie => Boolean(t));
      const startY = -((list.length - 1) * (nodeHeight + vGap)) / 2;
      list.forEach((t, idx) => {
        const label = formatTechName(t);
        const w = measureNodeWidth(label);
        const x = -w / 2;
        const y = startY + idx * (nodeHeight + vGap);
        const isKnown = knownCodes.has(t.code.toLowerCase());
        // La couleur de base (non connue) reste grise, si connu le fill sera forcé à vert foncé au dessin
        const color = isKnown ? '#2c3e50' : '#777';
        const node: NodeRect = { code: t.code, x, y, w, h: nodeHeight, color, label, known: isKnown };
        nodes.push(node);
      });
    }

    // Dessiner les nœuds (avec scale)
    ctx.font = scaledFont;
    nodes.forEach(n => {
      const screenX = originX + n.x * scale;
      const screenY = originY + n.y * scale;
      const w = n.w * scale;
      const h = n.h * scale;
      // Fond
      drawRoundRect(screenX, screenY, w, h, 8 * scale);
      const fillColor = n.known ? '#145a32' /* vert foncé */ : '#666666' /* gris pour inconnu */;
      ctx.fillStyle = fillColor;
      ctx.fill();
      // Bordure
      ctx.lineWidth = Math.max(1, 2 * scale);
      const isSelected = (selectedCode && n.code === selectedCode);
      const strokeColor = isSelected ? '#ecf0f1' : (n.stroke ?? '#222');
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // Texte
      ctx.fillStyle = '#ecf0f1';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, screenX + w / 2, screenY + h / 2);
    });

    // Stocker les rectangles sur l'élément pour le hit-test (coords écran)
    (canvas as any).__nodeRects = nodes.map(n => ({
      code: n.code,
      x: originX + n.x * scale,
      y: originY + n.y * scale,
      w: n.w * scale,
      h: n.h * scale,
    }));

    ctx.restore();
  }, [techs, knownCodes, selectedCode, childrenMap, techByCode, size, pan, scale, initialCodes, parentsDepth, childrenDepth, buildAncestorLevels, buildDescendantLevels]);

  // Interaction: pan au clic gauche, sélection si pas de drag, zoom à la molette
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      isPanningRef.current = true;
      dragMovedRef.current = false;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      dragMovedRef.current = true;
    }
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      // Si pas de drag, traiter comme un clic de sélection
      if (!dragMovedRef.current) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rects: Array<{ code: string; x: number; y: number; w: number; h: number }> = (canvas as any).__nodeRects || [];
          const bounds = canvas.getBoundingClientRect();
          const x = e.clientX - bounds.left;
          const y = e.clientY - bounds.top;
          const hit = rects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
          if (hit) onSelect(hit.code);
        }
      }
      isPanningRef.current = false;
    }
  };
  const onMouseLeave = () => {
    isPanningRef.current = false;
  };
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const mx = e.clientX - bounds.left;
    const my = e.clientY - bounds.top;

    // convertir en coords monde
    const originX = size.w / 2 + pan.x;
    const originY = size.h / 2 + pan.y;
    const worldX = (mx - originX) / scale;
    const worldY = (my - originY) / scale;

    const zoomFactor = Math.pow(1.1, -e.deltaY / 100); // deltaY<0 => zoom in
    const newScale = clamp(scale * zoomFactor, 0.3, 3);

    // ajuster pan pour zoom-to-pointer
    const newOriginX = mx - worldX * newScale;
    const newOriginY = my - worldY * newScale;
    const newPanX = newOriginX - size.w / 2;
    const newPanY = newOriginY - size.h / 2;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0b0e14', position: 'relative', border: '1px solid #222' }}>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        style={{ display: 'block', width: '100%', height: '100%', cursor: isPanningRef.current ? 'grabbing' : 'grab' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          color: '#9aa2b1',
          fontSize: 12,
          opacity: 0.8,
          userSelect: 'none'
        }}
      >
        Astuces: clic gauche + déplacement pour se déplacer • Molette pour zoomer
      </div>
    </div>
  );
}
