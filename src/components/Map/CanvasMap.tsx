import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS, torusDelta, wrapX, wrapY} from '../../utils/position';
import {Alliance, XY} from '../../types';
import {lightenHexColor} from "../../utils/global";

type Props = {
    onSelect: (xy: XY) => void;
    selectedOwners?: number[]; // liste des commandants sélectionnés pour filtrage visuel
};

export function colorForOwnership(currentPlayerId?: number, owners?: number[], alliances?: Alliance[], pna?: number[]) {
    if (owners && owners?.length === 1 && owners[0] === 0) return 'grey';
    if (!owners || owners.length === 0) return '#999';

    // si y'en a plusieurs en enlevant le neutre
    if (owners.length > 1 ){
        const withoutNeutral = owners.filter(o => o !== 0);
        // si tous pareil, on renvoit la couleur,
        const colors: Set<string> = new Set(withoutNeutral.map(o => colorForOwnership(currentPlayerId, [o], alliances, pna)));
        if(colors.size === 1) {
            return colors.values().next().value;
        } else {
            return '#ff9540';
        }
        // sinon on renvoi jaune
    }

    const owner = owners[0];
    if (currentPlayerId && owners.includes(currentPlayerId)) return '#09ca31';
    if (alliances && alliances.some(a => a.commandants.includes(owner))) return '#224eff';
    if (pna && pna.includes(owner)) return 'yellow';
    return '#f80c0c';
}

export default function CanvasMap({onSelect, selectedOwners}: Props) {
    const {rapport, cellSize, center, setCenter, setViewportDims} = useReport();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Ref sur le center pour des mises à jour synchrones dans le drag
    const centerRef = useRef<XY | undefined>(center);
    useEffect(() => {
        centerRef.current = center;
    }, [center]);

    // Gestion du drag
    const dragRef = useRef({dragging: false, lastX: 0, lastY: 0, accX: 0, accY: 0});

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
        return [...rapport.systemesJoueur.map(s => ({
            ...s, owners: s.proprietaires?.length ? s.proprietaires : [currentPlayerId],
        })), ...rapport.systemesDetectes.map(s => ({
            ...s, owners: s.proprietaires,
        })),];
    }, [rapport, currentPlayerId]);

    const fleets = useMemo(() => {
        if (!rapport) return [];
        return [...rapport.flottesJoueur.map(f => ({
            ...f, owner: currentPlayerId,
        })), ...rapport.flottesDetectees.map(f => ({
            ...f, owner: f.proprio,
        })),];
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
            if ((xCoord - 1) % 20 === 0) ctx.strokeStyle = '#123b66'; else if ((xCoord - 1) % 5 === 0) ctx.strokeStyle = '#661212'; else ctx.strokeStyle = '#444';
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
            if ((yCoord - 1) % 20 === 0) ctx.strokeStyle = '#123b66'; else if ((yCoord - 1) % 5 === 0) ctx.strokeStyle = '#661212'; else ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, rows * cellSize);
            ctx.stroke();

            ctx.fillStyle = '#ccc';
            ctx.font = '12px sans-serif';
            ctx.fillText(String(yCoord), xPos + 4, 12);
        }

        const shipImg = shipImgRef.current;

        // ZONES DE DÉTECTION (scan) – systèmes et flottes du joueur
        // On calcule d’abord l’ensemble des cases détectées pour éviter tout empilement de couleurs.
        const scanners: { pos: XY; scan: number }[] = [];
        systems.forEach(s => {
            const sc = Number((s as any).scan || 0);
            if (sc > 0) scanners.push({ pos: s.pos, scan: sc });
        });
        fleets.forEach(f => {
            const sc = Number((f as any).scan || 0);
            if (sc > 0) scanners.push({ pos: f.pos, scan: sc });
        });

        // Déduplication des cases détectées (distance de Tchebyshev)
        const detected = new Set<string>();
        scanners.forEach(src => {
            const r = Math.max(0, Math.floor(src.scan));
            for (let dxCell = -r; dxCell <= r; dxCell++) {
                for (let dyCell = -r; dyCell <= r; dyCell++) {
                    if (Math.max(Math.abs(dxCell), Math.abs(dyCell)) > r) continue;

                    // Mapping tore -> indices dans la fenêtre
                    const tx = wrapX(src.pos.x + dyCell); // déplacement vertical
                    const ty = wrapY(src.pos.y + dxCell); // déplacement horizontal

                    const cxIdx = ((ty - leftY + BOUNDS.maxY) % BOUNDS.maxY);
                    const cyIdx = ((tx - topX + BOUNDS.maxX) % BOUNDS.maxX);
                    const px = cxIdx * cellSize;
                    const py = cyIdx * cellSize;

                    if (px < 0 || py < 0 || px >= cols * cellSize || py >= rows * cellSize) continue;

                    detected.add(`${cxIdx},${cyIdx}`);
                }
            }
        });

        // Dessin unique des cases détectées, en bleu transparent uniforme
        const cScan = ctx as CanvasRenderingContext2D;
        cScan.save();
        cScan.globalAlpha = 1.0;
        cScan.fillStyle = 'rgba(0, 128, 255, 0.22)'; // bleu transparent
        detected.forEach(key => {
            const [ixStr, iyStr] = key.split(',');
            const ix = Number(ixStr);
            const iy = Number(iyStr);
            const px = ix * cellSize;
            const py = iy * cellSize;
            cScan.fillRect(px, py, cellSize, cellSize);
        });
        cScan.restore();

        // Fonction utilitaire: déterminer si un élément correspond à la sélection
        const isSystemSelected = (owners?: number[]) => {
            if (!selectedOwners || selectedOwners.length === 0) return true;
            if (!owners || owners.length === 0) return false;
            return owners.some(o => selectedOwners.includes(o));
        };
        const isFleetSelected = (owner?: number) => {
            if (!selectedOwners || selectedOwners.length === 0) return true;
            if (owner == null) return false;
            return selectedOwners.includes(owner);
        };

        // systèmes
        systems.forEach(s => {
            const dx = ((s.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
            const dy = ((s.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
            const px = dx * cellSize;
            const py = dy * cellSize;
            if (px < 0 || py < 0 || px >= cols * cellSize || py >= rows * cellSize) return;

            // Couleur(s) en fonction de la possession
            const owners = (s as any).owners as number[] | undefined;
            const col = colorForOwnership(currentPlayerId, owners, rapport?.joueur.alliances, rapport?.joueur.pna);

            // Taille du disque en fonction du typeEtoile:
            // type 1 => 50% de la case, type 9/10 => 100% de la case, interpolation linéaire entre 1..9
            const t = Math.max(1, Math.min(10, Number(s.typeEtoile) || 1));
            const factor = t >= 9 ? 1 : (0.5 + ((t - 1) * (0.5 / 8))); // t=1 -> 0.5, t=9 -> 1.0
            const diameter = cellSize * factor;
            const radius = diameter / 2;

            const cx = px + cellSize / 2;
            const cy = py + cellSize / 2;

            const c2d = ctx as CanvasRenderingContext2D;
            c2d.save();
            if (!isSystemSelected(owners)) {
                // éléments non sélectionnés en niveaux de gris
                c2d.filter = 'opacity(0.15)';
            }
            c2d.beginPath();
            c2d.arc(cx, cy, radius, 0, Math.PI * 2);
            // Si plusieurs propriétaires, afficher des parts angulaires (camembert)
            const multiOwners = (owners && owners.length >= 2) ? owners : undefined;
            if (multiOwners) {
                // Déterminer les poids par propriétaire à partir des planètes du système (si dispo)
                let weights: number[] = [];
                const sysAny = s as any;
                const planets: { proprietaire?: number }[] | undefined = sysAny.planetes;
                if (Array.isArray(planets) && planets.length > 0) {
                    const counts = new Map<number, number>();
                    planets.forEach(p => {
                        if (p && typeof p.proprietaire === 'number') {
                            counts.set(p.proprietaire, (counts.get(p.proprietaire) || 0) + 1);
                        }
                    });
                    weights = multiOwners.map(o => counts.get(o) || 0);
                }
                // Si aucune info exploitable, répartir équitablement
                if (!weights.length || weights.every(w => w === 0)) {
                    weights = multiOwners.map(() => 1);
                }
                const total = weights.reduce((a, b) => a + b, 0);
                // Préparer les couleurs par propriétaire
                const colors = multiOwners.map(o => colorForOwnership(currentPlayerId, [o], rapport?.joueur.alliances, rapport?.joueur.pna));

                // Dessiner les parts: une par owner, angle proportionnel au poids
                let angle = -Math.PI / 2; // démarrage en haut, pour stabilité visuelle
                for (let i = 0; i < multiOwners.length; i++) {
                    const frac = total > 0 ? (weights[i] / total) : (1 / multiOwners.length);
                    const delta = Math.PI * 2 * frac;
                    const start = angle;
                    const end = angle + delta;
                    c2d.beginPath();
                    c2d.moveTo(cx, cy);
                    c2d.arc(cx, cy, radius, start, end);
                    c2d.closePath();
                    c2d.fillStyle = colors[i];
                    c2d.fill();
                    angle = end;
                }
            } else {
                c2d.fillStyle = col;
                c2d.fill();
            }
            c2d.restore();

            // HALO de sélection pour les systèmes (couleur via colorForOwnership)
            if (isSystemSelected(owners)) {
                const haloColor = lightenHexColor(col, 100);
                const lineW = 2;
                const blur = Math.max(10, Math.floor(lineW * 1.5));
                const rHalo = radius + lineW / 2; // halo juste à l'extérieur du disque
                const cHalo = ctx as CanvasRenderingContext2D;
                cHalo.save();
                cHalo.strokeStyle = haloColor;
                cHalo.lineWidth = lineW;
                cHalo.shadowColor = haloColor;
                cHalo.shadowBlur = blur;
                cHalo.beginPath();
                cHalo.arc(cx, cy, rHalo, 0, Math.PI * 2);
                cHalo.stroke();
                cHalo.restore();
            }
            // plus de bordure
        });

        // flottes
        fleets.forEach(f => {
            const dx = ((f.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
            const dy = ((f.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
            const px = dx * cellSize;
            const py = dy * cellSize;
            if (px < 0 || py < 0 || px >= cols * cellSize || py >= rows * cellSize) return;

            // Taille et placement de l'icône de vaisseau
            // Exigence: l'image du vaisseau doit faire un tiers de la largeur d'une case et être centrée
            const size = Math.floor(cellSize / 3);
            const drawX = px + (cellSize - size) / 2;
            const drawY = py + (cellSize - size) / 2;
            const c2d = ctx as CanvasRenderingContext2D;
            c2d.save();
            if (!isFleetSelected((f as any).owner)) {
                c2d.filter = 'grayscale(1)';
            }
            if (shipImg && shipImg.complete && shipImg.naturalWidth > 0) {
                c2d.drawImage(shipImg, drawX, drawY, size, size);
            }
            const col = colorForOwnership(currentPlayerId, [(f as any).owner], rapport?.joueur.alliances, rapport?.joueur.pna);
            c2d.strokeStyle = col;
            c2d.lineWidth = 1;
            c2d.strokeRect(drawX, drawY, size, size);

            // Flèche de direction (flottes du joueur uniquement, si "direction" est défini)
            const t = (f as any).direction;
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

                    drawArrow(c2d as CanvasRenderingContext2D, sx, sy, tx, ty);
                }
            }
            c2d.restore();

            // HALO de sélection pour les flottes (autour de l'icône centrée)
            if (isFleetSelected((f as any).owner)) {
                const col = colorForOwnership(currentPlayerId, [(f as any).owner], rapport?.joueur.alliances, rapport?.joueur.pna);
                const haloColor = col
                const lineW = 2
                const blur = Math.max(10, Math.floor(lineW * 1.5));
                const pad = 0;
                const x = drawX - pad;
                const y = drawY - pad;
                const w = size + pad * 2;
                const h = size + pad * 2;
                const cHalo = ctx as CanvasRenderingContext2D;
                cHalo.save();
                cHalo.strokeStyle = haloColor;
                cHalo.lineWidth = lineW;
                cHalo.shadowColor = haloColor;
                cHalo.shadowBlur = blur;
                cHalo.strokeRect(x, y, w, h);
                cHalo.restore();
            }
        });

    }, [rapport, systems, fleets, cellSize, center, currentPlayerId, assetsVersion, setViewportDims, canvasSizeVersion, selectedOwners]);

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
                    x: wrapX(centerRef.current.x + stepX), y: wrapY(centerRef.current.y + stepY),
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

    return (<div className="canvas-host">
            <canvas
                ref={canvasRef}
                style={{width: '100%', height: '100vh'}}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
            />
        </div>);
}
