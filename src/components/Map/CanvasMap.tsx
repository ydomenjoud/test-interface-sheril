import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS, torusDelta, wrapX, wrapY} from '../../utils/position';
import {Alliance, XY} from '../../types';

type Props = {
    onSelect: (xy: XY) => void;
};

export function colorForOwnership(currentPlayerId?: number, owners?: number[], alliances?: Alliance[], pna?: number[]) {
    if (owners && owners?.length === 1 && owners[0] === 0) return 'grey';
    if (!owners || owners.length === 0) return '#999';
    const owner = owners[0];
    if (currentPlayerId && owners.includes(currentPlayerId)) return '#09ca31';
    if (alliances && alliances.some(a => a.commandants.includes(owner))) return '#4945e4';
    if (pna && pna.includes(owner)) return 'yellow';
    return '#fb3a3a';
}

// Cache persistant des images d'étoiles (évite de recréer les Image à chaque rendu)
const starImageCache: Record<number, HTMLImageElement> = {};

export default function CanvasMap({onSelect}: Props) {
    const {rapport, cellSize, center, setCenter, setViewportDims} = useReport();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Ref sur le center pour des mises à jour synchrones dans le drag
    const centerRef = useRef<XY | undefined>(center);
    useEffect(() => {
        centerRef.current = center;
    }, [center]);

    // Gestion du drag
    const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0, accX: 0, accY: 0 });

    // Préchargement et re-render des images
    const [assetsVersion, setAssetsVersion] = useState(0);
    const shipImgRef = useRef<HTMLImageElement | null>(null);

    // Redraw quand le canvas change de taille (évite l'étirement non proportionnel)
    const [canvasSizeVersion, setCanvasSizeVersion] = useState(0);

    useEffect(() => {
        if (!shipImgRef.current) {
            const img = new Image();
            img.onload = () => setAssetsVersion(v => v + 1);
            img.src = `${process.env.PUBLIC_URL}/img/flotte.png`;
            shipImgRef.current = img;
        }
    }, []);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ro = new ResizeObserver(() => {
            setCanvasSizeVersion(v => v + 1);
        });
        ro.observe(cvs);
        return () => ro.disconnect();
    }, []);

    const currentPlayerId = rapport?.joueur.numero || 0; // placeholder si besoin d'ID joueur

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
    }, [rapport, currentPlayerId]);

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
    }, [rapport, currentPlayerId]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs || !center) return;
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(cvs.clientWidth * dpr);
        const height = Math.round(cvs.clientHeight * dpr);
        if (cvs.width !== width) cvs.width = width;
        if (cvs.height !== height) cvs.height = height;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        // Toujours repartir d'une transform neutre avant d'appliquer le scale DPR
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // fond
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cvs.clientWidth, cvs.clientHeight);

        // dimensions
        const cols = Math.floor(cvs.clientWidth / cellSize);
        const rows = Math.floor(cvs.clientHeight / cellSize);
        const halfCols = Math.floor(cols / 2);
        const halfRows = Math.floor(rows / 2);
        // informer le contexte pour la minimap
        setViewportDims(cols, rows);

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

        // Utilise le cache persistant des images d'étoiles
        function getStarImg(t: number): HTMLImageElement {
            let img = starImageCache[t];
            if (!img) {
                img = new Image();
                img.onload = () => setAssetsVersion(v => v + 1);
                img.src = `${process.env.PUBLIC_URL}/img/etoile${t}.png`;
                starImageCache[t] = img;
            }
            return img;
        }

        const shipImg = shipImgRef.current;

        // systèmes
        systems.forEach(s => {
            const dx = ((s.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
            const dy = ((s.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
            const px = dx * cellSize;
            const py = dy * cellSize;
            if (px < 0 || py < 0 || px >= cols * cellSize || py >= rows * cellSize) return;

            const img = getStarImg(s.typeEtoile);
            if (img.complete && img.naturalWidth > 0) {
                (ctx as CanvasRenderingContext2D).drawImage(img, px, py, cellSize, cellSize);
            }

            const col = colorForOwnership(currentPlayerId, s.owners, rapport?.joueur.alliances, rapport?.joueur.pna);
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
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
            if (shipImg && shipImg.complete && shipImg.naturalWidth > 0) {
                (ctx as CanvasRenderingContext2D).drawImage(shipImg, px + cellSize - size, py, size, size);
            }
            const col = colorForOwnership(currentPlayerId, [(f as any).owner], rapport?.joueur.alliances, rapport?.joueur.pna);
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            ctx.strokeRect(px + cellSize - size, py, size, size);

            // Flèche de direction (flottes du joueur uniquement, si "direction" est défini)
            const dirStr = (f as any).direction as string | undefined;
            if (dirStr) {
                const parseGridPos = (s: string) => {
                    // format attendu: "gal_y_x"
                    const parts = s.split('_');
                    if (parts.length < 3) return undefined;
                    const y = Number(parts[1]);
                    const x = Number(parts[2]);
                    if (Number.isNaN(x) || Number.isNaN(y)) return undefined;
                    return { x, y };
                };
                const t = parseGridPos(dirStr);
                if (t) {
                    const tdx = ((t.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
                    const tdy = ((t.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
                    const tx = tdx * cellSize + cellSize / 2;
                    const ty = tdy * cellSize + cellSize / 2;

                    // ne tracer que si la cible est dans le viewport
                    if (tx >= 0 && ty >= 0 && tx <= cols * cellSize && ty <= rows * cellSize) {
                        const sx = px + cellSize / 2;
                        const sy = py + cellSize / 2;

                        // dessiner une flèche orange
                        const drawArrow = (c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
                            const headLen = Math.max(6, Math.floor(cellSize * 0.25));
                            const angle = Math.atan2(y2 - y1, x2 - x1);
                            c.save();
                            c.strokeStyle = '#ff9800';
                            c.fillStyle = '#ff9800';
                            c.lineWidth = 2;
                            c.beginPath();
                            c.moveTo(x1, y1);
                            c.lineTo(x2, y2);
                            c.stroke();
                            // pointe de flèche
                            c.beginPath();
                            c.moveTo(x2, y2);
                            c.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                            c.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                            c.closePath();
                            c.fill();
                            c.restore();
                        };

                        drawArrow(ctx as CanvasRenderingContext2D, sx, sy, tx, ty);
                    }
                }
            }
        });

    }, [rapport, systems, fleets, cellSize, center, currentPlayerId, assetsVersion, setViewportDims, canvasSizeVersion]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (!center) return;
            const step = e.ctrlKey ? 5 : 1;
            if (e.key === 'ArrowUp') {
                setCenter({x: wrapX(center.x - step), y: center.y});
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                setCenter({x: wrapX(center.x + step), y: center.y});
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                setCenter({x: center.x, y: wrapY(center.y - step)});
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                setCenter({x: center.x, y: wrapY(center.y + step)});
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

        onSelect({x, y});
    };

    const handleMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
        if (evt.button !== 0) return; // seulement clic gauche
        dragRef.current.dragging = true;
        dragRef.current.lastX = evt.clientX;
        dragRef.current.lastY = evt.clientY;
        dragRef.current.accX = 0;
        dragRef.current.accY = 0;
        evt.preventDefault();

        const onMove = (e: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;
            dragRef.current.accX += dx;
            dragRef.current.accY += dy;

            let stepY = 0; // variation sur l'axe Y de la carte (colonnes)
            let stepX = 0; // variation sur l'axe X de la carte (lignes)

            while (Math.abs(dragRef.current.accX) >= cellSize) {
                if (dragRef.current.accX > 0) {
                    stepY -= 1; // déplacement souris vers la droite => carte suit => center.y diminue
                    dragRef.current.accX -= cellSize;
                } else {
                    stepY += 1;
                    dragRef.current.accX += cellSize;
                }
            }

            while (Math.abs(dragRef.current.accY) >= cellSize) {
                if (dragRef.current.accY > 0) {
                    stepX -= 1; // déplacement souris vers le bas => carte suit => center.x diminue
                    dragRef.current.accY -= cellSize;
                } else {
                    stepX += 1;
                    dragRef.current.accY += cellSize;
                }
            }

            if ((stepX !== 0 || stepY !== 0) && centerRef.current) {
                const next = {
                    x: wrapX(centerRef.current.x + stepX),
                    y: wrapY(centerRef.current.y + stepY),
                };
                centerRef.current = next;
                setCenter(next);
            }
        };

        const onUp = () => {
            dragRef.current.dragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [cellSize, setCenter]);

    return (
        <div className="canvas-host">
            <canvas
                ref={canvasRef}
                style={{width: '100%', height: '100vh'}}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
            />
        </div>
    );
}
