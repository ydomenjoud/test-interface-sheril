import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS, getTorusDistance, torusDelta, wrapX, wrapY} from '../../utils/position';
import {getSectorNumber, isSectorLabelCell, sectorBackgroundColor, sectorLabelColor} from '../../utils/sectors';
import {countCombatsByKind} from '../../parsers/parseCombatMessages';
import {drawCombatMarkers} from '../../utils/combatMarkers';
import {Alliance, XY} from '../../types';
import {lightenHexColor, getColorForPlayer} from "../../utils/global";

const OWNER_BADGE_COLORS: Record<number, string> = {
    1: '#0066CC',
    2: '#FFCC00',
    3: '#CC0033',
    4: '#009933',
    5: '#777777',
};
const RACE_BADGE_COLORS: Record<number, string> = {
    0: '#CC00FF',
    1: '#0066CC',
    2: '#FFCC00',
    3: '#CC0033',
    4: '#009933',
    5: '#777777',
};

type Props = {
    onSelect: (xy: XY, ctrl: boolean) => void;
    selected?: XY;
    showFleetsFor?: XY; // Position pour laquelle afficher les flèches de portée
    showSystems: boolean;
    selectedOwners?: number[]; // liste des commandants sélectionnés pour filtrage visuel
    showCombatBadges: boolean;
    showOwnerBadges: boolean;
    showFleetBadges: boolean;
    showSystemRadar: boolean;
    showFleetRadar: boolean;
    showSectors: boolean;
    showInfluence: boolean;
    colorMode?: 'status' | 'player';
    showStabilityZones: boolean;
    stabilitySystemPos?: string;
};

export function colorForOwnership(currentPlayerId?: number, owners?: number[], alliances?: Alliance[], pna?: number[], colorMode: 'status' | 'player' = 'status') {
    if (owners && owners?.length === 1 && owners[0] === 0) return 'grey';
    if (!owners || owners.length === 0) return '#999';

    // si y'en a plusieurs en enlevant le neutre
    if (owners.length > 1 ){
        const withoutNeutral = owners.filter(o => o !== 0);
        // si tous pareil, on renvoit la couleur,
        const colors: Set<string> = new Set(withoutNeutral
            .map(o => colorForOwnership(currentPlayerId, [o], alliances, pna, colorMode))
            .filter((s): s is string => !!s)
        );
        if(colors.size === 1) {
            return colors.values().next().value;
        } else {
            return '#ff9540';
        }
        // sinon on renvoi jaune
    }

    const owner = owners[0];
    if (currentPlayerId && owners.includes(currentPlayerId)) return '#09ca31';

    if (colorMode === 'player') {
        return getColorForPlayer(owner);
    }

    if (alliances && alliances.some(a => a.commandants.includes(owner))) return '#224eff';
    if (pna && pna.includes(owner)) return 'yellow';
    return '#f80c0c';
}

export default function CanvasMap({onSelect, selected, showFleetsFor, showSystems, selectedOwners, showCombatBadges, showOwnerBadges, showFleetBadges, showSystemRadar, showFleetRadar, showSectors, showInfluence, colorMode = 'status', showStabilityZones, stabilitySystemPos}: Props) {
    const {rapport, global, cellSize, setCellSize, center, setCenter, setViewportDims, notes, selectedTags, publicCombats} = useReport();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Ref sur le center pour des mises à jour synchrones dans le drag
    const centerRef = useRef<XY | undefined>(center);
    useEffect(() => {
        centerRef.current = center;
    }, [center]);

    // Gestion du drag
    const dragRef = useRef({dragging: false, lastX: 0, lastY: 0, accX: 0, accY: 0, moved: false});

    // Redraw quand le canvas change de taille (évite l'étirement non proportionnel)
    const [canvasSizeVersion, setCanvasSizeVersion] = useState(0);

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

    const ownerRaceColor = useCallback((owner?: number): string | undefined => {
        if (owner == null) return undefined;
        if (owner === 0) return 'grey';
        if (!global) return undefined;

        const commandant = global.commandants?.find(c => c.numero === owner);
        if (commandant) {
            const raceId = commandant.raceId;
            const raceColor = global.races?.find(r => r.id === raceId)?.couleur;
            // some data.xml files may omit color or use generic 'white' — prefer our mapping in that case
            if (raceColor && raceColor.trim() && raceColor.toLowerCase() !== 'white') {
                return raceColor;
            }
            // For commandants, use race mapping. Race 0 is a valid race color and is not the neutral owner.
            if (raceId != null) {
                return RACE_BADGE_COLORS[raceId] || OWNER_BADGE_COLORS[owner];
            }
        }

        return OWNER_BADGE_COLORS[owner];
    }, [global]);

    const systems = useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();

        // 1. Systèmes du joueur (priorité max)
        if (rapport) {
            rapport.systemesJoueur.forEach(s => {
                const key = `${s.pos.x}_${s.pos.y}`;
                list.push({
                    ...s,
                    owners: s.proprietaires?.length ? s.proprietaires : [currentPlayerId],
                    isGlobalOnly: false
                });
                seen.add(key);
            });

            // 2. Systèmes détectés
            rapport.systemesDetectes.forEach(s => {
                const key = `${s.pos.x}_${s.pos.y}`;
                if (!seen.has(key)) {
                    list.push({
                        ...s,
                        owners: s.proprietaires,
                        isGlobalOnly: false
                    });
                    seen.add(key);
                }
            });
        }

        // 3. Systèmes globaux (data.xml) - si pas déjà présent
        if (global?.systemes) {
            global.systemes.forEach(s => {
                const key = `${s.pos.x}_${s.pos.y}`;
                if (!seen.has(key)) {
                    list.push({
                        ...s,
                        type: 'detecte', // On le traite comme un système détecté vide
                        owners: [],
                        isGlobalOnly: true
                    });
                    seen.add(key);
                }
            });
        }

        return list;
    }, [rapport, global, currentPlayerId]);

    const fleets = useMemo(() => {
        if (!rapport) return [];
        return [...rapport.flottesJoueur.map(f => ({
            ...f, owner: currentPlayerId,
        })), ...rapport.flottesDetectees.map(f => ({
            ...f, owner: f.proprio,
        })),];
    }, [rapport, currentPlayerId]);

    const combats = useMemo(() => {
        const fromRapport = rapport?.combats ?? [];
        const fromPublic = publicCombats ?? [];
        return [...fromRapport, ...fromPublic];
    }, [rapport, publicCombats]);


    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const currentCenter = center || {x: 20, y: 20};
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

        const topX = wrapX(currentCenter.x - halfRows);
        const leftY = wrapY(currentCenter.y - halfCols);

        // Préparation des influenceurs pour la couche d'influence
        const influencers: { owner: number, pos: XY }[] = [];
        if (showInfluence) {
            // On récupère tous les commandants qui ont au moins un système ou une flotte
            const influencerMap = new Map<number, XY[]>();
            systems.forEach(s => {
                if (s.owners) {
                    (s.owners as number[]).forEach(o => {
                        if (o === 0) return;
                        if (!influencerMap.has(o)) influencerMap.set(o, []);
                        influencerMap.get(o)!.push(s.pos);
                    });
                }
            });
            fleets.forEach(f => {
                const o = (f as any).owner;
                if (o && o !== 0) {
                    if (!influencerMap.has(o)) influencerMap.set(o, []);
                    influencerMap.get(o)!.push(f.pos);
                }
            });

            // Pour chaque commandant, on garde toutes ses positions (systèmes et flottes)
            // On utilisera la distance minimale à n'importe lequel de ses points.
            influencerMap.forEach((positions, owner) => {
                positions.forEach(pos => {
                    influencers.push({ owner, pos });
                });
            });
        }

        // Calcul de la grille d'influence pour pouvoir tracer les bordures
        const influenceGrid: number[][] = [];
        if (showInfluence && influencers.length > 0) {
            for (let r = 0; r <= rows; r++) {
                influenceGrid[r] = [];
                const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
                for (let c = 0; c <= cols; c++) {
                    const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);
                    
                    let minDist = Infinity;
                    let closestOwner = -1;
                    let countAtMin = 0;

                    const ownerDistances = new Map<number, number>();
                    influencers.forEach(inf => {
                        const d = getTorusDistance({x: xCoord, y: yCoord}, inf.pos);
                        const currentBest = ownerDistances.get(inf.owner) ?? Infinity;
                        if (d < currentBest) {
                            ownerDistances.set(inf.owner, d);
                        }
                    });

                    ownerDistances.forEach((d, owner) => {
                        if (d < minDist) {
                            minDist = d;
                            closestOwner = owner;
                            countAtMin = 1;
                        } else if (d === minDist) {
                            countAtMin++;
                        }
                    });

                    influenceGrid[r][c] = (closestOwner !== -1 && countAtMin === 1) ? closestOwner : -1;
                }
            }
        }

        // fond des secteurs 10×10 (16 secteurs sur la carte 40×40)
        for (let r = 0; r < rows; r++) {
            const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
            for (let c = 0; c < cols; c++) {
                const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);

                const sectorBg = showSectors ? sectorBackgroundColor(xCoord, yCoord) : null;
                if (sectorBg) {
                    ctx.fillStyle = sectorBg;
                    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }

                // Couche Influence - dessinée après le damier pour plus de clarté
                if (showInfluence && influenceGrid[r] && influenceGrid[r][c] !== -1) {
                    const closestOwner = influenceGrid[r][c];
                    const baseColor = getColorForPlayer(closestOwner);
                    // On convertit HSL en HSLA un peu plus marqué
                    ctx.fillStyle = baseColor.replace(')', ', 0.18)').replace('hsl', 'hsla');
                    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }

                // Bordures d'influence
                if (showInfluence && influenceGrid[r]) {
                    const currentOwner = influenceGrid[r][c];
                    ctx.lineWidth = 1;
                    
                    // Bordure droite
                    if (c < cols) {
                        const rightOwner = influenceGrid[r][c+1];
                        if (currentOwner !== rightOwner) {
                            ctx.strokeStyle = currentOwner !== -1 ? getColorForPlayer(currentOwner).replace('hsl', 'hsla').replace(')', ', 0.6)') : getColorForPlayer(rightOwner).replace('hsl', 'hsla').replace(')', ', 0.6)');
                            ctx.beginPath();
                            ctx.moveTo((c + 1) * cellSize, r * cellSize);
                            ctx.lineTo((c + 1) * cellSize, (r + 1) * cellSize);
                            ctx.stroke();
                        }
                    }
                    
                    // Bordure basse
                    if (r < rows) {
                        const bottomOwner = influenceGrid[r+1][c];
                        if (currentOwner !== bottomOwner) {
                            ctx.strokeStyle = currentOwner !== -1 ? getColorForPlayer(currentOwner).replace('hsl', 'hsla').replace(')', ', 0.6)') : getColorForPlayer(bottomOwner).replace('hsl', 'hsla').replace(')', ', 0.6)');
                            ctx.beginPath();
                            ctx.moveTo(c * cellSize, (r + 1) * cellSize);
                            ctx.lineTo((c + 1) * cellSize, (r + 1) * cellSize);
                            ctx.stroke();
                        }
                    }
                }
                if (showSectors && isSectorLabelCell(xCoord, yCoord)) {
                    const labelSize = Math.max(12, Math.floor(cellSize * 1.4));
                    ctx.fillStyle = sectorLabelColor();
                    ctx.font = `600 ${labelSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        String(getSectorNumber(xCoord, yCoord)),
                        c * cellSize + cellSize / 2,
                        r * cellSize + cellSize / 2,
                    );
                }
            }
        }

        // grille + en-têtes
        for (let r = 0; r <= rows; r++) {
            const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
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
            const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);
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

        // ZONES DE DÉTECTION (scan) – systèmes et flottes du joueur
        // On calcule d’abord l’ensemble des cases détectées pour éviter tout empilement de couleurs.
        const scanners: { pos: XY; scan: number }[] = [];
        if (showSystemRadar) {
            systems.forEach(s => {
                const sc = Number((s as any).scan || 0);
                if (sc > 0) scanners.push({ pos: s.pos, scan: sc });
            });
        }
        if (showFleetRadar) {
            fleets.forEach(f => {
                const sc = Number((f as any).scan || 0);
                if (sc > 0) scanners.push({ pos: f.pos, scan: sc });
            });
        }

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

                    const cxIdxBase = ((ty - leftY + BOUNDS.maxY) % BOUNDS.maxY);
                    const cyIdxBase = ((tx - topX + BOUNDS.maxX) % BOUNDS.maxX);

                    let cxIdx = cxIdxBase;
                    while (cxIdx < cols) {
                        let cyIdx = cyIdxBase;
                        while (cyIdx < rows) {
                            detected.add(`${cxIdx},${cyIdx}`);
                            cyIdx += BOUNDS.maxX;
                        }
                        cxIdx += BOUNDS.maxY;
                    }
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

        // INDICATEURS DE NOTES
        Object.keys(notes).forEach(noteKey => {
            const noteList = notes[noteKey];
            if (!noteList || noteList.length === 0) return;

            // Filtrage par tags
            if (selectedTags.length > 0) {
                const hasMatchingTag = noteList.some(n => n.tag && selectedTags.includes(n.tag));
                if (!hasMatchingTag) return;
            }

            const [nx, ny] = noteKey.split('_').map(Number);
            let dx = ((ny - leftY + BOUNDS.maxY) % BOUNDS.maxY);
            let dy = ((nx - topX + BOUNDS.maxX) % BOUNDS.maxX);

            while (dx < cols) {
                let currentDy = dy;
                while (currentDy < rows) {
                    const px = dx * cellSize;
                    const py = currentDy * cellSize;
                    const noteList = notes[noteKey];
                    if (noteList && noteList.length > 0) {
                        const lastColor = noteList[noteList.length - 1].color;
                        cScan.fillStyle = lastColor;
                        // Petit triangle en haut à droite pour indiquer une note
                        cScan.beginPath();
                        cScan.moveTo(px + cellSize, py);
                        cScan.lineTo(px + cellSize - 8, py);
                        cScan.lineTo(px + cellSize, py + 8);
                        cScan.fill();
                    }
                    currentDy += BOUNDS.maxX;
                }
                dx += BOUNDS.maxY;
            }
        });

        cScan.restore();

        // STABILITY ZONES
        if (showStabilityZones && stabilitySystemPos && global?.modificateursStabilite) {
            const [sx, sy] = stabilitySystemPos.split('_').map(Number);
            const stabilityMods = [...global.modificateursStabilite].sort((a, b) => a.distance - b.distance);

            stabilityMods.forEach((mod) => {
                if (mod.distance < 1) return; // Skip distance 0 as it pollutes display
                if (mod.distance >= 1000000) return; // Skip the "rest of galaxy" entry if it exists with huge value

                // Chebyshev distance r means a square of side (2r + 1)
                const r = mod.distance;

                // For each level, we draw the outer boundary
                // We wrap the rendering as we do for notes and systems
                let dx = ((sy - r - leftY + BOUNDS.maxY * 2) % BOUNDS.maxY);
                let dy = ((sx - r - topX + BOUNDS.maxX * 2) % BOUNDS.maxX);

                ctx.save();
                ctx.lineWidth = 2;
                if (mod.modif > 0) {
                    ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 + (mod.modif / 10)})`;
                } else if (mod.modif < 0) {
                    ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + (Math.abs(mod.modif) / 10)})`;
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                }

                while (dx < cols) {
                    let currentDy = dy;
                    while (currentDy < rows) {
                        const px = dx * cellSize;
                        const py = currentDy * cellSize;
                        const size = (2 * r + 1) * cellSize;

                        ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);

                        // Draw label for the modifier
                        ctx.fillStyle = ctx.strokeStyle;
                        ctx.font = 'bold 10px sans-serif';
                        ctx.fillText(`${mod.modif >= 0 ? '+' : ''}${mod.modif}`, px + 9, py + 12);

                        currentDy += BOUNDS.maxX;
                    }
                    dx += BOUNDS.maxY;
                }
                ctx.restore();
            });
        }

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

        if (showSystems) {
            systems.forEach(s => {
                // Filtrage par tags si sélectionné
                if (selectedTags.length > 0) {
                    const posKey = `${s.pos.x}_${s.pos.y}`;
                    const cellNotes = notes[posKey] || [];
                    const hasMatchingTag = cellNotes.some(n => n.tag && selectedTags.includes(n.tag));
                    if (!hasMatchingTag) return;
                }

                let dx = ((s.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
                let dy = ((s.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);

                // Gérer le wrapping si le viewport est plus grand que la galaxie
                while (dx < cols) {
                    let currentDy = dy;
                    while (currentDy < rows) {
                        const px = dx * cellSize;
                        const py = currentDy * cellSize;

                        renderSystem(s, px, py);
                        currentDy += BOUNDS.maxX;
                    }
                    dx += BOUNDS.maxY;
                }
            });
        }

        function renderSystem(s: any, px: number, py: number) {
            // Couleur(s) en fonction de la possession
            const owners = s.owners as number[] | undefined;
            const isGlobalOnly = s.isGlobalOnly;
            let col = colorForOwnership(currentPlayerId, owners, rapport?.joueur.alliances, rapport?.joueur.pna, colorMode);
            if (isGlobalOnly) col = '#333'; // Plus sombre pour les systèmes non détectés

            // Taille du disque en fonction du nombre de planètes:
            // 10 planètes => 50% de la case, 20 planètes => 100% de la case
            const nbPla = Number(s.nbPla) || 0;
            const t = Math.max(10, Math.min(20, nbPla));
            const baseFactor = 0.45 + ((t - 10) * (0.5 / 10)); // 10 -> 0.5, 20 -> 1.0
            const factor = isGlobalOnly ? baseFactor * 0.5 : baseFactor; // Taille plus petite par défaut si global uniquement
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
                const colors = multiOwners.map(o => colorForOwnership(currentPlayerId, [o], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode));

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
                    c2d.fillStyle = colors[i] || '#000000';
                    c2d.fill();
                    angle = end;
                }
            } else {
                c2d.fillStyle = col || '#000000';
                c2d.fill();
            }
            c2d.restore();

            // HALO de sélection pour les systèmes (couleur via colorForOwnership)
            if (isSystemSelected(owners)) {
                const haloColor = lightenHexColor(col || '#000000', 100);
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

            // Badges propriétaires en bas à droite de la case
            if (showOwnerBadges && owners && owners.length > 0) {
                const badgePadding = Math.max(2, Math.floor(cellSize * 0.08));
                const badgeSpacing = Math.max(1, Math.floor(cellSize * 0.03));
                const badgeBaseSize = Math.max(12, Math.floor(cellSize * 0.38));
                const maxVisibleOwners = 4;
                const visibleOwners = owners.slice(0, maxVisibleOwners);
                const extraOwners = owners.length - visibleOwners.length;
                const badgeSize = Math.min(
                    badgeBaseSize,
                    Math.max(8, Math.floor((cellSize - badgePadding * 2 - badgeSpacing * (visibleOwners.length - 1)) / visibleOwners.length))
                );
                const badgeY = py + cellSize - badgeSize - badgePadding;

                visibleOwners.forEach((owner, index) => {
                    const badgeX = px + cellSize - badgePadding - (badgeSize + badgeSpacing) * (index + 1);
                    const badgeColor = ownerRaceColor(owner) || '#000000';
                    c2d.save();
                    c2d.fillStyle = badgeColor;
                    c2d.strokeStyle = '#000000';
                    c2d.lineWidth = 1;
                    c2d.fillRect(badgeX, badgeY, badgeSize, badgeSize);
                    c2d.strokeRect(badgeX, badgeY, badgeSize, badgeSize);
                    c2d.fillStyle = '#ffffff';
                    c2d.font = `bold ${Math.max(8, Math.floor(badgeSize * 0.65))}px sans-serif`;
                    c2d.textAlign = 'center';
                    c2d.textBaseline = 'middle';
                    c2d.fillText(String(owner), badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 0.5);
                    c2d.restore();
                });

                if (extraOwners > 0) {
                    const badgeX = px + cellSize - badgePadding - (badgeSize + badgeSpacing) * (visibleOwners.length + 1);
                    c2d.save();
                    c2d.fillStyle = '#222';
                    c2d.strokeStyle = '#000000';
                    c2d.lineWidth = 1;
                    c2d.fillRect(badgeX, badgeY, badgeSize, badgeSize);
                    c2d.strokeRect(badgeX, badgeY, badgeSize, badgeSize);
                    c2d.fillStyle = '#ffffff';
                    c2d.font = `bold ${Math.max(8, Math.floor(badgeSize * 0.55))}px sans-serif`;
                    c2d.textAlign = 'center';
                    c2d.textBaseline = 'middle';
                    c2d.fillText(`+${extraOwners}`, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 0.5);
                    c2d.restore();
                }
            }
        }

        // flottes
        if (showFleetBadges) {
            fleets.forEach(f => {
                let dx = ((f.pos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
                let dy = ((f.pos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);

                while (dx < cols) {
                    let currentDy = dy;
                    while (currentDy < rows) {
                        const px = dx * cellSize;
                        const py = currentDy * cellSize;

                        renderFleet(f, px, py);
                        currentDy += BOUNDS.maxX;
                    }
                    dx += BOUNDS.maxY;
                }
            });
        }

        function renderFleet(f: any, px: number, py: number) {
            const diameter = Math.max(10, Math.floor(cellSize / 3));
            const cx = px + cellSize / 2;
            const cy = py + cellSize / 2;
            const c2d = ctx as CanvasRenderingContext2D;
            c2d.save();
            if (!isFleetSelected((f as any).owner)) {
                c2d.filter = 'grayscale(1)';
            }

            const ownerColor = colorForOwnership(currentPlayerId, [(f as any).owner], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode) || '#000000';
            const badgeColor = '#ffffff';
            const textColor = '#000000';
            const strokeColor = ownerColor;

            c2d.fillStyle = badgeColor;
            c2d.beginPath();
            c2d.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
            c2d.fill();

            c2d.strokeStyle = strokeColor;
            c2d.lineWidth = Math.max(1, Math.floor(cellSize * 0.06));
            c2d.stroke();

            const ships = typeof (f as any).nbVso === 'number' ? (f as any).nbVso : undefined;
            const label = ships && ships > 1 ? String(ships) : 'F';
            c2d.fillStyle = textColor;
            c2d.font = `bold ${Math.max(8, Math.floor(diameter * 0.55))}px sans-serif`;
            c2d.textAlign = 'center';
            c2d.textBaseline = 'middle';
            c2d.fillText(label, cx, cy + 0.5);

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

            // HALO de sélection pour les flottes (autour du badge circulaire)
            if (isFleetSelected((f as any).owner)) {
                const col = colorForOwnership(currentPlayerId, [(f as any).owner], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode);
                const haloColor = col || '#000000';
                const lineW = 2;
                const blur = Math.max(10, Math.floor(lineW * 1.5));
                const radius = diameter / 2 + lineW + 1;
                const cHalo = ctx as CanvasRenderingContext2D;
                cHalo.save();
                cHalo.strokeStyle = haloColor;
                cHalo.lineWidth = lineW;
                cHalo.shadowColor = haloColor;
                cHalo.shadowBlur = blur;
                cHalo.beginPath();
                cHalo.arc(cx, cy, radius, 0, Math.PI * 2);
                cHalo.stroke();
                cHalo.restore();
            }
        }

        // Marqueurs de combat au-dessus des systèmes (S = spatial, P = planétaire)
        if (showCombatBadges && combats.length > 0) {
            try { console.debug(`[CanvasMap] total combats: ${combats.length}`); } catch (e) { }
            const cCombat = ctx as CanvasRenderingContext2D;
            cCombat.save();
            let combatLogCount = 0;
            for (let r = 0; r < rows; r++) {
                const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
                for (let c = 0; c < cols; c++) {
                    const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);
                    const counts = countCombatsByKind(combats, {x: xCoord, y: yCoord});
                    if (counts.spatial <= 0 && counts.planetary <= 0) continue;
                    if (combatLogCount < 50) {
                        try { console.debug(`[CanvasMap] combat at ${xCoord}-${yCoord}`, counts); } catch (e) { }
                        combatLogCount += 1;
                    }
                    drawCombatMarkers(cCombat, c * cellSize, r * cellSize, cellSize, counts.spatial, counts.planetary);
                }
            }
            try { if (combatLogCount > 0) console.info(`[CanvasMap] logged ${combatLogCount} combat positions`); } catch (e) { }

            // FLÈCHES DE DÉPLACEMENT (mes flottes vers showFleetsFor)
            if (showFleetsFor) {
                const playerFleets = rapport?.flottesJoueur.filter(f => {
                    return !(f.pos.x === showFleetsFor.x && f.pos.y === showFleetsFor.y);
                }) || [];

                if (playerFleets.length > 0) {
                    ctx.save();
                    ctx.lineWidth = 1;

                    playerFleets.forEach(f => {
                        const dist = getTorusDistance(f.pos, showFleetsFor);
                        const reachable = dist <= f.vitesse;

                        // Couleur : vert/jaune clair si atteignable, orange clair sinon
                        ctx.strokeStyle = reachable ? '#ccff00' : '#ffa500';
                        ctx.fillStyle = reachable ? '#ccff0000' : '#ffa500';
                        ctx.setLineDash([5, 5]);

                        // On calcule le delta le plus court sur le tore
                        let dx = showFleetsFor.x - f.pos.x;
                        if (Math.abs(dx) > BOUNDS.maxX / 2) {
                            dx = dx > 0 ? dx - BOUNDS.maxX : dx + BOUNDS.maxX;
                        }
                        let dy = showFleetsFor.y - f.pos.y;
                        if (Math.abs(dy) > BOUNDS.maxY / 2) {
                            dy = dy > 0 ? dy - BOUNDS.maxY : dy + BOUNDS.maxY;
                        }

                        const getScreenPos = (pos: XY) => {
                            // Distance signée par rapport au centre, tenant compte du tore
                            let offX = pos.x - currentCenter.x;
                            if (offX > BOUNDS.maxX / 2) offX -= BOUNDS.maxX;
                            if (offX < -BOUNDS.maxX / 2) offX += BOUNDS.maxX;

                            let offY = pos.y - currentCenter.y;
                            if (offY > BOUNDS.maxY / 2) offY -= BOUNDS.maxY;
                            if (offY < -BOUNDS.maxY / 2) offY += BOUNDS.maxY;

                            return {
                                x: (halfCols + offY) * cellSize + cellSize / 2,
                                y: (halfRows + offX) * cellSize + cellSize / 2
                            };
                        };

                        const start = getScreenPos(f.pos);
                        const end = getScreenPos(showFleetsFor);

                        ctx.beginPath();
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                        ctx.stroke();

                        // Petite flèche au bout
                        const angle = Math.atan2(end.y - start.y, end.x - start.x);
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.moveTo(end.x, end.y);
                        ctx.lineTo(end.x - 10 * Math.cos(angle - Math.PI / 6), end.y - 10 * Math.sin(angle - Math.PI / 6));
                        ctx.lineTo(end.x - 10 * Math.cos(angle + Math.PI / 6), end.y - 10 * Math.sin(angle + Math.PI / 6));
                        ctx.closePath();
                        ctx.fill();
                    });
                    ctx.restore();
                }
            }

            cCombat.restore();
        }
    }, [rapport, global, systems, fleets, combats, cellSize, center, currentPlayerId, setViewportDims, canvasSizeVersion, selectedOwners, notes, selectedTags, ownerRaceColor, showCombatBadges, showOwnerBadges, showFleetBadges, showSystemRadar, showFleetRadar, showSectors, showInfluence, selected, showFleetsFor, showStabilityZones, stabilitySystemPos, showSystems, colorMode]);

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
        if (dragRef.current.moved) {
            dragRef.current.moved = false;
            return;
        }
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

        onSelect({x, y}, evt.ctrlKey);
    };

    const handleMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
        if (evt.button !== 0) return; // seulement clic gauche
        dragRef.current.dragging = true;
        dragRef.current.lastX = evt.clientX;
        dragRef.current.lastY = evt.clientY;
        dragRef.current.accX = 0;
        dragRef.current.accY = 0;
        dragRef.current.moved = false;
        evt.preventDefault();

        const onMove = (e: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;
            dragRef.current.accX += dx;
            dragRef.current.accY += dy;

            if (dx !== 0 || dy !== 0) {
                dragRef.current.moved = true;
            }

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

    const handleWheel = useCallback((evt: React.WheelEvent<HTMLCanvasElement>) => {
        const zoomSpeed = 0.1;
        const delta = evt.deltaY > 0 ? -1 : 1;
        const newSize = Math.max(8, Math.min(128, Math.round(cellSize * (1 + delta * zoomSpeed))));
        if (newSize !== cellSize) {
            setCellSize(newSize);
        }
    }, [cellSize, setCellSize]);

    return (<div className="canvas-host">
            <canvas
                ref={canvasRef}
                style={{width: '100%', height: '100vh'}}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
            />
        </div>);
}
