import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {BOUNDS, CENTER, getTorusDistance, torusDelta, wrapX, wrapY} from '../../utils/position';
import {capaciteReparation} from '../../utils/reparation';
import {getSectorNumber, isSectorLabelCell, sectorBackgroundColor, sectorLabelColor} from '../../utils/sectors';
import {countCombatsByKind} from '../../parsers/parseCombatMessages';
import {drawCombatMarkers} from '../../utils/combatMarkers';
import {Alliance, GlobalData, XY, Zone} from '../../types';
import {lightenHexColor, getColorForPlayer} from "../../utils/global";
import {detectionWeight, PresenceData} from '../../utils/presence';
import {isTypingTarget} from '../../utils/keyboard';
import {FleetCellSummary, MapFleet, verboseCompositionLabel} from '../../utils/fleetModel';
import {drawFleetScene, FleetHitRegion, fleetHitRegions, findFleetHit, shouldOpenFleetPicker} from '../../utils/fleetLayout';
import {projectFleetRoute, visibleFleetCopies} from '../../utils/fleetProjection';
import {drawFleetCell} from './fleets/drawFleetLayer';

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

// Couleur de la race d'un commandant (même code couleur que les noms de joueurs)
export function raceColorForOwner(globalData?: GlobalData, owner?: number): string | undefined {
    if (owner == null) return undefined;
    if (owner === 0) return 'grey';
    if (!globalData) return undefined;
    const commandant = globalData.commandants?.find(c => c.numero === owner);
    if (commandant) {
        const raceId = commandant.raceId;
        const raceColor = globalData.races?.find(r => r.id === raceId)?.couleur;
        if (raceColor && raceColor.trim() && raceColor.toLowerCase() !== 'white') {
            return raceColor;
        }
        if (raceId != null) {
            return RACE_BADGE_COLORS[raceId] || OWNER_BADGE_COLORS[owner];
        }
    }
    return OWNER_BADGE_COLORS[owner];
}

// Rend une couleur semi-transparente (opacité 0..1) : gère HSL, hexadécimal et quelques couleurs nommées
function withOpacity(color: string, opacity: number): string {
    if (color.startsWith('hsl')) {
        return color.replace(')', `, ${opacity})`).replace('hsl', 'hsla');
    }
    const named: Record<string, string> = { grey: '#94a3b8', gray: '#94a3b8' };
    const hex = (named[color] || (color.startsWith('#') ? color : '')).replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
}


export type ZoneRect = { x: number; y: number; width: number; height: number };

// Rectangle (coin haut-gauche + taille) couvrant deux cases opposées, en prenant le plus court chemin sur le tore
function zoneRectFrom(a: XY, b: XY): ZoneRect {
    let dX = b.x - a.x;
    if (dX > BOUNDS.maxX / 2) dX -= BOUNDS.maxX;
    if (dX < -BOUNDS.maxX / 2) dX += BOUNDS.maxX;
    let dY = b.y - a.y;
    if (dY > BOUNDS.maxY / 2) dY -= BOUNDS.maxY;
    if (dY < -BOUNDS.maxY / 2) dY += BOUNDS.maxY;
    return {
        x: dX < 0 ? b.x : a.x,
        y: dY < 0 ? b.y : a.y,
        width: Math.abs(dY) + 1,
        height: Math.abs(dX) + 1,
    };
}

type Props = {
    onSelect: (xy: XY, ctrl: boolean) => void;
    onCreateZone?: (rect: ZoneRect) => void; // Alt + clic + glisser du coin de départ au coin de fin
    previewZone?: Omit<Zone, 'id'>; // zone en cours de création, pas encore validée
    selected?: XY;
    showFleetsFor?: XY; // Position pour laquelle afficher les flèches de portée
    showSystems: boolean;
    showGlobalSystems?: boolean; // systèmes connus uniquement par data.xml (jamais détectés)
    selectedOwners?: number[]; // liste des commandants sélectionnés pour filtrage visuel
    showCombatBadges: boolean;
    showOwnerBadges: boolean;
    showFleetBadges: boolean;
    // Mode tactique : les flottes deviennent la couche dominante, les systèmes se font discrets.
    fleetFocus?: boolean;
    fleets: MapFleet[];
    fleetCells: ReadonlyMap<string, FleetCellSummary>;
    showSystemRadar: boolean;
    showFleetRadar: boolean;
    showSectors: boolean;
    showZones?: boolean; // zones manuelles (toutes)
    showInfluence: boolean;
    colorMode?: 'status' | 'race' | 'player';
    showStabilityZones: boolean;
    stabilitySystemPos?: string;
    influenceOpacity?: number;
    // ---- Couche présence (qui est où) ----
    presenceMode?: 'presence' | 'voronoi'; // 'voronoi' = ancienne influence au plus proche
    presenceData?: PresenceData | null; // grille précalculée sur toute la galaxie (mode présence)
    presenceDecay?: number; // fenêtre de fraîcheur (tours) des détections
    presenceFocus?: number | null; // commandant isolé par le focus
    // ---- Ordres de déplacement (drag & drop de flottes) ----
    deplacements?: Record<number, XY>; // flotteNum → cible commandée
    dragFleet?: { from: XY; vitesse: number; cursor: XY } | null; // drag en cours : anneau de vitesse + ligne + distance
    highlightPos?: XY; // case à surbriller (survol d'une flotte dans le panneau info)
    onAnyCanvasMouseDown?: () => void; // tout clic gauche sur la carte (avant la logique de pan)
    onFleetCellMouseDown?: (cell: XY, clientX: number, clientY: number) => void; // clic gauche sur une case avec ≥1 flotte du joueur
    onFleetCellGestureAbort?: () => void; // mousedown sur une case de flotte qui se transforme en pan
    onFleetDragOver?: (cell: XY) => void; // survol HTML5 d'un drag de flotte au-dessus de la carte
    onFleetDragLeave?: () => void; // le drag sort de la carte
    onFleetDrop?: (fleetNum: number, cell: XY) => void; // drop d'une flotte sur une case
};

export function colorForOwnership(currentPlayerId?: number, owners?: number[], alliances?: Alliance[], pna?: number[], colorMode: 'status' | 'race' | 'player' = 'status', globalData?: GlobalData) {
    if (owners && owners?.length === 1 && owners[0] === 0) return '#94a3b8';
    if (!owners || owners.length === 0) return '#94a3b8';

    // si y'en a plusieurs en enlevant le neutre
    if (owners.length > 1 ){
        const withoutNeutral = owners.filter(o => o !== 0);
        // si tous pareil, on renvoit la couleur,
        const colors: Set<string> = new Set(withoutNeutral
            .map(o => colorForOwnership(currentPlayerId, [o], alliances, pna, colorMode, globalData))
            .filter((s): s is string => !!s)
        );
        if(colors.size === 1) {
            return colors.values().next().value;
        } else {
            return '#fb923c';
        }
        // sinon on renvoi jaune
    }

    const owner = owners[0];
    if (currentPlayerId && owners.includes(currentPlayerId)) return '#10b981';

    if (colorMode === 'race') {
        return raceColorForOwner(globalData, owner) || getColorForPlayer(owner);
    }
    if (colorMode === 'player') {
        return getColorForPlayer(owner);
    }

    if (alliances && alliances.some(a => a.commandants.includes(owner))) return '#3b82f6';
    // Jaune (distinct de l'ambre #f59e0b réservé aux déplacements/flèches de direction)
    if (pna && pna.includes(owner)) return '#fde047';
    return '#ef4444';
}

export default function CanvasMap({onSelect, onCreateZone, previewZone, selected, showFleetsFor, showSystems, showGlobalSystems = true, selectedOwners, showCombatBadges, showOwnerBadges, showFleetBadges, fleetFocus = false, fleets, fleetCells, showSystemRadar, showFleetRadar, showSectors, showZones = true, showInfluence, colorMode = 'status', showStabilityZones, stabilitySystemPos, influenceOpacity = 0.18,
                        presenceMode = 'voronoi', presenceData = null, presenceDecay = 10, presenceFocus = null,
                        deplacements, dragFleet, highlightPos, onAnyCanvasMouseDown, onFleetCellMouseDown, onFleetCellGestureAbort, onFleetDragOver, onFleetDragLeave, onFleetDrop}: Props) {
    const {rapport, global, cellSize, setCellSize, center, setCenter, setViewportDims, notes, selectedTags, publicCombats, zones, hiddenZoneLabels} = useReport();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fleetHitsRef = useRef<FleetHitRegion[]>([]);
    // Case survolée : dessinée sur un canvas séparé pour ne pas redessiner toute la carte à chaque mouvement de souris
    const hoverCanvasRef = useRef<HTMLCanvasElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const hoverRef = useRef<XY | undefined>(undefined);

    // Ref sur le center pour des mises à jour synchrones dans le drag
    const centerRef = useRef<XY | undefined>(center);
    useEffect(() => {
        centerRef.current = center;
    }, [center]);

    // Conteneur (pour le dragleave HTML5 : savoir si le pointeur sort vraiment de la carte)
    const hostRef = useRef<HTMLDivElement>(null);

    const fleetHitAt = useCallback((clientX: number, clientY: number) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        return rect ? findFleetHit(fleetHitsRef.current, clientX - rect.left, clientY - rect.top) : undefined;
    }, []);

    // Gestion du drag
    const dragRef = useRef({dragging: false, lastX: 0, lastY: 0, accX: 0, accY: 0, moved: false, startX: 0, startY: 0, fleetAbortFired: false});

    // Tracé d'une zone en cours (Alt + glisser)
    const [zoneDraft, setZoneDraft] = useState<{ start: XY; end: XY } | undefined>(undefined);

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
        return raceColorForOwner(global, owner);
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

        // 3. Systèmes globaux (data.xml) - si pas déjà présent et non masqués.
        // data.xml peut décrire une galaxie de taille différente du rapport affiché :
        // seuls les systèmes à l'intérieur du tore affiché sont cohérents (les autres
        // seraient dessinés enroulés sur une mauvaise case).
        if (showGlobalSystems && global?.systemes) {
            global.systemes.forEach(s => {
                if (s.pos.x < 1 || s.pos.x > BOUNDS.maxX || s.pos.y < 1 || s.pos.y > BOUNDS.maxY) return;
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
    }, [rapport, global, currentPlayerId, showGlobalSystems]);

    const combats = useMemo(() => {
        const fromRapport = rapport?.combats ?? [];
        // Les combats publics viennent de l'univers de data.xml/combats.htm : sur un rapport
        // d'une galaxie de taille différente, ceux hors du tore affiché seraient dessinés
        // enroulés sur une mauvaise case → on les exclut.
        const fromPublic = (publicCombats ?? []).filter(
            c => c.pos && c.pos.x >= 1 && c.pos.x <= BOUNDS.maxX && c.pos.y >= 1 && c.pos.y <= BOUNDS.maxY
        );
        return [...fromRapport, ...fromPublic];
    }, [rapport, publicCombats]);

    // Capacité de réparation par position (somme des caractéristiques « capacité réparation
    // vaisseaux » des bâtiments des planètes) : les systèmes à capacité > 0 reçoivent un bord
    // blanc épais sur leur disque (légende « réparation »)
    const reparationByPos = useMemo(() => {
        const map = new Map<string, number>();
        systems.forEach(s => {
            if (Array.isArray(s.planetes) && s.planetes.length > 0) {
                map.set(`${s.pos.x}_${s.pos.y}`, capaciteReparation(s.planetes, global));
            }
        });
        return map;
    }, [systems, global]);

    // Redessine uniquement le contour de la case survolée (sur le canvas dédié).
    // La géométrie est recalculée pour rester alignée avec la carte principale (tore, centre, taille de case).
    const redrawHoverOverlay = useCallback(() => {
        const cvs = canvasRef.current;
        const hov = hoverCanvasRef.current;
        if (!cvs || !hov) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(cvs.clientWidth * dpr);
        const h = Math.round(cvs.clientHeight * dpr);
        if (hov.width !== w) hov.width = w;
        if (hov.height !== h) hov.height = h;
        const ctx = hov.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cvs.clientWidth, cvs.clientHeight);

        const cell = hoverRef.current;
        const c = centerRef.current;
        if (!cell || !c) return;

        const cols = Math.floor(cvs.clientWidth / cellSize);
        const rows = Math.floor(cvs.clientHeight / cellSize);
        const halfCols = Math.floor(cols / 2);
        const halfRows = Math.floor(rows / 2);
        const topX = wrapX(c.x - halfRows);
        const leftY = wrapY(c.y - halfCols);

        // Même enroulement tore que pour le dessin des systèmes
        let dx = ((cell.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
        let dyBase = ((cell.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        while (dx < cols) {
            if (dx === 0) { dx += BOUNDS.maxY; continue; }
            let dy = dyBase;
            while (dy < rows) {
                if (dy === 0) { dy += BOUNDS.maxX; continue; }
                const px = dx * cellSize;
                const py = dy * cellSize;
                ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
                dy += BOUNDS.maxX;
            }
            dx += BOUNDS.maxY;
        }
    }, [cellSize]);

    // Tooltip : récapitulatif d'une case, sans avoir à cliquer.
    // Deux ancrages : sous le curseur pendant le survol, ou sur la case sélectionnée
    // (cadre jaune) lorsque celle-ci bouge au clavier (Maj + flèches) ou par clic.
    const tooltipModeRef = useRef<'mouse' | 'cell' | 'none'>('none');

    const hideTooltip = useCallback(() => {
        tooltipModeRef.current = 'none';
        const el = tooltipRef.current;
        if (el) el.style.display = 'none';
    }, []);

    // Remplit le contenu du tooltip pour une case (sans le positionner)
    const fillTooltip = useCallback((xy: XY) => {
        const el = tooltipRef.current;
        if (!el) return;

        el.textContent = '';
        const posEl = document.createElement('span');
        posEl.textContent = `${xy.x}-${xy.y}`;
        posEl.style.cssText = 'font-weight:bold;color:#38bdf8;';
        el.appendChild(posEl);

        const sys = systems.find(s => s.pos.x === xy.x && s.pos.y === xy.y);
        if (sys) {
            const nameEl = document.createElement('span');
            nameEl.textContent = `  ${sys.nom}`;
            el.appendChild(nameEl);
            const owners = (sys as any).owners as number[] | undefined;
            if (owners && owners.length > 0) {
                owners.forEach((o, i) => {
                    if (i > 0) {
                        const sep = document.createElement('span');
                        sep.textContent = ', ';
                        sep.style.color = '#64748b';
                        el.appendChild(sep);
                    }
                    const span = document.createElement('span');
                    const cmd = o === 0 ? undefined : global?.commandants?.find(c2 => c2.numero === o);
                    span.textContent = (i === 0 ? '  ' : '') + (o === 0 ? 'Neutre (0)' : cmd ? `${cmd.nom} (${o})` : `#${o}`);
                    span.style.color = o === 0 ? '#94a3b8' : (ownerRaceColor(o) || '#cbd5e1');
                    el.appendChild(span);
                });
            }
        }
        const summary = fleetCells.get(`${xy.x}_${xy.y}`);
        if (summary) {
            const title = document.createElement('span');
            title.textContent = `  ${summary.visibleCount}/${summary.totalCount} flottes visibles${summary.hiddenCount ? ` · ${summary.hiddenCount} masquée(s)` : ''}`;
            title.style.color = '#38bdf8';
            el.appendChild(title);

            const formations = summary.formations;
            formations.forEach(formation => {
                el.appendChild(document.createElement('br'));
                const commander = formation.owner === 0 ? undefined : global?.commandants?.find(c => c.numero === formation.owner);
                const ownerName = formation.owner === currentPlayerId
                    ? 'Vous'
                    : formation.owner === 0 ? 'Neutre'
                    : commander ? `${commander.nom} (#${formation.owner})` : `#${formation.owner}`;
                const source = formation.detected ? 'détection' : 'seuil joueur';
                const row = document.createElement('span');
                row.textContent = `  ${ownerName} : ×${formation.count} flottes · ${verboseCompositionLabel(formation)} · ${formation.shipCount} vaisseaux · ${source}`;
                row.style.color = colorForOwnership(
                    currentPlayerId,
                    [formation.owner],
                    rapport?.joueur.alliances,
                    rapport?.joueur.pna,
                    colorMode,
                    global,
                ) || '#cbd5e1';
                el.appendChild(row);
            });
            if (formations.length === 0) {
                const filtered = document.createElement('span');
                filtered.textContent = '  (masquées par le filtre de puissance)';
                filtered.style.color = '#94a3b8';
                el.appendChild(filtered);
            }
        }
    }, [systems, fleetCells, global, ownerRaceColor, currentPlayerId, rapport, colorMode]);

    // Ancré sous le curseur (survol)
    const showTooltipAtMouse = useCallback((clientX: number, clientY: number, xy: XY | undefined) => {
        const el = tooltipRef.current;
        const cvs = canvasRef.current;
        if (!el) return;
        if (!xy || !cvs) {
            hideTooltip();
            return;
        }
        fillTooltip(xy);
        el.style.display = 'block';
        tooltipModeRef.current = 'mouse';
        const rect = cvs.getBoundingClientRect();
        let x = clientX - rect.left + 14;
        let y = clientY - rect.top + 14;
        if (x + el.offsetWidth + 4 > rect.width) x = clientX - rect.left - el.offsetWidth - 14;
        if (y + el.offsetHeight + 4 > rect.height) y = clientY - rect.top - el.offsetHeight - 14;
        el.style.left = `${Math.max(4, x)}px`;
        el.style.top = `${Math.max(4, y)}px`;
    }, [fillTooltip, hideTooltip]);

    // Ancré sur la case (cadre jaune sélectionné) : au-dessus du cadre, en dessous s'il
    // n'y a pas de place. Masqué si la case n'est pas visible (bandeaux d'en-tête inclus).
    const showTooltipForCell = useCallback((xy: XY) => {
        const el = tooltipRef.current;
        const cvs = canvasRef.current;
        const c = centerRef.current;
        if (!el || !cvs || !c) {
            hideTooltip();
            return;
        }
        const cols = Math.floor(cvs.clientWidth / cellSize);
        const rows = Math.floor(cvs.clientHeight / cellSize);
        const halfCols = Math.floor(cols / 2);
        const halfRows = Math.floor(rows / 2);
        const topX = wrapX(c.x - halfRows);
        const leftY = wrapY(c.y - halfCols);
        // Même enroulement tore que pour le dessin de la carte
        const dx = ((xy.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
        const dy = ((xy.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
        if (dx < 1 || dy < 1 || dx >= cols || dy >= rows) {
            hideTooltip(); // case hors de la zone visible (le cadre jaune n'y est pas dessiné non plus)
            return;
        }
        fillTooltip(xy);
        el.style.display = 'block';
        tooltipModeRef.current = 'cell';
        const px = dx * cellSize;
        const py = dy * cellSize;
        let x = px + cellSize / 2 - el.offsetWidth / 2;
        let y = py - el.offsetHeight - 6;
        if (y < 4) y = py + cellSize + 6;
        x = Math.min(Math.max(4, x), cvs.clientWidth - el.offsetWidth - 4);
        y = Math.min(Math.max(4, y), cvs.clientHeight - el.offsetHeight - 4);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }, [cellSize, fillTooltip, hideTooltip]);

    // La case sélectionnée change (Maj + flèches, clic, « aller à une case ») : le tooltip la
    // suit, et se repose à chaque recentrage / zoom
    useEffect(() => {
        if (selected) {
            showTooltipForCell(selected);
        } else if (tooltipModeRef.current === 'cell') {
            hideTooltip();
        }
    }, [selected, center, cellSize, showTooltipForCell, hideTooltip]);


    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const currentCenter = center || CENTER;
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

        fleetHitsRef.current = [];

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

        const fleetView = {topX, leftY, rows, cols, cellSize, maxX: BOUNDS.maxX, maxY: BOUNDS.maxY};

        // Couche présence/influence : le mode « présence » échantillonne une grille précalculée sur
        // TOUTE la galaxie (computePresence) ; le mode « voronoi » garde l'ancienne influence
        // attribuée au système connu le plus proche (calculée ici, sur le viewport seulement).
        const usePresenceGrid = showInfluence && presenceMode === 'presence' && !!presenceData;
        const useVoronoi = showInfluence && !usePresenceGrid;

        // Préparation des influenceurs pour la couche d'influence (mode voronoi uniquement)
        const influencers: { owner: number, pos: XY }[] = [];
        if (useVoronoi) {
            // On ne prend QUE les systèmes des joueurs (pas les flottes, pas les systèmes neutres)
            const influencerMap = new Map<number, XY[]>();
            systems.forEach(s => {
                if (s.owners) {
                    (s.owners as number[]).forEach(o => {
                        const ownerId = Number(o);
                        if (ownerId === 0) return; // Exclure les systèmes neutres
                        if (!influencerMap.has(ownerId)) influencerMap.set(ownerId, []);
                        influencerMap.get(ownerId)!.push(s.pos);
                    });
                }
            });

            // Pour chaque commandant, on garde toutes ses positions (systèmes uniquement)
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
                        } else if (d === minDist) {
                            // En cas d'égalité, le joueur local a la priorité
                            if (owner === currentPlayerId) {
                                closestOwner = owner;
                            }
                        }
                    });

                    influenceGrid[r][c] = closestOwner;
                }
            }
        }

        // fond des secteurs 10×10
        for (let r = 0; r < rows; r++) {
            const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
            for (let c = 0; c < cols; c++) {
                const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);

                // Ne pas dessiner le contenu dans les en-têtes (ligne 0 et colonne 0 du canvas)
                if (r === 0 || c === 0) continue;

                const sectorBg = showSectors ? sectorBackgroundColor(xCoord, yCoord) : null;
                if (sectorBg) {
                    ctx.fillStyle = sectorBg;
                    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }

                // Couche présence / influence - dessinée après le damier pour plus de clarté
                const presenceIdx = presenceData ? (xCoord - 1) * presenceData.maxY + (yCoord - 1) : -1;
                if (usePresenceGrid && presenceData) {
                    const winner = presenceData.winner[presenceIdx];
                    if (winner >= 0) {
                        const baseColor = colorMode === 'race' ? (ownerRaceColor(winner) || getColorForPlayer(winner)) : getColorForPlayer(winner);
                        // Opacité proportionnelle à la densité : plus c'est dense, plus c'est net
                        const conf = Math.min(1, presenceData.density[presenceIdx] / presenceData.densityMax);
                        ctx.fillStyle = withOpacity(baseColor, influenceOpacity * Math.max(0.08, conf));
                        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                    } else if (presenceData.unknownCells.has(`${xCoord}_${yCoord}`)) {
                        // Système de la carte galactique jamais observé : il existe, propriétaire inconnu
                        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(c * cellSize + cellSize * 0.22, r * cellSize + cellSize * 0.78);
                        ctx.lineTo(c * cellSize + cellSize * 0.78, r * cellSize + cellSize * 0.22);
                        ctx.moveTo(c * cellSize + 0.45 * cellSize, r * cellSize + cellSize * 0.92);
                        ctx.lineTo(c * cellSize + cellSize * 0.92, r * cellSize + 0.45 * cellSize);
                        ctx.stroke();
                    }
                } else if (useVoronoi && influenceGrid[r] && influenceGrid[r][c] !== -1) {
                    const closestOwner = influenceGrid[r][c];
                    const baseColor = colorMode === 'race' ? (ownerRaceColor(closestOwner) || getColorForPlayer(closestOwner)) : colorMode === 'player' ? getColorForPlayer(closestOwner) : getColorForPlayer(closestOwner);
                    // Rend la couleur semi-transparente (couleurs HSL des joueurs ou hexa des races)
                    ctx.fillStyle = withOpacity(baseColor, influenceOpacity);
                    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }

                const influenceBorderWidth = 0.6;

                // Bordures d'influence / de présence (voisins calculés par coordonnées enroulées, pas par index)
                if (usePresenceGrid && presenceData) {
                    const currentOwner = presenceData.winner[presenceIdx];
                    const rightIdx = (xCoord - 1) * presenceData.maxY + (yCoord >= presenceData.maxY ? 0 : yCoord);
                    const bottomIdx = (xCoord >= presenceData.maxX ? 0 : xCoord) * presenceData.maxY + (yCoord - 1);
                    // Bordure droite
                    if (c < cols) {
                        const rightOwner = presenceData.winner[rightIdx];
                        if (currentOwner >= 0 && rightOwner >= 0 && currentOwner !== rightOwner) {
                            ctx.lineWidth = influenceBorderWidth;
                            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                            ctx.beginPath();
                            ctx.moveTo((c + 1) * cellSize, r * cellSize);
                            ctx.lineTo((c + 1) * cellSize, (r + 1) * cellSize);
                            ctx.stroke();
                        }
                    }
                    // Bordure basse
                    if (r < rows) {
                        const bottomOwner = presenceData.winner[bottomIdx];
                        if (currentOwner >= 0 && bottomOwner >= 0 && currentOwner !== bottomOwner) {
                            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                            ctx.lineWidth = influenceBorderWidth;
                            ctx.beginPath();
                            ctx.moveTo(c * cellSize, (r + 1) * cellSize);
                            ctx.lineTo((c + 1) * cellSize, (r + 1) * cellSize);
                            ctx.stroke();
                        }
                    }
                } else if (useVoronoi && influenceGrid[r]) {
                    const currentOwner = influenceGrid[r][c];
                    ctx.lineWidth = 0.3;

                    // Bordure droite
                    if (c < cols) {
                        const rightOwner = influenceGrid[r][c+1];
                        if (currentOwner !== rightOwner) {
                            ctx.lineWidth = influenceBorderWidth;
                            ctx.strokeStyle = '#FFFF';
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
                            ctx.strokeStyle = "#FFF";
                            ctx.lineWidth = influenceBorderWidth;
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

        // grille + en-têtes — densité adaptative : en dézoomant on ne garde que les repères
        // (×5, ×20) ; la grille fine complète ne sert que lorsque les cases sont lisibles.
        const showMinorGrid = cellSize >= 26;
        // En dessous de ~14px par case, un chiffre ne rentre plus dans l'en-tête : coches seules
        const headerLabelEvery = cellSize >= 30 ? 1 : 5;
        const showHeaderLabels = cellSize >= 14;
        for (let r = 0; r <= rows; r++) {
            const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
            const yPos = r * cellSize;
            const isMajor20 = (xCoord - 1) % 20 === 0;
            const isMajor5 = (xCoord - 1) % 5 === 0;
            if (showMinorGrid || isMajor5 || isMajor20) {
                ctx.lineWidth = isMajor20 ? 1.2 : 1;
                if (isMajor20) ctx.strokeStyle = '#274058';
                else if (isMajor5) ctx.strokeStyle = '#1e2a38';
                else ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
                ctx.beginPath();
                ctx.moveTo(0, yPos);
                ctx.lineTo(cols * cellSize, yPos);
                ctx.stroke();
                ctx.lineWidth = 1;
            }

            // Fond opaque pour l'en-tête de ligne (surligné si c'est la ligne de la case sélectionnée)
            const rowSelected = r > 0 && selected?.x === xCoord;
            ctx.fillStyle = rowSelected ? '#38bdf8' : '#141c28';
            ctx.fillRect(0, yPos, cellSize, cellSize);

            // Chiffres tous les 5 (sinon coches discrètes) : le chrome ne doit pas
            // crier plus fort que le contenu (compteurs de flottes, marqueurs).
            if (showHeaderLabels && (rowSelected || xCoord % headerLabelEvery === 0)) {
                ctx.fillStyle = rowSelected ? '#0b0f17' : '#7d8ba0';
                ctx.font = '600 10px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(xCoord), cellSize / 2, yPos + cellSize / 2);
            } else {
                ctx.fillStyle = '#3b475a';
                ctx.fillRect(cellSize / 2 - 1, yPos + cellSize / 2 - 1, 2, 2);
            }
        }

        for (let c = 0; c <= cols; c++) {
            const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);
            const xPos = c * cellSize;
            const isMajor20 = (yCoord - 1) % 20 === 0;
            const isMajor5 = (yCoord - 1) % 5 === 0;
            if (showMinorGrid || isMajor5 || isMajor20) {
                ctx.lineWidth = isMajor20 ? 1.2 : 1;
                if (isMajor20) ctx.strokeStyle = '#274058';
                else if (isMajor5) ctx.strokeStyle = '#1e2a38';
                else ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
                ctx.beginPath();
                ctx.moveTo(xPos, 0);
                ctx.lineTo(xPos, rows * cellSize);
                ctx.stroke();
                ctx.lineWidth = 1;
            }

            // Fond opaque pour l'en-tête de colonne (surligné si c'est la colonne de la case sélectionnée)
            const colSelected = c > 0 && selected?.y === yCoord;
            ctx.fillStyle = colSelected ? '#38bdf8' : '#141c28';
            ctx.fillRect(xPos, 0, cellSize, cellSize);

            if (showHeaderLabels && (colSelected || yCoord % headerLabelEvery === 0)) {
                ctx.fillStyle = colSelected ? '#0b0f17' : '#7d8ba0';
                ctx.font = '600 10px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(yCoord), xPos + cellSize / 2, cellSize / 2);
            } else {
                ctx.fillStyle = '#3b475a';
                ctx.fillRect(xPos + cellSize / 2 - 1, cellSize / 2 - 1, 2, 2);
            }
        }

        // Repère d'axes dans la case d'angle (x = lignes ↓, y = colonnes →)
        ctx.fillStyle = '#5b6b80';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('x↓', cellSize / 2, cellSize / 2);

        // ZONES MANUELLES – rectangles saisis à la main (coin haut-gauche = case cliquée)

        ctx.save();
        ctx.beginPath();
        ctx.rect(cellSize, cellSize, cols * cellSize - cellSize, rows * cellSize - cellSize);
        ctx.clip();
        const zonesToDraw: (Omit<Zone, 'id'> & { preview?: boolean })[] = previewZone ? [...zones, {...previewZone, preview: true}] : zones;
        zonesToDraw.forEach(z => {
            if (!z.preview && (!showZones || (z.label && hiddenZoneLabels.includes(z.label)))) return;
            // décalage signé (tore) du coin haut-gauche par rapport au centre
            let offX = z.x - currentCenter.x;
            if (offX > BOUNDS.maxX / 2) offX -= BOUNDS.maxX;
            if (offX < -BOUNDS.maxX / 2) offX += BOUNDS.maxX;
            let offY = z.y - currentCenter.y;
            if (offY > BOUNDS.maxY / 2) offY -= BOUNDS.maxY;
            if (offY < -BOUNDS.maxY / 2) offY += BOUNDS.maxY;
            // copies décalées d'un tour pour les zones qui chevauchent le bord
            for (const wx of [-BOUNDS.maxX, 0, BOUNDS.maxX]) {
                for (const wy of [-BOUNDS.maxY, 0, BOUNDS.maxY]) {
                    const px = (halfCols + offY + wy) * cellSize;
                    const py = (halfRows + offX + wx) * cellSize;
                    const w = z.width * cellSize;
                    const h = z.height * cellSize;
                    if (px + w < 0 || py + h < 0 || px > cols * cellSize || py > rows * cellSize) continue;
                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = z.bgColor;
                    ctx.fillRect(px, py, w, h);
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = z.borderColor;
                    ctx.lineWidth = 2;
                    if (z.preview) ctx.setLineDash([6, 4]); // pointillés : zone pas encore validée
                    ctx.strokeRect(px, py, w, h);
                    ctx.setLineDash([]);
                    if (z.label) {
                        ctx.fillStyle = z.borderColor;
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                        ctx.fillText(z.label, px + 4, py + 3);
                    }
                }
            }
        });

        // Aperçu de la zone en cours de tracé
        if (zoneDraft) {
            const r = zoneRectFrom(zoneDraft.start, zoneDraft.end);
            let offX = r.x - currentCenter.x;
            if (offX > BOUNDS.maxX / 2) offX -= BOUNDS.maxX;
            if (offX < -BOUNDS.maxX / 2) offX += BOUNDS.maxX;
            let offY = r.y - currentCenter.y;
            if (offY > BOUNDS.maxY / 2) offY -= BOUNDS.maxY;
            if (offY < -BOUNDS.maxY / 2) offY += BOUNDS.maxY;
            const px = (halfCols + offY) * cellSize;
            const py = (halfRows + offX) * cellSize;
            const w = r.width * cellSize;
            const h = r.height * cellSize;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(px, py, w, h);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(px, py, w, h);
            ctx.setLineDash([]);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`${r.width}×${r.height}`, px + 4, py + 3);
        }
        ctx.restore();


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
                            if (cxIdx === 0 || cyIdx === 0) {
                                cyIdx += BOUNDS.maxX;
                                continue;
                            }
                            detected.add(`${cxIdx},${cyIdx}`);
                            cyIdx += BOUNDS.maxX;
                        }
                        cxIdx += BOUNDS.maxY;
                    }
                }
            }
        });

        // Dessin unique des cases détectées : aplat très léger + liseré périphérique.
        // L'œil lit la frontière de la zone sans que le bleu n'écrase le contenu.
        const cScan = ctx as CanvasRenderingContext2D;
        cScan.save();
        cScan.globalAlpha = 1.0;
        cScan.fillStyle = 'rgba(56, 150, 255, 0.07)';
        detected.forEach(key => {
            const [ixStr, iyStr] = key.split(',');
            const ix = Number(ixStr);
            const iy = Number(iyStr);
            cScan.fillRect(ix * cellSize, iy * cellSize, cellSize, cellSize);
        });
        // Liseré : trait sur chaque arête dont le voisin n'est pas détecté
        cScan.strokeStyle = 'rgba(56, 150, 255, 0.35)';
        cScan.lineWidth = 1;
        cScan.beginPath();
        detected.forEach(key => {
            const [ix, iy] = key.split(',').map(Number);
            const px = ix * cellSize;
            const py = iy * cellSize;
            if (!detected.has(`${ix},${iy - 1}`)) { cScan.moveTo(px, py); cScan.lineTo(px + cellSize, py); }
            if (!detected.has(`${ix},${iy + 1}`)) { cScan.moveTo(px, py + cellSize); cScan.lineTo(px + cellSize, py + cellSize); }
            if (!detected.has(`${ix - 1},${iy}`)) { cScan.moveTo(px, py); cScan.lineTo(px, py + cellSize); }
            if (!detected.has(`${ix + 1},${iy}`)) { cScan.moveTo(px + cellSize, py); cScan.lineTo(px + cellSize, py + cellSize); }
        });
        cScan.stroke();

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
                if (dx === 0) {
                    dx += BOUNDS.maxY;
                    continue;
                }
                let currentDy = dy;
                while (currentDy < rows) {
                    if (currentDy === 0) {
                        currentDy += BOUNDS.maxX;
                        continue;
                    }
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
                    if (dx === 0) {
                        dx += BOUNDS.maxY;
                        continue;
                    }
                    let currentDy = dy;
                    while (currentDy < rows) {
                        if (currentDy === 0) {
                            currentDy += BOUNDS.maxX;
                            continue;
                        }
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
                    if (dx === 0) {
                        dx += BOUNDS.maxY;
                        continue;
                    }
                    let currentDy = dy;
                    while (currentDy < rows) {
                        if (currentDy === 0) {
                            currentDy += BOUNDS.maxX;
                            continue;
                        }
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
            let col = colorForOwnership(currentPlayerId, owners, rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global);
            if (isGlobalOnly) col = '#333'; // Plus sombre pour les systèmes non détectés

            // Taille du disque en fonction du nombre de planètes:
            // 10 planètes => 50% de la case, 20 planètes => 100% de la case
            const nbPla = Number(s.nbPla) || 0;
            const t = Math.max(10, Math.min(20, nbPla));
            const baseFactor = 0.45 + ((t - 10) * (0.5 / 10)); // 10 -> 0.5, 20 -> 1.0
            const factor = isGlobalOnly ? baseFactor * 0.5 : baseFactor; // Taille plus petite par défaut si global uniquement
            // En focus flottes, les systèmes deviennent du contexte plutôt que le premier signal lu.
            const diameter = cellSize * factor * (fleetFocus ? 0.68 : 1);
            const radius = diameter / 2;

            const cx = px + cellSize / 2;
            const cy = py + cellSize / 2;

            // Couche présence : on estompe les détections anciennes et, en mode focus, les systèmes
            // qui n'appartiennent pas au commandant focus (disque, contour et insigne).
            let presenceDim = 1;
            if (presenceMode === 'presence') {
                if (s.tour != null && detectionWeight(rapport?.tour ?? 0, s.tour, presenceDecay) < 0.5) presenceDim *= 0.5;
                if (presenceFocus != null && !(owners || []).includes(presenceFocus)) presenceDim *= 0.35;
            }

            const c2d = ctx as CanvasRenderingContext2D;
            c2d.save();
            if (fleetFocus) c2d.globalAlpha = 0.42;
            if (presenceDim < 1) c2d.globalAlpha *= presenceDim;
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
                const colors = multiOwners.map(o => colorForOwnership(currentPlayerId, [o], rapport?.joueur.alliances, rapport?.joueur.pna, colorMode, global));

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

            // Contour fin autour du disque (remplace l'ancien halo lumineux, plus lisible et plus léger)
            if (isSystemSelected(owners)) {
                const ringColor = lightenHexColor(col || '#000000', 100);
                const cRing = ctx as CanvasRenderingContext2D;
                cRing.save();
                if (fleetFocus) cRing.globalAlpha = 0.5;
                if (presenceDim < 1) cRing.globalAlpha *= presenceDim;
                cRing.strokeStyle = ringColor;
                cRing.lineWidth = 1.5;
                cRing.beginPath();
                cRing.arc(cx, cy, radius + 1, 0, Math.PI * 2);
                cRing.stroke();
                cRing.restore();
            }

            // Capacité de réparation > 0 : petit insigne « + » en haut-gauche de la case.
            // (Avant : anneau blanc épais autour du disque — visuellement dominant, il
            // rivalisait avec la sélection et lavait le contraste des systèmes voisins.)
            // Masqué en très petit zoom (case ≤ 16 px, minimum de la barre de zoom) : à cette
            // échelle l'insigne ne se lit plus.
            const reparation = reparationByPos.get(`${s.pos.x}_${s.pos.y}`) ?? 0;
            if (reparation > 0 && isSystemSelected(owners) && cellSize > 16) {
                const chip = Math.max(10, Math.round(cellSize * 0.42));
                const pad = Math.max(2, Math.round(cellSize * 0.06));
                const bx = px + pad;
                const by = py + pad;
                const cr = Math.max(2, chip * 0.25);
                const cRep = ctx as CanvasRenderingContext2D;
                cRep.save();
                if (fleetFocus) cRep.globalAlpha = 0.55;
                if (presenceDim < 1) cRep.globalAlpha *= presenceDim;
                cRep.beginPath();
                cRep.moveTo(bx + cr, by);
                cRep.arcTo(bx + chip, by, bx + chip, by + chip, cr);
                cRep.arcTo(bx + chip, by + chip, bx, by + chip, cr);
                cRep.arcTo(bx, by + chip, bx, by, cr);
                cRep.arcTo(bx, by, bx + chip, by, cr);
                cRep.closePath();
                cRep.fillStyle = 'rgba(10, 15, 25, 0.9)';
                cRep.fill();
                cRep.strokeStyle = 'rgba(226, 232, 240, 0.7)';
                cRep.lineWidth = 1;
                cRep.stroke();
                const m = Math.max(2.5, chip * 0.28);
                cRep.strokeStyle = '#f8fafc';
                cRep.lineWidth = Math.max(1.4, chip * 0.12);
                cRep.beginPath();
                cRep.moveTo(bx + chip / 2, by + m);
                cRep.lineTo(bx + chip / 2, by + chip - m);
                cRep.moveTo(bx + m, by + chip / 2);
                cRep.lineTo(bx + chip - m, by + chip / 2);
                cRep.stroke();
                cRep.restore();
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
                    if (fleetFocus) c2d.globalAlpha = 0.55;
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
                    if (fleetFocus) c2d.globalAlpha = 0.55;
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

        // Flèche (direction / ordre de déplacement) : trait + pointe pleine, clipée à la grille.
        // Les directions du rapport et les ordres partagent la projection torique et le clip.
        const drawArrow = (c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#f59e0b') => {
            const headLen = Math.max(6, Math.floor(cellSize * 0.25));
            const angle = Math.atan2(y2 - y1, x2 - x1);
            c.save();
            c.beginPath();
            c.rect(cellSize, cellSize, Math.max(0, cols - 1) * cellSize, Math.max(0, rows - 1) * cellSize);
            c.clip();
            c.strokeStyle = color;
            c.fillStyle = color;
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(x1, y1);
            c.lineTo(x2, y2);
            c.stroke();
            c.beginPath();
            c.moveTo(x2, y2);
            c.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            c.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            c.closePath();
            c.fill();
            c.restore();
        };

        // Passage GLOBAL : aucune direction d'une case ne repeint les marqueurs d'une autre.
        const drawReportDirections = () => {
            if (!showFleetBadges) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(cellSize, cellSize, Math.max(0, cols - 1) * cellSize, Math.max(0, rows - 1) * cellSize);
            ctx.clip();
            fleetCells.forEach(summary => summary.formations.forEach(formation => {
                const directions = new Map<string, {target: XY; count: number}>();
                formation.fleets.forEach(fleet => {
                    if (fleet.type !== 'joueur' || deplacements?.[fleet.num]) return;
                    const target = fleet.direction;
                    if (!target || (target.x === fleet.pos.x && target.y === fleet.pos.y)) return;
                    const key = `${target.x}_${target.y}`;
                    const group = directions.get(key);
                    if (group) group.count += 1;
                    else directions.set(key, {target, count: 1});
                });
                const selected = isFleetSelected(formation.owner);
                directions.forEach(({target, count}) => {
                    projectFleetRoute(summary.pos, target, fleetView).forEach(({from, to}) => {
                        drawArrow(ctx, from.x, from.y, to.x, to.y, selected ? '#f59e0b' : '#64748b');
                        if (count > 1 && cellSize >= 34) {
                            ctx.fillStyle = selected ? '#fbbf24' : '#94a3b8';
                            ctx.font = '600 9px system-ui, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(`×${count}`, (from.x + to.x) / 2, (from.y + to.y) / 2 - 7);
                        }
                    });
                });
            }));
            ctx.restore();
        };

        const drawFleetMarkers = () => {
            if (!showFleetBadges) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(cellSize, cellSize, Math.max(0, cols - 1) * cellSize, Math.max(0, rows - 1) * cellSize);
            ctx.clip();
            fleetCells.forEach(summary => {
                if (!summary.visibleCount) return;
                visibleFleetCopies(summary.pos, fleetView).forEach(({x, y}) => {
                    const layout = drawFleetCell(ctx, summary, x, y, cellSize, {
                        focus: fleetFocus,
                        getOwnerColor: owner => colorForOwnership(currentPlayerId, [owner], rapport?.joueur.alliances,
                            rapport?.joueur.pna, colorMode, global) || '#94a3b8',
                        isOwnerSelected: isFleetSelected,
                        hasOwnerFilter: !!selectedOwners?.length,
                        deplacements,
                    });
                    fleetHitsRef.current.push(...fleetHitRegions(layout, x, y, summary.pos));
                });
            });
            ctx.restore();
        };

        const drawCombats = () => {
            // Marqueurs de combat au-dessus des systèmes (S = spatial, P = planétaire)
            if (showCombatBadges && combats.length > 0) {
                const cCombat = ctx as CanvasRenderingContext2D;
                cCombat.save();
                for (let r = 0; r < rows; r++) {
                    if (r === 0) continue;
                    const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
                    for (let c = 0; c < cols; c++) {
                        if (c === 0) continue;
                        const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);
                        const counts = countCombatsByKind(combats, {x: xCoord, y: yCoord});
                        if (counts.spatial <= 0 && counts.planetary <= 0) continue;
                        drawCombatMarkers(cCombat, c * cellSize, r * cellSize, cellSize, counts.spatial, counts.planetary);
                    }
                }
                cCombat.restore();
            }

        };

        const drawReachability = () => {
            if (!showFleetsFor) return;
            ctx.save();
            ctx.globalAlpha = 0.65;
            ctx.setLineDash([5, 5]);
            rapport?.flottesJoueur.forEach(fleet => {
                const color = getTorusDistance(fleet.pos, showFleetsFor) <= fleet.vitesse ? '#10b981' : '#f59e0b';
                projectFleetRoute(fleet.pos, showFleetsFor, fleetView).forEach(({from, to}) => {
                    drawArrow(ctx, from.x, from.y, to.x, to.y, color);
                });
            });
            ctx.restore();
        };

        // Cadre commun à la sélection et au survol. En focus, les coins restent au bord
        // intérieur de la case pour ne pas barrer les flottes des cases voisines.
        const drawCellCorners = (c2d: CanvasRenderingContext2D, px: number, py: number) => {
            const m = fleetFocus ? -0.5 : Math.max(3, Math.round(cellSize * 0.15));
            const l = Math.max(5, Math.round(cellSize * 0.35));
            c2d.lineWidth = 2;
            c2d.strokeStyle = '#ffffff';
            c2d.beginPath();
            // haut-gauche
            c2d.moveTo(px - m, py - m + l); c2d.lineTo(px - m, py - m); c2d.lineTo(px - m + l, py - m);
            // haut-droite
            c2d.moveTo(px + cellSize + m - l, py - m); c2d.lineTo(px + cellSize + m, py - m); c2d.lineTo(px + cellSize + m, py - m + l);
            // bas-droite
            c2d.moveTo(px + cellSize + m, py + cellSize + m - l); c2d.lineTo(px + cellSize + m, py + cellSize + m); c2d.lineTo(px + cellSize + m - l, py + cellSize + m);
            // bas-gauche
            c2d.moveTo(px - m + l, py + cellSize + m); c2d.lineTo(px - m, py + cellSize + m); c2d.lineTo(px - m, py + cellSize + m - l);
            c2d.stroke();
        };

        const drawSelection = () => {
            // Remplissage et cadre de sélection : sous les emblèmes en focus.
            if (selected) {
                const cSel = ctx as CanvasRenderingContext2D;
                cSel.save();
                cSel.beginPath();
                cSel.rect(cellSize, cellSize, cols * cellSize, rows * cellSize);
                cSel.clip();

                let dx = ((selected.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
                const dyBase = ((selected.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
                while (dx < cols) {
                    if (dx === 0) {
                        dx += BOUNDS.maxY;
                        continue;
                    }
                    let dy = dyBase;
                    while (dy < rows) {
                        if (dy === 0) {
                            dy += BOUNDS.maxX;
                            continue;
                        }
                        const px = dx * cellSize;
                        const py = dy * cellSize;

                        // Bandes discrètes sur la ligne et la colonne pour repérer la case
                        cSel.fillStyle = 'rgba(56, 189, 248, 0.05)';
                        cSel.fillRect(px, cellSize, cellSize, rows * cellSize);
                        cSel.fillRect(cellSize, py, cols * cellSize, cellSize);

                        // Remplissage léger de la case
                        cSel.fillStyle = 'rgba(56, 189, 248, 0.16)';
                        cSel.fillRect(px, py, cellSize, cellSize);

                        // Contour : trait sombre puis trait clair pour être lisible sur tout fond
                        cSel.lineWidth = 4;
                        cSel.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                        cSel.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
                        cSel.lineWidth = 2;
                        cSel.strokeStyle = '#38bdf8';
                        cSel.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

                        // Coins en équerre débordant de la case
                        drawCellCorners(cSel, px, py);

                        dy += BOUNDS.maxX;
                    }
                    dx += BOUNDS.maxY;
                }
                cSel.restore();
            }

        };

        const drawOrders = () => {
            if (!deplacements) return;
            fleetCells.forEach(summary => summary.formations.forEach(formation => {
                formation.fleets.forEach(fleet => {
                    if (fleet.type !== 'joueur') return;
                    const target = deplacements[fleet.num];
                    if (!target) return;
                    const color = getTorusDistance(fleet.pos, target) > fleet.vitesse ? '#ef4444' : '#10b981';
                    projectFleetRoute(fleet.pos, target, fleetView).forEach(({from, to}) => {
                        drawArrow(ctx, from.x, from.y, to.x, to.y, color);
                    });
                });
            }));
        };

        // En focus, TOUTES les routes persistantes et tous les remplissages passent sous les flottes ;
        // en vue normale, on conserve la priorité des ordres par-dessus les marqueurs.
        // Les marqueurs de combat (haut-droit de la case) restent la couche persistante
        // la plus haute dans les deux modes : jamais masqués par un badge de flotte.
        drawFleetScene(fleetFocus, {
            reportRoutes: drawReportDirections, fleets: drawFleetMarkers, combats: drawCombats,
            reachability: drawReachability, selection: drawSelection, orders: drawOrders,
        });

        // Très petit zoom (case ≤ 16 px, minimum de la barre de zoom) : un libellé par « blob »
        // de présence — le numéro du
        // commandant au point de densité locale la plus forte du blob (ex. #39), blanc à
        // contour sombre pour rester lisible sur n'importe quelle teinte. Le maximum local est
        // précalculé sur le tore complet (une seule passe), puis chaque copie visible du tore
        // est libellée au dessin.
        if (usePresenceGrid && presenceData && cellSize <= 16) {
            const pMaxX = presenceData.maxX;
            const pMaxY = presenceData.maxY;
            const isBlobAnchor = new Uint8Array(pMaxX * pMaxY);
            for (let x = 1; x <= pMaxX; x++) {
                for (let y = 1; y <= pMaxY; y++) {
                    const i = (x - 1) * pMaxY + (y - 1);
                    const w = presenceData.winner[i];
                    if (w < 0) continue;
                    const d = presenceData.density[i];
                    let anchor = true;
                    for (let dx = -2; dx <= 2 && anchor; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = wrapX(x + dx);
                            const ny = wrapY(y + dy);
                            const ni = (nx - 1) * pMaxY + (ny - 1);
                            if (presenceData.winner[ni] !== w) continue;
                            const dn = presenceData.density[ni];
                            // Égalité tranchée par les coordonnées : un blob plat ne sort qu'un libellé
                            if (dn > d || (dn === d && (nx < x || (nx === x && ny < y)))) {
                                anchor = false;
                                break;
                            }
                        }
                    }
                    if (anchor) isBlobAnchor[i] = 1;
                }
            }
            const pCtx = ctx as CanvasRenderingContext2D;
            const pFont = Math.max(7, Math.min(9, Math.round(cellSize * 0.55)));
            pCtx.save();
            pCtx.font = `700 ${pFont}px sans-serif`;
            pCtx.textAlign = 'center';
            pCtx.textBaseline = 'middle';
            pCtx.lineWidth = Math.max(1, Math.round(pFont / 5));
            pCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            pCtx.fillStyle = '#ffffff';
            for (let r = 1; r < rows; r++) {
                const xCoord = torusDelta(currentCenter.x, r - halfRows, BOUNDS.maxX);
                for (let c = 1; c < cols; c++) {
                    const yCoord = torusDelta(currentCenter.y, c - halfCols, BOUNDS.maxY);
                    const i = (xCoord - 1) * pMaxY + (yCoord - 1);
                    if (!isBlobAnchor[i]) continue;
                    const px = c * cellSize + cellSize / 2;
                    const py = r * cellSize + cellSize / 2;
                    pCtx.strokeText(`#${presenceData.winner[i]}`, px, py);
                    pCtx.fillText(`#${presenceData.winner[i]}`, px, py);
                }
            }
            pCtx.restore();
        }

        // SURBRILLANCE DE CASE (survol d'une flotte dans le panneau info) : même style que la case
        // sélectionnée (équerres blanches), par-dessus les flèches, sous le drag en cours
        if (highlightPos) {
            const hCtx = ctx as CanvasRenderingContext2D;
            hCtx.save();
            hCtx.beginPath();
            hCtx.rect(cellSize, cellSize, cols * cellSize, rows * cellSize);
            hCtx.clip();
            let dx = ((highlightPos.y - leftY + BOUNDS.maxY) % BOUNDS.maxY);
            let dy = ((highlightPos.x - topX + BOUNDS.maxX) % BOUNDS.maxX);
            while (dx < cols) {
                if (dx === 0) {
                    dx += BOUNDS.maxY;
                    continue;
                }
                let currentDy = dy;
                while (currentDy < rows) {
                    if (currentDy === 0) {
                        currentDy += BOUNDS.maxX;
                        continue;
                    }
                    drawCellCorners(hCtx, dx * cellSize, currentDy * cellSize);
                    currentDy += BOUNDS.maxX;
                }
                dx += BOUNDS.maxY;
            }
            hCtx.restore();
        }

        // DRAG DE FLOTTE EN COURS : anneau de vitesse (carré de Tchebyshev autour de l'origine),
        // ligne origine→case du curseur et distance en cases. Dessiné en tout dernier, par-dessus tout.
        if (dragFleet) {
            const dDist = getTorusDistance(dragFleet.from, dragFleet.cursor);
            const dColor = dDist <= dragFleet.vitesse ? '#10b981' : '#ef4444';
            const dCtx = ctx as CanvasRenderingContext2D;
            dCtx.save();
            // Clip sur la zone de grille (jamais sur les en-têtes)
            dCtx.beginPath();
            dCtx.rect(cellSize, cellSize, cols * cellSize, rows * cellSize);
            dCtx.clip();

            // Position écran d'une case : delta signé par rapport au centre (même méthode que les flèches de portée)
            const dScreen = (pos: XY) => {
                let offX = pos.x - currentCenter.x;
                if (offX > BOUNDS.maxX / 2) offX -= BOUNDS.maxX;
                if (offX < -BOUNDS.maxX / 2) offX += BOUNDS.maxX;
                let offY = pos.y - currentCenter.y;
                if (offY > BOUNDS.maxY / 2) offY -= BOUNDS.maxY;
                if (offY < -BOUNDS.maxY / 2) offY += BOUNDS.maxY;
                return {
                    x: (halfCols + offY) * cellSize + cellSize / 2,
                    y: (halfRows + offX) * cellSize + cellSize / 2,
                };
            };

            // (i) Anneau de vitesse : carré de Tchebyshev de rayon `vitesse` autour de l'origine.
            // Enroulé sur le tore comme les zones : on dessine les 9 copies décalées d'un tour
            // et on ne garde que celles qui touchent le viewport. (vitesse > demi-tore : toute
            // la galaxie est déjà à portée, il n'y a pas d'anneau limite à montrer.)
            const dR = dragFleet.vitesse;
            if (dR > 0 && dR <= BOUNDS.maxX / 2 && dR <= BOUNDS.maxY / 2) {
                let dOffX = (dragFleet.from.x - dR) - currentCenter.x;
                if (dOffX > BOUNDS.maxX / 2) dOffX -= BOUNDS.maxX;
                if (dOffX < -BOUNDS.maxX / 2) dOffX += BOUNDS.maxX;
                let dOffY = (dragFleet.from.y - dR) - currentCenter.y;
                if (dOffY > BOUNDS.maxY / 2) dOffY -= BOUNDS.maxY;
                if (dOffY < -BOUNDS.maxY / 2) dOffY += BOUNDS.maxY;
                const dSize = (2 * dR + 1) * cellSize;
                dCtx.lineWidth = 2;
                dCtx.strokeStyle = dColor;
                for (const wx of [-BOUNDS.maxX, 0, BOUNDS.maxX]) {
                    for (const wy of [-BOUNDS.maxY, 0, BOUNDS.maxY]) {
                        const px = (halfCols + dOffY + wy) * cellSize;
                        const py = (halfRows + dOffX + wx) * cellSize;
                        if (px + dSize < 0 || py + dSize < 0 || px > cols * cellSize || py > rows * cellSize) continue;
                        dCtx.strokeRect(px, py, dSize, dSize);
                    }
                }
            }

            // (ii) Ligne de la case d'origine vers la case sous le curseur, avec pointe de flèche à l'extrémité
            const dStart = dScreen(dragFleet.from);
            const dEnd = dScreen(dragFleet.cursor);
            const dAngle = Math.atan2(dEnd.y - dStart.y, dEnd.x - dStart.x);
            dCtx.lineWidth = 2;
            dCtx.strokeStyle = dColor;
            dCtx.beginPath();
            dCtx.moveTo(dStart.x, dStart.y);
            dCtx.lineTo(dEnd.x, dEnd.y);
            dCtx.stroke();
            const dHead = Math.max(8, Math.floor(cellSize * 0.3));
            dCtx.fillStyle = dColor;
            dCtx.beginPath();
            dCtx.moveTo(dEnd.x, dEnd.y);
            dCtx.lineTo(dEnd.x - dHead * Math.cos(dAngle - Math.PI / 6), dEnd.y - dHead * Math.sin(dAngle - Math.PI / 6));
            dCtx.lineTo(dEnd.x - dHead * Math.cos(dAngle + Math.PI / 6), dEnd.y - dHead * Math.sin(dAngle + Math.PI / 6));
            dCtx.closePath();
            dCtx.fill();

            // (iii) Distance en cases, au MILIEU du trait et décalée perpendiculairement :
            // ne passe jamais sous le curseur (le marquage à l'extrémité sud s'y cachait)
            const dLabel = String(dDist);
            dCtx.font = 'bold 12px sans-serif';
            dCtx.textAlign = 'center';
            dCtx.textBaseline = 'middle';
            dCtx.fillStyle = dColor;
            const dPerpX = -Math.sin(dAngle) * 14;
            const dPerpY = Math.cos(dAngle) * 14;
            const dMidX = (dStart.x + dEnd.x) / 2 + dPerpX;
            const dMidY = (dStart.y + dEnd.y) / 2 + dPerpY;
            dCtx.fillText(dLabel, dMidX, dMidY);
            dCtx.restore();
        }

        // Le survol dépend de la géométrie (centre, taille de case) : on resynchronise l'overlay après chaque dessin
        redrawHoverOverlay();
    }, [rapport, global, systems, fleets, combats, cellSize, center, currentPlayerId, setViewportDims, canvasSizeVersion, selectedOwners, notes, selectedTags, ownerRaceColor, showCombatBadges, showOwnerBadges, showFleetBadges, fleetFocus, fleetCells, showSystemRadar, showFleetRadar, showSectors, showInfluence, selected, showFleetsFor, showStabilityZones, stabilitySystemPos, showSystems, colorMode, influenceOpacity, presenceMode, presenceData, presenceDecay, presenceFocus, zones, showZones, hiddenZoneLabels, zoneDraft, previewZone, redrawHoverOverlay, deplacements, dragFleet, highlightPos, reparationByPos]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            // Alt + flèche : navigation dans les tours ; Maj + flèche (Ctrl : pas de 5) : case sélectionnée
            if (!center || e.altKey || e.shiftKey || isTypingTarget(e.target)) return;
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

    // Case de la carte sous le curseur (les en-têtes sont ramenés à la première case visible)
    const cellAt = useCallback((clientX: number, clientY: number): XY | undefined => {
        const cvs = canvasRef.current;
        const c = centerRef.current;
        if (!cvs || !c) return undefined;
        const rect = cvs.getBoundingClientRect();
        const cols = Math.floor(cvs.clientWidth / cellSize);
        const rows = Math.floor(cvs.clientHeight / cellSize);
        const col = Math.min(cols - 1, Math.max(1, Math.floor((clientX - rect.left) / cellSize)));
        const row = Math.min(rows - 1, Math.max(1, Math.floor((clientY - rect.top) / cellSize)));
        return {
            x: torusDelta(c.x, row - Math.floor(rows / 2), BOUNDS.maxX),
            y: torusDelta(c.y, col - Math.floor(cols / 2), BOUNDS.maxY),
        };
    }, [cellSize]);

    // Survol : surligne la case et affiche un récapitulatif (masqué sur les en-têtes)
    const handleMouseMove = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const rect = cvs.getBoundingClientRect();
        let xy: XY | undefined;
        const inGrid = evt.clientX - rect.left >= cellSize && evt.clientY - rect.top >= cellSize;
        if (!dragRef.current.dragging && inGrid) {
            xy = cellAt(evt.clientX, evt.clientY);
        }
        const prev = hoverRef.current;
        const changed = !!prev !== !!xy || (!!prev && !!xy && (prev.x !== xy.x || prev.y !== xy.y));
        hoverRef.current = xy;
        // Pendant le drag, le tooltip ancré sur la case sélectionnée suit le cadre jaune
        // (reposé par l'effet au recentrage) : on ne le remet pas à la souris.
        if (!dragRef.current.dragging) {
            showTooltipAtMouse(evt.clientX, evt.clientY, xy);
        }
        if (changed) redrawHoverOverlay();
    }, [cellAt, cellSize, showTooltipAtMouse, redrawHoverOverlay]);

    const handleMouseLeave = useCallback(() => {
        hoverRef.current = undefined;
        if (tooltipModeRef.current === 'mouse') {
            hideTooltip();
        }
        redrawHoverOverlay();
    }, [hideTooltip, redrawHoverOverlay]);

    const handleClick = (evt: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragRef.current.moved) {
            dragRef.current.moved = false;
            return;
        }
        if (evt.altKey && onCreateZone) return; // géré par le tracé (mousedown / mouseup)
        const xy = cellAt(evt.clientX, evt.clientY);
        if (!xy) return;
        onSelect(xy, evt.ctrlKey);
    };

    const handleMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
        if (evt.button !== 0) return; // seulement clic gauche

        // Ordres de déplacement : notification pour tout clic gauche (avant la logique de pan),
        // et détection d'une case contenant au moins une flotte du joueur (=> FleetPicker)
        onAnyCanvasMouseDown?.();
        const mdCell = cellAt(evt.clientX, evt.clientY);
        const hit = fleetHitAt(evt.clientX, evt.clientY);
        const hasOwnFleet = !!mdCell && (showFleetBadges
            ? !!fleetCells.get(`${mdCell.x}_${mdCell.y}`)?.formations.some(group => group.own)
            : fleets.some(f => f.type === 'joueur' && f.pos.x === mdCell.x && f.pos.y === mdCell.y));
        const isFleetCell = shouldOpenFleetPicker(hit, hasOwnFleet, currentPlayerId);
        // Alt trace une zone ; Ctrl interroge la portée ; les autres déclenchent le geste existant.
        if (isFleetCell && mdCell && !evt.altKey && !evt.ctrlKey) {
            onFleetCellMouseDown?.(mdCell, evt.clientX, evt.clientY);
        }

        // Alt + glisser : tracé d'une zone du coin de départ au coin de fin
        if (evt.altKey && onCreateZone) {
            const start = cellAt(evt.clientX, evt.clientY);
            if (!start) return;
            evt.preventDefault();
            let end = start;
            setZoneDraft({start, end});

            const onMove = (e: MouseEvent) => {
                const cell = cellAt(e.clientX, e.clientY);
                if (!cell || (cell.x === end.x && cell.y === end.y)) return;
                end = cell;
                setZoneDraft({start, end});
            };
            const onUp = (e: MouseEvent) => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                const last = cellAt(e.clientX, e.clientY) ?? end;
                setZoneDraft(undefined);
                // Sans glisser : simple sélection, les zones de la case sont éditables dans le panneau
                if (last.x === start.x && last.y === start.y) {
                    onSelect(start, false);
                    return;
                }
                onCreateZone(zoneRectFrom(start, last));
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return;
        }

        dragRef.current.dragging = true;
        // Le tooltip de survol disparaît au démarrage du drag ; seul celui ancré sur la case
        // sélectionnée (cadre jaune) est conservé et la suit pendant le pan
        if (tooltipModeRef.current === 'mouse') {
            hideTooltip();
        }
        dragRef.current.lastX = evt.clientX;
        dragRef.current.lastY = evt.clientY;
        dragRef.current.accX = 0;
        dragRef.current.accY = 0;
        dragRef.current.moved = false;
        // Repère de départ du geste : sert au seuil d'annulation du FleetPicker
        dragRef.current.startX = evt.clientX;
        dragRef.current.startY = evt.clientY;
        dragRef.current.fleetAbortFired = false;
        evt.preventDefault();

        const onMove = (e: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            // Seuil de 4 px sur le déplacement TOTAL depuis le mousedown : si le geste sur une
            // case de flotte devient un pan, on annule le FleetPicker (une seule fois).
            // Évalué en tête du onMove, donc AVANT tout pas de case : un pas de case exige
            // ≥ cellSize (≥ 8 px) de déplacement accumulé, ce seuil déclenche donc toujours
            // en premier. (Le tracé de zone Alt+glisser ne fait pas panser la carte : pas d'abort.)
            if (isFleetCell && !dragRef.current.fleetAbortFired) {
                if (Math.abs(e.clientX - dragRef.current.startX) >= 4 || Math.abs(e.clientY - dragRef.current.startY) >= 4) {
                    dragRef.current.fleetAbortFired = true;
                    onFleetCellGestureAbort?.();
                }
            }
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
    }, [cellSize, setCenter, cellAt, onCreateZone, onSelect, hideTooltip, fleets, fleetCells, showFleetBadges, currentPlayerId, fleetHitAt, onAnyCanvasMouseDown, onFleetCellMouseDown, onFleetCellGestureAbort]);

    const handleWheel = useCallback((evt: React.WheelEvent<HTMLCanvasElement>) => {
        const zoomSpeed = 0.1;
        const delta = evt.deltaY > 0 ? -1 : 1;
        const newSize = Math.max(8, Math.min(128, Math.round(cellSize * (1 + delta * zoomSpeed))));
        if (newSize !== cellSize) {
            setCellSize(newSize);
        }
    }, [cellSize, setCellSize]);

    // Drag & drop HTML5 de flottes (payload 'application/x-fleet-num' posé par le FleetPicker)
    const handleFleetDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
        // On ne réagit qu'à NOS drags de flottes (le types n'est lisible qu'en dragover)
        if (!e.dataTransfer.types.includes('application/x-fleet-num')) return;
        e.preventDefault(); // autorise le drop
        e.dataTransfer.dropEffect = 'move';
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) onFleetDragOver?.(cell);
    }, [cellAt, onFleetDragOver]);

    const handleFleetDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
        const raw = e.dataTransfer.getData('application/x-fleet-num');
        if (raw === '') return;
        e.preventDefault();
        const fleetNum = parseInt(raw, 10);
        if (Number.isNaN(fleetNum)) return;
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) onFleetDrop?.(fleetNum, cell);
    }, [cellAt, onFleetDrop]);

    const handleFleetDragLeave = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
        // dragleave déclenche aussi en traversant les enfants du conteneur ; on ne remonte
        // l'événement que si le pointeur sort VRAIMENT de la carte (relatedTarget à l'extérieur)
        const host = hostRef.current;
        const rt = e.relatedTarget as Node | null;
        if (host && rt && host.contains(rt)) return;
        onFleetDragLeave?.();
    }, [onFleetDragLeave]);

    return (<div className="canvas-host" ref={hostRef}>
            <canvas
                ref={canvasRef}
                style={{width: '100%', height: '100vh'}}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onDragOver={handleFleetDragOver}
                onDragLeave={handleFleetDragLeave}
                onDrop={handleFleetDrop}
            />
            {/* Surcouche transparente : contour de la case survolée */}
            <canvas
                ref={hoverCanvasRef}
                style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none'}}
            />
            {/* Récapitulatif de la case survolée */}
            <div
                ref={tooltipRef}
                style={{
                    position: 'absolute', display: 'none', pointerEvents: 'none', zIndex: 200,
                    background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 6,
                    padding: '5px 10px', fontSize: '0.8rem', color: '#f1f5f9', whiteSpace: 'normal', maxWidth: 'min(520px, calc(100vw - 24px))', overflowWrap: 'anywhere',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                }}
            />
        </div>);
}
