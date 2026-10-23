import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {useReport} from '../context/ReportContext';
import CanvasMap, {ZoneRect} from '../components/Map/CanvasMap';
import MiniMap from '../components/Map/MiniMap';
import InfoPanel from '../components/Map/InfoPanel';
import ZoneDialog from '../components/Map/ZoneDialog';
import MapHelp from '../components/Map/MapHelp';
import GotoDialog from '../components/Map/GotoDialog';
import {FleetPicker} from '../components/Map/FleetPicker';
import {isTypingTarget} from '../utils/keyboard';
import {wrapX, wrapY, posToString} from '../utils/position';
import {computePresence, PresenceData} from '../utils/presence';
import Modal from '../components/utils/Modal';
import {GlobalData, Strategie, XY, Zone} from '../types';
import {DropdownOption, MultiSelectDropdown} from "../components/multiselect";
import {loadDeplacements, saveDeplacements, clearDeplacements} from '../storage/deplacementOrdersStorage';
import {DeplacementEnAttente, DeplacementOrdre, DIRECTIVE_DEFAUT, OPTIONS_DIRECTIVES, PRECISION_DEFAUT, PRECISION_PLANETE_MAX, PRECISION_PLANETE_MIN, STRATEGIE_DEFAUT, schemaDeplacements} from '../utils/ordreDeplacement';
import {copierSchema} from '../utils/ordreSchema';
import {
  IconSystem,
  IconRadarSystem,
  IconRadarFleet,
  IconMiniMap,
  IconHelp,
  IconSliders,
  IconFleetMove,
  IconPlay,
  IconStop,
  IconAlert,
  IconClipboard,
  IconCheck,
  IconRefresh,
  IconClose,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
  IconChevronUp,
  IconArrowRight,
} from '../components/icons/Icons';

// Libellé du commandant visé par la directive « Attaque flottes cdt » (infobulle du menu)
const commandantViserLabel = (globalData: GlobalData | undefined, num: number): string =>
    num === PRECISION_DEFAUT ? 'Neutre' : (globalData?.commandants.find(c => c.numero === num)?.nom ?? `cdt ${num}`);

// Stratégies de combat (règle 5.4) : libellés des codes d'agressivité et de cible (codes du moteur)
const AGRESSIVITES_STRATEGIE = ['Pillage', 'Fuyard', 'Prudent', 'Normal', 'Combatif', 'Rage'];
const CIBLES_STRATEGIE = ['Aucune', 'Chasseur', 'Bombardier', 'Cargo'];
const strategieLabel = (s: Strategie): string =>
    `${s.nom} — agressivité ${AGRESSIVITES_STRATEGIE[s.agressivite] ?? s.agressivite}, cible ${CIBLES_STRATEGIE[s.cible] ?? s.cible}`;

// Libellé d'un commandant pour le focus de la couche présence (numéro + race quand connue)
const presenceFocusLabel = (globalData: GlobalData | undefined, num: number): string => {
    const nom = globalData?.commandants?.find(c => c.numero === num)?.nom;
    const race = globalData?.races?.find(r => r.id === globalData?.commandants?.find(c => c.numero === num)?.raceId)?.nom;
    const extra = [nom, race].filter(Boolean).join(' · ');
    return extra ? `#${num} · ${extra}` : `#${num}`;
};

// Durée d'affichage de chaque tour pendant la lecture automatique de l'historique (en secondes, modifiable)
const DEFAULT_PLAY_STEP_S = 2;
const MAX_PLAY_STEP_S = 60;

// Boutons du panneau des déplacements
const styleBoutonDeplacement: React.CSSProperties = {
    backgroundColor: '#262c36',
    color: '#e2e8f0',
    border: '1px solid #475569',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontWeight: 500,
    transition: 'background-color 0.15s, border-color 0.15s',
};

export default function Carte() {
  const { rapport, global, cellSize, setCellSize, center, setCenter, addDetectedSystemsFromText, allTags, selectedTags, setSelectedTags, zones, zoneLabels, hiddenZoneLabels, setHiddenZoneLabels, tours, selectTour, importCount } = useReport();
  const [zoneDialogRect, setZoneDialogRect] = useState<ZoneRect | undefined>(undefined);
  const [zonePreview, setZonePreview] = useState<Omit<Zone, 'id'> | undefined>(undefined);
  const closeZoneDialog = useCallback(() => {
    setZoneDialogRect(undefined);
    setZonePreview(undefined); // validée ou annulée, l'aperçu disparaît
  }, []);
  const [selected, setSelected] = useState<XY | undefined>(undefined);
  // Case mise en surbrillance sur la carte quand on survole une ligne de flotte du panneau info
  const [hoverFleetPos, setHoverFleetPos] = useState<XY | undefined>(undefined);
  const [showFleetsFor, setShowFleetsFor] = useState<XY | undefined>(undefined);
  const [showGoto, setShowGoto] = useState(false);
  const [selectedOwners, setSelectedOwners] = useState<(number)[]>(() => {
    const saved = localStorage.getItem('carte_selected_owners');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSystems, setShowSystems] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_show_systems');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showCombatBadges, setShowCombatBadges] = useState(() => {
    const saved = localStorage.getItem('carte_show_combat_badges');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showOwnerBadges, setShowOwnerBadges] = useState(() => {
    const saved = localStorage.getItem('carte_show_owner_badges');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showFleetBadges, setShowFleetBadges] = useState(() => {
    const saved = localStorage.getItem('carte_show_fleet_badges');
    return saved !== null ? JSON.parse(saved) : true;
  });
  // Portées radar : désactivées par défaut (voile bleu sur la carte) ; à activer dans les Filtres si besoin
  const [showSystemRadar, setShowSystemRadar] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_show_system_radar');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showFleetRadar, setShowFleetRadar] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_show_fleet_radar');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showMiniMap, setShowMiniMap] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_show_minimap');
    return saved !== null ? JSON.parse(saved) : true;
  });
  // Couche « présence » (qui est où) : remplace l'ancienne case « Afficher influence », qui garde
  // son réglage (migré) pour que les utilisateurs aient la couche activée par défaut.
  const [presenceOn, setPresenceOn] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_presence_on');
    if (saved !== null) return JSON.parse(saved);
    const legacy = localStorage.getItem('carte_show_influence');
    return legacy !== null ? JSON.parse(legacy) : true;
  });
  const [presenceMode, setPresenceMode] = useState<'presence' | 'voronoi'>(() => {
    const saved = localStorage.getItem('carte_presence_mode');
    return saved === 'voronoi' ? 'voronoi' : 'presence';
  });
  const [presenceDecay, setPresenceDecay] = useState<number>(() => {
    const saved = localStorage.getItem('carte_presence_decay');
    return saved !== null ? Math.max(4, Math.min(20, Number(JSON.parse(saved)) || 10)) : 10;
  });
  const [presenceFocus, setPresenceFocus] = useState<number | null>(() => {
    const saved = localStorage.getItem('carte_presence_focus');
    return saved !== null ? (JSON.parse(saved) === null ? null : Number(JSON.parse(saved))) : null;
  });
  const [presenceMinimapSectors, setPresenceMinimapSectors] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_presence_minimap_sectors');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showSectors, setShowSectors] = useState(() => {
    const saved = localStorage.getItem('carte_show_sectors');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showGlobalSystems, setShowGlobalSystems] = useState(() => {
    const saved = localStorage.getItem('carte_show_global_systems');
    return saved !== null ? JSON.parse(saved) : true;
  });
  useEffect(() => {
    localStorage.setItem('carte_show_global_systems', JSON.stringify(showGlobalSystems));
  }, [showGlobalSystems]);
  const [showZones, setShowZones] = useState(() => {
    const saved = localStorage.getItem('carte_show_zones');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [influenceOpacity, setInfluenceOpacity] = useState(() => {
    const saved = localStorage.getItem('carte_influence_opacity');
    return saved !== null ? JSON.parse(saved) : 0.18;
  });
  const [colorMode, setColorMode] = useState<'status' | 'race' | 'player'>(() => {
    const saved = localStorage.getItem('carte_color_mode');
    return saved !== null ? (saved as 'status' | 'race' | 'player') : 'status';
  });
  const [showStabilityZones, setShowStabilityZones] = useState(() => {
    const saved = localStorage.getItem('carte_show_stability_zones');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [stabilitySystemPos, setStabilitySystemPos] = useState<string | undefined>(() => {
    const saved = localStorage.getItem('carte_stability_system_pos');
    return saved !== null ? saved : undefined;
  });
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  // ---- Couche « présence » : calculée sur TOUTE la galaxie, une fois par rapport/réglage ----
  const playerId = rapport?.joueur?.numero ?? 0;
  const presence = useMemo<PresenceData | null>(() => {
    if (!rapport || !presenceOn) return null;
    return computePresence(rapport, global, playerId, {
      decayTurns: presenceDecay,
      focusPlayer: presenceFocus ?? undefined,
    });
    // BOUNDS est mutée in place lors des chargements, toujours accompagnée d'un nouvel objet rapport
    // (voir ReportContext) : la dépendance `rapport` suffit à re-calculer.
  }, [rapport, global, playerId, presenceOn, presenceDecay, presenceFocus]);

  // Commandants proposés pour le focus : tous ceux observés sur un système ou une flotte
  const presenceFocusOptions = useMemo(() => {
    const ids = new Set<number>();
    (rapport?.systemesJoueur || []).forEach(s => (s.proprietaires || []).forEach(o => { if (o !== 0) ids.add(o); }));
    (rapport?.systemesDetectes || []).forEach(s => (s.proprietaires || []).forEach(o => { if (o !== 0) ids.add(o); }));
    (rapport?.flottesDetectees || []).forEach(f => { if (f.proprio > 0) ids.add(f.proprio); });
    return Array.from(ids).sort((a, b) => a - b);
  }, [rapport]);

  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_filters_expanded');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [infoPanelCollapsed, setInfoPanelCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('carte_info_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('carte_info_collapsed', JSON.stringify(infoPanelCollapsed));
  }, [infoPanelCollapsed]);

  useEffect(() => {
    localStorage.setItem('carte_filters_expanded', JSON.stringify(filtersExpanded));
  }, [filtersExpanded]);

  useEffect(() => {
    localStorage.setItem('carte_show_systems', JSON.stringify(showSystems));
  }, [showSystems]);

  useEffect(() => {
    localStorage.setItem('carte_selected_owners', JSON.stringify(selectedOwners));
  }, [selectedOwners]);

  useEffect(() => {
    localStorage.setItem('carte_show_combat_badges', JSON.stringify(showCombatBadges));
  }, [showCombatBadges]);

  useEffect(() => {
    localStorage.setItem('carte_show_owner_badges', JSON.stringify(showOwnerBadges));
  }, [showOwnerBadges]);

  useEffect(() => {
    localStorage.setItem('carte_show_fleet_badges', JSON.stringify(showFleetBadges));
  }, [showFleetBadges]);

  useEffect(() => {
    localStorage.setItem('carte_show_system_radar', JSON.stringify(showSystemRadar));
  }, [showSystemRadar]);

  useEffect(() => {
    localStorage.setItem('carte_show_fleet_radar', JSON.stringify(showFleetRadar));
  }, [showFleetRadar]);

  useEffect(() => {
    localStorage.setItem('carte_show_minimap', JSON.stringify(showMiniMap));
  }, [showMiniMap]);

  useEffect(() => {
    localStorage.setItem('carte_presence_on', JSON.stringify(presenceOn));
  }, [presenceOn]);
  useEffect(() => {
    localStorage.setItem('carte_presence_mode', JSON.stringify(presenceMode));
  }, [presenceMode]);
  useEffect(() => {
    localStorage.setItem('carte_presence_decay', JSON.stringify(presenceDecay));
  }, [presenceDecay]);
  useEffect(() => {
    localStorage.setItem('carte_presence_focus', JSON.stringify(presenceFocus));
  }, [presenceFocus]);
  useEffect(() => {
    localStorage.setItem('carte_presence_minimap_sectors', JSON.stringify(presenceMinimapSectors));
  }, [presenceMinimapSectors]);

  useEffect(() => {
    localStorage.setItem('carte_show_sectors', JSON.stringify(showSectors));
  }, [showSectors]);

  useEffect(() => {
    localStorage.setItem('carte_show_zones', JSON.stringify(showZones));
  }, [showZones]);

  useEffect(() => {
    localStorage.setItem('carte_influence_opacity', JSON.stringify(influenceOpacity));
  }, [influenceOpacity]);

  useEffect(() => {
    localStorage.setItem('carte_color_mode', colorMode);
  }, [colorMode]);

  useEffect(() => {
    localStorage.setItem('carte_show_stability_zones', JSON.stringify(showStabilityZones));
  }, [showStabilityZones]);

  useEffect(() => {
    if (stabilitySystemPos) {
      localStorage.setItem('carte_stability_system_pos', stabilitySystemPos);
    } else {
      localStorage.removeItem('carte_stability_system_pos');
    }
  }, [stabilitySystemPos]);

  useEffect(() => {
    if (!stabilitySystemPos && rapport?.joueur?.capitale) {
      setStabilitySystemPos(`${rapport.joueur.capitale.x}_${rapport.joueur.capitale.y}`);
    }
  }, [rapport, stabilitySystemPos]);

  const noRapportMessage = !rapport ? (
    <div className="no-rapport-hint" style={{ padding: '6px 14px', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', borderBottom: '1px solid #f59e0b', fontSize: '0.85rem' }}>
      Aucun rapport chargé. Seuls les systèmes connus de la galaxie sont affichés.
    </div>
  ) : null;

  const selectedOwnersOption: DropdownOption<number>[] = [];
    (global?.commandants || [])
        .filter(c => typeof c.numero === 'number')
        .forEach(c => {
            selectedOwnersOption.push({
                value: (c.numero || 0),
                label: (c.nom || `#${c.numero}`) + ` (${c.numero})`,
                className: 'race' + c.raceId
            });
        })

    const selectedTagsOption: DropdownOption<string>[] = allTags.map(tag => ({ value: tag, label: tag }));

  // Tours stockés (plus le tour affiché, au cas où le stockage aurait échoué), du plus récent au plus ancien
  const tourOptions = useMemo(
    () => Array.from(new Set([...tours, ...(rapport ? [rapport.tour] : [])])).sort((a, b) => b - a),
    [tours, rapport]
  );
  const latestTour = tourOptions[0];
  const viewingPastTour = rapport !== undefined && rapport.tour !== latestTour;

  // Lecture automatique de l'historique : du premier tour au dernier, un tour toutes les playStepS secondes
  const [playing, setPlaying] = useState(false);
  const [playStepS, setPlayStepS] = useState<number>(() => {
    const saved = Number(localStorage.getItem('carte_play_step_s'));
    return saved >= 1 && saved <= MAX_PLAY_STEP_S ? saved : DEFAULT_PLAY_STEP_S;
  });
  useEffect(() => {
    localStorage.setItem('carte_play_step_s', String(playStepS));
  }, [playStepS]);
  const playStepMs = playStepS * 1000;
  const [stepStart, setStepStart] = useState(0);
  const [now, setNow] = useState(0);
  const toursAsc = useMemo(() => [...tourOptions].reverse(), [tourOptions]);

  const startPlay = () => {
    if (toursAsc.length < 2) return;
    setPlaying(true);
    selectTour(toursAsc[0]);
  };
  const stopPlay = () => setPlaying(false);

  // À chaque tour affiché pendant la lecture : on attend playStepS puis on passe au suivant (arrêt après le dernier)
  useEffect(() => {
    if (!playing || !rapport) return;
    setStepStart(Date.now());
    setNow(Date.now());
    const timer = setTimeout(() => {
      const next = toursAsc.find(t => t > rapport.tour);
      if (next === undefined) setPlaying(false);
      else selectTour(next);
    }, playStepMs);
    const ticker = setInterval(() => setNow(Date.now()), 200); // pour le décompte affiché
    return () => { clearTimeout(timer); clearInterval(ticker); };
  }, [playing, rapport, toursAsc, selectTour, playStepMs]);

  const remainingMs = playing ? Math.max(0, playStepMs - (now - stepStart)) : 0;

  // Raccourci : Maj + flèche déplace la case sélectionnée d'une case, Ctrl + Maj + flèche par pas de 5
  // (depuis le centre si aucune case n'est sélectionnée)
  useEffect(() => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    function onKey(e: KeyboardEvent) {
      if (!e.shiftKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
      const move = moves[e.key];
      const from = selected ?? center;
      if (!move || !from) return;
      e.preventDefault();
      const step = e.ctrlKey ? 5 : 1;
      setSelected({ x: wrapX(from.x + move[0] * step), y: wrapY(from.y + move[1] * step) });
      setShowFleetsFor(undefined); // comme un clic simple
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, center]);

  // Raccourcis : Alt + G (aller à une case), Alt + Y (déplacements), Alt + O (filtres), Alt + I (panneau info), Alt + ← / → (tour précédent / suivant de l'historique)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.code === 'KeyG' || e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGoto(true);
      } else if (e.code === 'KeyI' || e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInfoPanelCollapsed(v => !v);
      } else if (e.code === 'KeyY' || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setDeplacementsExpanded(v => !v);
      } else if (e.code === 'KeyO' || e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setFiltersExpanded(v => !v);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); // sinon le navigateur revient à la page précédente / suivante
        setPlaying(false); // une navigation manuelle interrompt la lecture
        const idx = tourOptions.indexOf(rapport?.tour ?? -1);
        if (idx < 0) return;
        // la liste va du plus récent au plus ancien : droite = plus récent, gauche = plus ancien
        const next = tourOptions[e.key === 'ArrowRight' ? idx - 1 : idx + 1];
        if (next !== undefined) selectTour(next);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOptions, rapport?.tour, selectTour]);

  // ---- Déplacements de flottes : schéma d'ordres (glisser-déposer sur la carte) ----
  // Les déplacements sont rattachés au tour du rapport affiché, comme la planification des revenus
  const tour = rapport?.tour;
  const [deplacements, setDeplacements] = useState<Record<number, DeplacementEnAttente>>(() => (tour !== undefined ? loadDeplacements(tour) : {}));
  // Panneau des déplacements : replié par défaut (comme Filtres), s'ouvre tout seul au premier dépos
  const [deplacementsExpanded, setDeplacementsExpanded] = useState(false);
  // Le sélecteur de flotte, ancré sur le mousedown qui l'a ouvert (coordonnées client)
  const [picker, setPicker] = useState<{ cell: XY; anchor: { x: number; y: number } } | null>(null);
  // Flotte en cours de glisser-déposer ; le curseur est suivi pendant le drag pour le rendu en direct
  const [dragState, setDragState] = useState<{ num: number; from: XY; vitesse: number } | null>(null);
  const [dragCursor, setDragCursor] = useState<XY | null>(null);
  // Feedback de la copie du schéma : le libellé du bouton revient à la normale au bout de 2 s
  const [copieSchema, setCopieSchema] = useState<'ok' | 'ko' | null>(null);
  const copieTimerRef = useRef<number | undefined>(undefined);

  // Fin d'un geste de déplacement (dépos, annulation, changement de tour, mousedown sur la carte) :
  // sélecteur et suivi de drag remis à zéro d'un seul point de passage
  const resetFleetDrag = useCallback(() => {
    setPicker(null);
    setDragState(null);
    setDragCursor(null);
  }, []);
  // Fermeture du sélecteur seule (bouton ×, Échap) : sans le suivi de drag
  const fermerPicker = useCallback(() => setPicker(null), []);

  // Nouveau rapport ou changement de tour : recharger les déplacements stockés pour le tour affiché
  // (importCount : un import d'un tour plus ancien ne change pas le rapport affiché mais vide le
  // stockage — sans ce compteur, les déplacements en mémoire ressusciteraient à la sauvegarde)
  useEffect(() => {
    setDeplacements(tour !== undefined ? loadDeplacements(tour) : {});
    resetFleetDrag();
  }, [tour, rapport, importCount, resetFleetDrag]);

  // Sauvegarde à chaque modification
  useEffect(() => {
    if (tour !== undefined) saveDeplacements(tour, deplacements);
  }, [deplacements, tour]);

  // Le mousedown ouvre le sélecteur ; le CanvasMap appelant « tout mousedown » AVANT « mousedown sur
  // case de flotte » dans la même tâche, les deux setPicker sont groupés et l'ouverture l'emporte —
  // c'est le mousedown *suivant* qui referme le sélecteur
  const onFleetCellMouseDown = useCallback((cell: XY, clientX: number, clientY: number) => {
    setPicker({ cell, anchor: { x: clientX, y: clientY } });
  }, []);
  // Tout mousedown sur la carte referme le sélecteur ouvert et nettoie un suivi de drag orphelin
  // (drag annulé par Échap sans relâchement de bouton)
  const onAnyCanvasMouseDown = useCallback(() => {
    resetFleetDrag();
  }, [resetFleetDrag]);
  // Un pan démarre sur la case : le geste de sélection est annulé (pan et zone Alt inchangés)
  const onFleetCellGestureAbort = useCallback(() => {
    resetFleetDrag();
  }, [resetFleetDrag]);
  const onFleetDragOver = useCallback((cell: XY) => {
    // ~60 Hz pendant le drag : on ne re-render la carte que si la case change
    setDragCursor(prev => (prev && prev.x === cell.x && prev.y === cell.y ? prev : cell));
  }, []);
  // Le drag quitte la carte : on masque le tracé mais on CONSERVE l'identité (num) pour le
  // restaurer au prochain dragover (sinon le tracé ne revient plus, le num étant illisible en dragover)
  const onFleetDragLeave = useCallback(() => {
    setDragCursor(null);
  }, []);
  // Le drag d'une ligne du sélecteur démarre : on suit la flotte. Le sélecteur reste monté PENDANT
  // le drag — le démonter dans le dragstart ferait annuler le drag par le navigateur (la source du
  // drag disparaît de l'DOM avant que le drag ne démarre réellement) ; il se ferme à la fin du drag
  const onSelectFleet = useCallback((fleetNum: number) => {
    const flotte = rapport?.flottesJoueur.find(f => f.num === fleetNum);
    if (!flotte) return;
    setDragState({ num: flotte.num, from: flotte.pos, vitesse: flotte.vitesse });
    setDragCursor(null);
  }, [rapport]);
  // Fin du drag (dépos ou annulation) : on arrête le suivi et on referme le sélecteur
  // (la ligne du sélecteur restant montée, son dragend nous parvient bien)
  const onDragEnd = useCallback(() => {
    resetFleetDrag();
  }, [resetFleetDrag]);
  // Filet de sécurité anti-tracé-figé pour un drag annulé (Échap sans relâchement de bouton,
  // relâchement hors fenêtre, dépôt refusé) : on guette le relâchement global du bouton GAUCHE et
  // un dragend éventuel au niveau document
  useEffect(() => {
    if (!dragState) return;
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setDragState(null);
      setDragCursor(null);
    };
    const onDragEnd = () => {
      setDragState(null);
      setDragCursor(null);
    };
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('dragend', onDragEnd);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('dragend', onDragEnd);
    };
  }, [dragState]);
  // Dépos : sur la case d'origine de la flotte = annulation ; sinon création/remplacement de son déplacement
  // (un seul déplacement par flotte, le re-drag remplace ; un dépos hors de portée reste autorisé, marqué en rouge)
  const onFleetDrop = useCallback((fleetNum: number, cell: XY) => {
    const origine = rapport?.flottesJoueur.find(f => f.num === fleetNum)?.pos;
    // Flotte absente du rapport affiché (changement de tour pendant le drag) : on ignore le
    // dépos plutôt que de stocker un déplacement orphelin
    if (!origine) {
      resetFleetDrag();
      return;
    }
    if (cell.x === origine.x && cell.y === origine.y) {
      setDeplacements(d => {
        const reste = { ...d };
        delete reste[fleetNum];
        return reste;
      });
    } else {
      // directive/stratégie par défaut : la directive (et son paramètre n°) sont modifiables dans le panneau
      setDeplacements(d => ({ ...d, [fleetNum]: { to: cell, directive: DIRECTIVE_DEFAUT, strategy: STRATEGIE_DEFAUT } }));
      setDeplacementsExpanded(true); // on ouvre le panneau pour montrer le résultat du dépos
    }
    resetFleetDrag();
  }, [rapport, resetFleetDrag]);
  // Alternative clavier au glisser-déposer : le bouton « → » de « Mes flottes » (panneau info)
  // déplace la flotte vers la case sélectionnée (même règle qu'un dépos : case d'origine = annulation)
  const onMoveFleetToSelected = useCallback((fleetNum: number) => {
    const flotte = rapport?.flottesJoueur.find(f => f.num === fleetNum);
    if (!flotte || !selected) return;
    if (flotte.pos.x === selected.x && flotte.pos.y === selected.y) return;
    setDeplacements(d => ({ ...d, [fleetNum]: { to: selected, directive: DIRECTIVE_DEFAUT, strategy: STRATEGIE_DEFAUT } }));
    setDeplacementsExpanded(true);
  }, [rapport, selected]);

  // Schéma d'ordres : un ordre par déplacement dont la flotte est encore dans le rapport
  // (une flotte introuvable, ex. tour différent, est ignorée ici et en ligne repliée du panneau)
  const ordresDeplacement = useMemo<DeplacementOrdre[]>(() => {
    const liste: DeplacementOrdre[] = [];
    for (const [num, deplacement] of Object.entries(deplacements)) {
      const flotte = rapport?.flottesJoueur.find(f => f.num === Number(num));
      if (flotte) liste.push({
        fleetNum: flotte.num,
        to: deplacement.to,
        directive: deplacement.directive,
        strategy: deplacement.strategy,
        precision: deplacement.precision,
      });
    }
    return liste;
  }, [deplacements, rapport]);
  // Cibles seules (XY) pour le rendu de la carte (flèches/anneaux) : le reste (directive/stratégie)
  // ne concerne que le schéma d'ordres
  const ciblesDeplacements = useMemo<Record<number, XY>>(() => {
    const cibles: Record<number, XY> = {};
    for (const [num, deplacement] of Object.entries(deplacements)) cibles[Number(num)] = deplacement.to;
    return cibles;
  }, [deplacements]);
  // Nom du système par position (priorité : systèmes du joueur > détectés > carte galactique,
  // premier trouvé) : les lignes du panneau Déplacements affichent le nom quand la case en porte un
  const nomSystemeByPos = useMemo(() => {
    const map = new Map<string, string>();
    const add = (s: { nom?: string; pos?: { x: number; y: number } } | null | undefined) => {
      if (!s || !s.pos || !s.nom) return;
      const key = `${s.pos.x}_${s.pos.y}`;
      if (!map.has(key)) map.set(key, s.nom);
    };
    (rapport?.systemesJoueur || []).forEach(add);
    (rapport?.systemesDetectes || []).forEach(add);
    (global?.systemes || []).forEach(add);
    return map;
  }, [rapport, global]);

  const copierLeSchema = async () => {
    const ok = await copierSchema(schemaDeplacements(ordresDeplacement));
    setCopieSchema(ok ? 'ok' : 'ko');
    window.clearTimeout(copieTimerRef.current);
    copieTimerRef.current = window.setTimeout(() => setCopieSchema(null), 2000);
  };
  useEffect(() => () => window.clearTimeout(copieTimerRef.current), []);

  const reinitialiserDeplacements = () => {
    setDeplacements({});
    if (tour !== undefined) clearDeplacements(tour);
    setDeplacementsExpanded(false);
  };
  // Modification de la directive (ou de son paramètre n°) ou de la stratégie d'un déplacement existant (menus du panneau)
  const majDeplacement = useCallback((num: number, champ: { directive?: number; precision?: number; strategy?: string }) => {
    setDeplacements(d => {
      const actuel = d[num];
      if (!actuel) return d;
      return { ...d, [num]: { ...actuel, ...champ } };
    });
  }, []);

  const nbDeplacements = Object.keys(deplacements).length;

  // Entrées de légende de la couche présence, insérées dans la légende du mode de couleur actif
  const presenceLegendItems = presenceOn && presenceMode === 'presence' ? (
      <>
          <span className="map-legend-item" title="Teinte = densité des systèmes connus du propriétaire (plus c'est dense, plus c'est opaque)">
              <span className="map-legend-dot" style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.85), rgba(56, 189, 248, 0.1))' }} /> présence
          </span>
          <span className="map-legend-item" title="Système de la carte galactique jamais observé : il existe, mais on ne sait pas à qui">
              <span className="map-legend-dot" style={{ background: 'repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.9) 0, rgba(148, 163, 184, 0.9) 1px, transparent 1px, transparent 3px)', border: '1px solid #475569', borderRadius: 2 }} /> inconnu
          </span>
      </>
  ) : null;

  return (
    // Colonnes gérées par App.css (.carte-wrap / .carte-wrap.info-collapsed) : une seule source de vérité
    <div className={`carte-wrap ${infoPanelCollapsed ? 'info-collapsed' : ''}`}>
      <div className="carte-toolbar">
        {/* Vue : taille des cases + position */}
        <div className="carte-toolbar-group">
          <span className="carte-toolbar-label">Taille des cases</span>
          <input
            type="range"
            min={16}
            max={64}
            step={2}
            value={cellSize}
            onChange={(e) => setCellSize(parseInt(e.target.value, 10))}
          />
          <span className="carte-toolbar-value">{cellSize}px</span>
        </div>
        <div
          className="carte-toolbar-group carte-goto"
          onClick={() => setShowGoto(true)}
          title="Aller à une case (Alt + G)"
        >
          Centre : {center ? `${center.x}-${center.y}` : '—'}
        </div>
        {!global && (
          <div className="carte-toolbar-status">Données globales en chargement…</div>
        )}
        {/* Filtres rapides : icônes modernes et accessibles */}
        <div className="carte-toolbar-group" role="group" aria-label="Filtres rapides">
          <button
            type="button"
            className={showSystems ? 'carte-icon-btn active' : 'carte-icon-btn'}
            title="Afficher / masquer les systèmes (✦)"
            aria-label="Afficher / masquer les systèmes"
            onClick={() => setShowSystems(v => !v)}
          >
            <IconSystem size={15} />
          </button>
          <button
            type="button"
            className={showSystemRadar ? 'carte-icon-btn active' : 'carte-icon-btn'}
            title="Portée radar des systèmes (◎)"
            aria-label="Portée radar des systèmes"
            onClick={() => setShowSystemRadar(v => !v)}
          >
            <IconRadarSystem size={15} />
          </button>
          <button
            type="button"
            className={showFleetRadar ? 'carte-icon-btn active' : 'carte-icon-btn'}
            title="Portée radar des flottes (◉)"
            aria-label="Portée radar des flottes"
            onClick={() => setShowFleetRadar(v => !v)}
          >
            <IconRadarFleet size={15} />
          </button>
          <button
            type="button"
            className={showMiniMap ? 'carte-icon-btn active' : 'carte-icon-btn'}
            title="Afficher / masquer la mini-carte (▣)"
            aria-label="Afficher / masquer la mini-carte"
            onClick={() => setShowMiniMap(v => !v)}
          >
            <IconMiniMap size={15} />
          </button>
          <button
            type="button"
            className={deplacementsExpanded ? 'carte-icon-btn active' : 'carte-icon-btn'}
            title={`Déplacements de flottes (${nbDeplacements}) (⇢) — Alt+Y`}
            aria-label="Déplacements de flottes"
            onClick={() => setDeplacementsExpanded(v => !v)}
          >
            <IconFleetMove size={15} />
          </button>
          <button
            type="button"
            className={filtersExpanded ? 'carte-icon-btn active' : 'carte-icon-btn'}
            title="Filtres avancés (⚙) — Alt+O"
            aria-label="Filtres avancés"
            onClick={() => setFiltersExpanded(v => !v)}
          >
            <IconSliders size={15} />
          </button>
          <MapHelp renderTrigger={open => (
            <button
              type="button"
              className="carte-icon-btn"
              title="Aide et raccourcis (?)"
              aria-label="Aide et raccourcis"
              onClick={open}
            >
              <IconHelp size={15} />
            </button>
          )} />
        </div>
        {/* Historique : tour affiché + lecture */}
        {tourOptions.length > 0 && (
          <div className="carte-toolbar-group">
            <label className="carte-toolbar-label" title="Afficher la carte telle qu'elle était à ce tour">
              Tour :
              <select
                value={rapport?.tour ?? ''}
                onChange={(e) => { stopPlay(); selectTour(Number(e.target.value)); }}
                className="carte-select"
                style={{ border: viewingPastTour ? '2px solid #f59e0b' : undefined }}
                title={viewingPastTour ? 'Tour passé : les données ne sont pas celles du dernier tour' : undefined}
              >
                {tourOptions.map(t => (
                  <option key={t} value={t}>{t === latestTour ? `${t} (dernier)` : t}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {tourOptions.length > 1 && (
          <div className="carte-toolbar-group">
            <button
              type="button"
              className="carte-btn"
              onClick={playing ? stopPlay : startPlay}
              title={playing ? 'Arrêter la lecture' : `Rejouer tous les tours depuis le premier (un tour toutes les ${playStepS} s, zones masquées)`}
              aria-label={playing ? 'Arrêter la lecture' : 'Rejouer les tours'}
            >
              {playing ? <IconStop size={12} /> : <IconPlay size={12} />}
            </button>
            <label title="Durée d'affichage de chaque tour pendant la lecture" className="carte-toolbar-label">
              <input
                type="number"
                min={1}
                max={MAX_PLAY_STEP_S}
                value={playStepS}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1 && v <= MAX_PLAY_STEP_S) setPlayStepS(v);
                }}
                className="carte-input-num"
              />
              s
            </label>
            {playing && (
              // Temps restant avant le tour suivant
              <div title="Temps avant le tour suivant" className="carte-toolbar-label" style={{ gap: 4 }}>
                <div style={{ width: 50, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(remainingMs / playStepMs) * 100}%`, height: '100%', background: '#38bdf8', transition: 'width 0.2s linear' }} />
                </div>
                {Math.ceil(remainingMs / 1000)} s
              </div>
            )}
          </div>
        )}

        {/* Actions : import et panneau info */}
        <div className="carte-toolbar-group" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className={infoPanelCollapsed ? 'carte-btn' : 'carte-btn active'}
            onClick={() => setInfoPanelCollapsed(v => !v)}
            title={infoPanelCollapsed ? "Afficher le panneau d'informations (Alt + I)" : "Masquer le panneau d'informations (Alt + I)"}
            aria-label="Afficher ou masquer le panneau d'informations"
          >
            {infoPanelCollapsed ? <IconChevronLeft size={13} /> : <IconChevronRight size={13} />}
            <span className="hideOnMobile">{infoPanelCollapsed ? 'Détails' : 'Masquer détails'}</span>
          </button>
          <button onClick={() => setShowPaste(true)} className="carte-btn">
            Importer systèmes
          </button>
        </div>
      </div>
      {noRapportMessage}

      <div className="carte-canvas-area">
        {!global && (
          <div style={{ padding: 20, color: '#aaa' }}>
            Chargement des données de la galaxie...
          </div>
        )}
        <div style={{ position: 'relative', width: '100%', height: '100%', display: global ? 'block' : 'none' }}>
          <CanvasMap
            onCreateZone={setZoneDialogRect}
            previewZone={zonePreview}
            onSelect={(xy, ctrl) => {
              setSelected(xy);
              if (ctrl) {
                setShowFleetsFor(xy);
              } else {
                setShowFleetsFor(undefined);
              }
            }}
            selected={selected}
            highlightPos={hoverFleetPos}
            showFleetsFor={showFleetsFor}
            showSystems={showSystems}
            showGlobalSystems={showGlobalSystems}
            selectedOwners={selectedOwners}
            showCombatBadges={showCombatBadges}
            showOwnerBadges={showOwnerBadges}
            showFleetBadges={showFleetBadges}
            showSystemRadar={showSystemRadar}
            showFleetRadar={showFleetRadar}
            showSectors={showSectors}
            showZones={showZones && !playing}
            showInfluence={presenceOn}
            presenceMode={presenceMode}
            presenceData={presence}
            influenceOpacity={influenceOpacity}
            colorMode={colorMode}
            showStabilityZones={showStabilityZones}
            stabilitySystemPos={stabilitySystemPos}
            deplacements={ciblesDeplacements}
            dragFleet={dragState && dragCursor ? { from: dragState.from, vitesse: dragState.vitesse, cursor: dragCursor } : null}
            onFleetCellMouseDown={onFleetCellMouseDown}
            onAnyCanvasMouseDown={onAnyCanvasMouseDown}
            onFleetCellGestureAbort={onFleetCellGestureAbort}
            onFleetDragOver={onFleetDragOver}
            onFleetDragLeave={onFleetDragLeave}
            onFleetDrop={onFleetDrop}
          />
          {/* Le ré-ouverture du panneau info se fait depuis la barre d'outils (« Détails » / Alt + I) :
              pas de bouton en double sur la carte */}
          {showMiniMap && (
            <MiniMap
              onCenter={(x, y) => setCenter({ x, y })}
              colorMode={colorMode}
              sectorData={presenceMinimapSectors ? presence : null}
              focusPlayer={presenceFocus}
            />
          )}
          {/* Légende des couleurs — la carte se suffit à elle-même au coup d'œil */}
          {colorMode === 'status' && (
            <div className="map-legend" title="Couleurs de possession des systèmes et des flottes">
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#10b981' }} /> moi</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#3b82f6' }} /> alliance</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#fde047' }} /> PNA</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#ef4444' }} /> ennemi</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#94a3b8' }} /> neutre</span>
              <span className="map-legend-item" title="Système avec une capacité de réparation (insigne « + » en haut-gauche de la case)"><span className="map-legend-dot" style={{ background: '#0f172a', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>+</span> réparation</span>
                {presenceLegendItems}
            </div>
          )}
          {colorMode === 'race' && (
            <div className="map-legend" title="Les couleurs représentent les races. L'insigne « + » indique un centre de réparation.">
              <span className="map-legend-item" title="Centre de réparation (insigne « + » en haut-gauche de la case)"><span className="map-legend-dot" style={{ background: '#0f172a', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>+</span> réparation</span>
                {presenceLegendItems}
            </div>
          )}
          {colorMode === 'player' && (
            <div className="map-legend" title="Les couleurs représentent les joueurs. L'insigne « + » indique un centre de réparation.">
              <span className="map-legend-item" title="Centre de réparation (insigne « + » en haut-gauche de la case)"><span className="map-legend-dot" style={{ background: '#0f172a', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>+</span> réparation</span>
                {presenceLegendItems}
            </div>
          )}
          {/* Filtres avancés : monté uniquement quand il est ouvert (⚙ de la barre d'outils) — pas
              d'onglet replié permanent ; la mini-carte occupe le bas à droite */}
          {filtersExpanded && (
          <div style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 290,
              backgroundColor: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #334155',
              borderRadius: 8,
              boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              // Le panneau ne dépasse pas la zone de la carte : l'en-tête reste accessible et le contenu défile
              maxHeight: 'calc(100% - 16px)'
          }}>
              <button
                  type="button"
                  aria-expanded
                  aria-label="Replier le panneau des filtres"
                  onClick={() => setFiltersExpanded(false)}
                  style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#1e2530',
                      border: 'none',
                      borderBottom: '1px solid #334155',
                      borderRadius: '8px 8px 0 0',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      color: '#f1f5f9',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      flexShrink: 0
                  }}
              >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconSliders size={15} color="#38bdf8" />
                    Filtres
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', color: '#94a3b8' }}>
                    <IconChevronDown size={15} />
                  </span>
              </button>

              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minHeight: 0 }}>
                      {/* Filtre multi-sélection des commandants */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.85em', color: '#94a3b8' }}>Afficher uniquement Commandants</span>
                          <MultiSelectDropdown
                              title=""
                              placeholder={"Choisir"}
                              options={selectedOwnersOption}
                              selectedValues={selectedOwners}
                              onChange={setSelectedOwners}
                          />
                      </div>

                      {/* Filtre par tags */}
                      {allTags.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ fontSize: '0.85em', color: '#94a3b8' }}>Tags</span>
                              <MultiSelectDropdown
                                  title="Tous"
                                  options={selectedTagsOption}
                                  selectedValues={selectedTags}
                                  onChange={setSelectedTags}
                              />
                          </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #334155', paddingTop: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showSystems}
                              onChange={(e) => setShowSystems(e.target.checked)}
                            />
                            Afficher systèmes
                          </label>
                          <label
                            title="Systèmes connus uniquement par les données publiques (data.xml), jamais détectés dans vos rapports"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, color: showSystems ? '#f1f5f9' : '#64748b', fontSize: '0.9em', cursor: showSystems ? 'pointer' : 'default', marginLeft: 16 }}
                          >
                            <input
                              type="checkbox"
                              disabled={!showSystems}
                              checked={showGlobalSystems}
                              onChange={(e) => setShowGlobalSystems(e.target.checked)}
                            />
                            Carte galactique
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showSectors}
                              onChange={(e) => setShowSectors(e.target.checked)}
                            />
                            Afficher secteurs
                          </label>
                           <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                             <input
                               type="checkbox"
                               checked={presenceOn}
                               onChange={(e) => setPresenceOn(e.target.checked)}
                             />
                             Présence (qui est où)
                           </label>

                            {presenceOn && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 20 }}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                            onClick={() => setPresenceMode('presence')}
                                            title="Densité des systèmes connus, avec cases inconnues explicites"
                                            style={{
                                                flex: 1,
                                                fontSize: '0.8rem',
                                                padding: '5px 4px',
                                                cursor: 'pointer',
                                                backgroundColor: presenceMode === 'presence' ? '#1e3a5f' : '#1e2530',
                                                color: presenceMode === 'presence' ? '#38bdf8' : '#94a3b8',
                                                border: presenceMode === 'presence' ? '1px solid #38bdf8' : '1px solid #334155',
                                                borderRadius: 4
                                            }}
                                        >
                                            Présence
                                        </button>
                                        <button
                                            onClick={() => setPresenceMode('voronoi')}
                                            title="Influence au sens classique : chaque case au propriétaire du système connu le plus proche"
                                            style={{
                                                flex: 1,
                                                fontSize: '0.8rem',
                                                padding: '5px 4px',
                                                cursor: 'pointer',
                                                backgroundColor: presenceMode === 'voronoi' ? '#1e3a5f' : '#1e2530',
                                                color: presenceMode === 'voronoi' ? '#38bdf8' : '#94a3b8',
                                                border: presenceMode === 'voronoi' ? '1px solid #38bdf8' : '1px solid #334155',
                                                borderRadius: 4
                                            }}
                                        >
                                            Voronoi
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8em', color: '#94a3b8' }}>Opacité ( défaut 18% )</span>
                                        <span style={{ fontSize: '0.8em', color: '#f1f5f9' }}>{Math.round(influenceOpacity * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0.05}
                                        max={0.5}
                                        step={0.01}
                                        value={influenceOpacity}
                                        onChange={(e) => setInfluenceOpacity(parseFloat(e.target.value))}
                                        style={{ width: '100%', cursor: 'pointer' }}
                                    />
                                    {presenceMode === 'presence' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8em', color: '#94a3b8' }}>Fraîcheur des détections</span>
                                                    <span style={{ fontSize: '0.8em', color: '#f1f5f9' }}>{presenceDecay} tours</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={4}
                                                    max={20}
                                                    step={1}
                                                    value={presenceDecay}
                                                    onChange={(e) => setPresenceDecay(parseInt(e.target.value, 10))}
                                                    style={{ width: '100%', cursor: 'pointer' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span style={{ fontSize: '0.8em', color: '#94a3b8' }}>Focus commandant</span>
                                                <select
                                                    value={presenceFocus ?? ''}
                                                    onChange={(e) => setPresenceFocus(e.target.value === '' ? null : Number(e.target.value))}
                                                    style={{
                                                        background: '#1e2530',
                                                        color: '#f1f5f9',
                                                        border: '1px solid #334155',
                                                        borderRadius: 4,
                                                        padding: '4px 6px',
                                                        fontSize: '0.85em'
                                                    }}
                                                >
                                                    <option value="">Tous les commandants</option>
                                                    {presenceFocusOptions.map(id => (
                                                        <option key={id} value={id}>{presenceFocusLabel(global, id)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.85em', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={presenceMinimapSectors}
                                                    onChange={(e) => setPresenceMinimapSectors(e.target.checked)}
                                                />
                                                Aperçu par secteurs (minimmap)
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showMiniMap}
                              onChange={(e) => setShowMiniMap(e.target.checked)}
                            />
                            Afficher minimap
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: '0.85em', color: '#94a3b8' }}>Mode de couleur</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                      onClick={() => setColorMode('status')}
                                      style={{
                                          flex: 1,
                                          fontSize: '0.8rem',
                                          padding: '5px 4px',
                                          cursor: 'pointer',
                                          backgroundColor: colorMode === 'status' ? '#1e3a5f' : '#1e2530',
                                          color: colorMode === 'status' ? '#38bdf8' : '#94a3b8',
                                          border: colorMode === 'status' ? '1px solid #38bdf8' : '1px solid #334155',
                                          borderRadius: 4
                                      }}
>
par diplo
                                   </button>
                                  <button
                                      onClick={() => setColorMode('race')}
                                      style={{
                                          flex: 1,
                                          fontSize: '0.8rem',
                                          padding: '5px 4px',
                                          cursor: 'pointer',
                                          backgroundColor: colorMode === 'race' ? '#1e3a5f' : '#1e2530',
                                          color: colorMode === 'race' ? '#38bdf8' : '#94a3b8',
                                          border: colorMode === 'race' ? '1px solid #38bdf8' : '1px solid #334155',
                                          borderRadius: 4
                                      }}
                                  >
                                      par race
                                  </button>
                                  <button
                                      onClick={() => setColorMode('player')}
                                      style={{
                                          flex: 1,
                                          fontSize: '0.8rem',
                                          padding: '5px 4px',
                                          cursor: 'pointer',
                                          backgroundColor: colorMode === 'player' ? '#1e3a5f' : '#1e2530',
                                          color: colorMode === 'player' ? '#38bdf8' : '#94a3b8',
                                          border: colorMode === 'player' ? '1px solid #38bdf8' : '1px solid #334155',
                                          borderRadius: 4
                                      }}
                                  >
                                      par joueur
                                  </button>
                              </div>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showCombatBadges}
                              onChange={(e) => setShowCombatBadges(e.target.checked)}
                            />
                            Badges combats
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showOwnerBadges}
                              onChange={(e) => setShowOwnerBadges(e.target.checked)}
                            />
                            Badges propriétaires
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showFleetBadges}
                              onChange={(e) => setShowFleetBadges(e.target.checked)}
                            />
                            Badges flottes
                          </label>
                      </div>

                      {zones.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #334155', paddingTop: 8 }}>
                              <span style={{ fontSize: '0.85em', color: '#94a3b8' }}>Zones manuelles (Alt + clic + glisser)</span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                                  <input
                                      type="checkbox"
                                      checked={showZones}
                                      onChange={(e) => setShowZones(e.target.checked)}
                                  />
                                  Afficher les zones ({zones.length})
                              </label>
                              {/* Choix par label, sans effet tant que toutes les zones sont masquées */}
                              {zoneLabels.map(label => (
                                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: showZones ? '#f1f5f9' : '#64748b', fontSize: '0.9em', cursor: showZones ? 'pointer' : 'default', marginLeft: 16 }}>
                                      <input
                                          type="checkbox"
                                          disabled={!showZones}
                                          checked={!hiddenZoneLabels.includes(label)}
                                          onChange={(e) => setHiddenZoneLabels(
                                              e.target.checked
                                                  ? hiddenZoneLabels.filter(l => l !== label)
                                                  : [...hiddenZoneLabels, label]
                                          )}
                                      />
                                      {label} ({zones.filter(z => z.label === label).length})
                                  </label>
                              ))}
                          </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #334155', paddingTop: 8 }}>
                          <span style={{ fontSize: '0.85em', color: '#94a3b8' }}>Portées Radar</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showSystemRadar}
                              onChange={(e) => setShowSystemRadar(e.target.checked)}
                            />
                            Systèmes
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showFleetRadar}
                              onChange={(e) => setShowFleetRadar(e.target.checked)}
                            />
                            Flottes
                          </label>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #334155', paddingTop: 8 }}>
                          <span style={{ fontSize: '0.85em', color: '#94a3b8' }}>Distance Capitale</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1f5f9', fontSize: '0.9em', cursor: 'pointer' }}>
                              <input
                                  type="checkbox"
                                  checked={showStabilityZones}
                                  onChange={(e) => setShowStabilityZones(e.target.checked)}
                              />
                              Afficher zones
                          </label>
                          <select
                              value={stabilitySystemPos || ''}
                              onChange={(e) => setStabilitySystemPos(e.target.value)}
                              style={{
                                  background: '#1e2530',
                                  color: '#f1f5f9',
                                  border: '1px solid #334155',
                                  borderRadius: 4,
                                  padding: '4px 6px',
                                  fontSize: '0.85em'
                              }}
                          >
                              {rapport?.joueur?.capitale && (
                                  <option value={`${rapport.joueur.capitale.x}_${rapport.joueur.capitale.y}`}>
                                      Capitale ({rapport.joueur.capitale.x}_{rapport.joueur.capitale.y})
                                  </option>
                              )}
                              {(rapport?.systemesJoueur || [])
                                  .filter(s => !(rapport?.joueur?.capitale && s.pos.x === rapport.joueur.capitale.x && s.pos.y === rapport.joueur.capitale.y))
                                  .map(s => (
                                      <option key={`${s.pos.x}_${s.pos.y}`} value={`${s.pos.x}_${s.pos.y}`}>
                                          {s.nom} ({s.pos.x}_{s.pos.y})
                                      </option>
                                  ))
                              }
                          </select>
                      </div>
                  </div>
          </div>
          )}

          {/* Déplacements en attente : tiroir de commandes tactique repliable au bas de la carte */}
          <div className={`carte-deplacements-drawer ${deplacementsExpanded ? 'expanded' : 'collapsed'}`}>
            <button
              type="button"
              aria-expanded={deplacementsExpanded}
              aria-label={deplacementsExpanded ? 'Replier le panneau des déplacements' : 'Déplier le panneau des déplacements'}
              onClick={() => setDeplacementsExpanded(!deplacementsExpanded)}
              style={{
                width: '100%',
                padding: '8px 14px',
                backgroundColor: '#1e2530',
                border: 'none',
                borderBottom: deplacementsExpanded ? '1px solid #334155' : 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                fontWeight: 'bold',
                fontSize: '0.875rem',
                color: '#f1f5f9',
                textAlign: 'left',
                fontFamily: 'inherit',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <IconFleetMove size={15} color="#38bdf8" />
                Déplacements ({nbDeplacements})
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: '#94a3b8' }}>
                {deplacementsExpanded ? <IconChevronDown size={15} /> : <IconChevronUp size={15} />}
              </span>
            </button>
            {deplacementsExpanded && (
              <>
                {/* minHeight:0 : sans ça la liste ne peut pas se rétrécir sous sa taille de contenu
                    et dépasse le tiroir (pied Copier/Réinitialiser inaccessible, pas de scroll) */}
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
                  {nbDeplacements === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '4px 0' }}>
                      Aucun déplacement — cliquez sur une case occupée par vos flottes, puis glissez une
                      flotte vers sa destination.
                    </div>
                  ) : (
                    Object.entries(deplacements)
                      .map(([num, deplacement]) => ({ num: Number(num), deplacement }))
                      .sort((a, b) => a.num - b.num)
                      .map(({ num, deplacement }) => {
                        const to = deplacement.to;
                        const flotte = rapport?.flottesJoueur.find(f => f.num === num);
                        const origine = flotte?.pos;
                        // La directive choisie (détermine le menu de paramètre n° éventuel)
                        const optionDirective = OPTIONS_DIRECTIVES.find(o => o.value === deplacement.directive);
                        // Stratégie de combat choisie (nom rapporté dans le rapport, ou absente = par défaut)
                        const strategieCourante = deplacement.strategy ? rapport?.strategies?.find(s => s.nom === deplacement.strategy) : undefined;
                        // Coordonnées d'une case : nom du système s'il existe (coordonnées au survol),
                        // sinon les coordonnées seules
                        const coordSpan = (pos: XY) => {
                          const nom = nomSystemeByPos.get(`${pos.x}_${pos.y}`);
                          return nom
                            ? <><span>{nom}</span> <span style={{ color: '#64748b' }}>({pos.x}-{pos.y})</span></>
                            : <span>{pos.x}-{pos.y}</span>;
                        };
                        // Un déplacement par LIGNE : nom (tronqué si long), origine → destination (distance en
                        // rouge si hors de portée), ⚠ compacte, menus directive/stratégie, ×
                        return (
                          <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                            <div
                              style={{ flex: 1, fontSize: '0.85rem', color: '#f1f5f9', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={flotte ? `#${String(num + 1).padStart(2, '0')} ${flotte.nom}` : `#Flotte ${num + 1} (absente du rapport affiché)`}
                            >
                              {flotte
                                ? <><span style={{ color: '#94a3b8', marginRight: 4 }}>#{String(num + 1).padStart(2, '0')}</span><strong>{flotte.nom}</strong></>
                                : <strong>Flotte #{num + 1}</strong>}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#cbd5e1', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                              {origine ? coordSpan(origine) : '—'}
                              <IconArrowRight size={11} style={{ margin: '0 4px', color: '#64748b' }} />
                              {coordSpan(to)}
                            </div>
                            {flotte?.direction && (
                              <span
                                title={`Déjà en route vers ${posToString(flotte.direction)} dans le rapport`}
                                style={{ display: 'inline-flex', alignItems: 'center', color: '#f59e0b', flexShrink: 0 }}
                              >
                                <IconAlert size={14} />
                              </span>
                            )}
                            {/* Menu de directive (sans libellé : évident en contexte) — codes réels du jeu, règle 4.4,
                                ordre de résolution, libellé complet en infobulle */}
                            <select
                              className="carte-select"
                              title="Directive (règle 4.4 — codes du jeu, ordre de résolution)"
                              value={deplacement.directive}
                              onChange={e => majDeplacement(num, { directive: Number(e.target.value) })}
                              style={{ minWidth: 66, maxWidth: 160, flexShrink: 0 }}
                            >
                              {OPTIONS_DIRECTIVES.map(o => (
                                <option key={o.value} value={o.value} title={o.full}>{o.label}</option>
                              ))}
                            </select>
                            {/* Les directives « … planète n° » visent une planète précise : menu de son numéro */}
                            {optionDirective?.precision === 'planete' && (
                              <select
                                className="carte-select"
                                title={`Planète visée (n°, 1-20) : ${(deplacement.precision ?? PRECISION_DEFAUT) + 1}`}
                                value={deplacement.precision ?? PRECISION_DEFAUT}
                                onChange={e => majDeplacement(num, { precision: Number(e.target.value) })}
                                style={{ width: 48, flexShrink: 0 }}
                              >
                                {Array.from({length: PRECISION_PLANETE_MAX - PRECISION_PLANETE_MIN + 1}, (_, n) => {
                                  const numero = PRECISION_PLANETE_MIN + n;
                                  return <option key={numero} value={numero}>{numero + 1}</option>;
                                })}
                              </select>
                            )}
                            {/* La directive « Attaque flottes cdt » vise un commandant précis : menu de son numéro */}
                            {optionDirective?.precision === 'commandant' && (
                              <select
                                className="carte-select"
                                title={`Commandant visé (0 = neutre) : ${commandantViserLabel(global, deplacement.precision ?? PRECISION_DEFAUT)}`}
                                value={deplacement.precision ?? PRECISION_DEFAUT}
                                onChange={e => majDeplacement(num, { precision: Number(e.target.value) })}
                                style={{ minWidth: 48, maxWidth: 160, flexShrink: 0 }}
                              >
                                <option value={PRECISION_DEFAUT} title="Neutre (le jeu le considère comme un commandant)">Neutre</option>
                                {(global?.commandants ?? []).filter(c => typeof c.numero === 'number').map(c => (
                                  <option key={c.numero} value={c.numero} title={`${c.nom ?? '?'} (#${c.numero})`}>{c.nom ?? `#${c.numero}`}</option>
                                ))}
                              </select>
                            )}
                            {/* Stratégie de combat (règle 5.4) : les stratégies du joueur rapportées dans le rapport
                                (le nom est l'identifiant transmis à la console ; vide = stratégie par défaut) */}
                            {rapport?.strategies && rapport.strategies.length > 0 && (
                              <select
                                className="carte-select"
                                title={`Stratégie de combat (règle 5.4) : ${strategieCourante
                                  ? strategieLabel(strategieCourante)
                                  : deplacement.strategy ? `${deplacement.strategy} (absente du rapport)` : 'Défaut (du jeu)'}`}
                                value={deplacement.strategy ?? ''}
                                onChange={e => majDeplacement(num, { strategy: e.target.value })}
                                style={{ minWidth: 48, maxWidth: 160, flexShrink: 0 }}
                              >
                                <option value="" title="Stratégie par défaut du jeu">Défaut</option>
                                {rapport.strategies.map(s => (
                                  <option
                                    key={s.nom}
                                    value={s.nom}
                                    title={s.nom.includes(':') || s.nom.includes('%#!%')
                                      ? 'Nom incompatible avec le schéma d\'ordres (contient « : » ou « %#!% »)'
                                      : strategieLabel(s)}
                                    disabled={s.nom.includes(':') || s.nom.includes('%#!%')}
                                  >
                                    {s.nom}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              title="Supprimer ce déplacement"
                              aria-label="Supprimer ce déplacement"
                              onClick={() => setDeplacements(d => {
                                const reste = { ...d };
                                delete reste[num];
                                return reste;
                              })}
                              style={{
                                flexShrink: 0,
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 4,
                                opacity: 0.8,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                            >
                              <IconClose size={14} />
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid #334155', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={copierLeSchema}
                    disabled={nbDeplacements === 0}
                    title="Copier le schéma des ordres de déplacement à coller dans la console d'ordres"
                    style={{
                      ...styleBoutonDeplacement,
                      flex: 1,
                      opacity: nbDeplacements === 0 ? 0.35 : 1,
                      cursor: nbDeplacements === 0 ? 'default' : 'pointer'
                    }}
                  >
{copieSchema === 'ok' ? (
                      <><IconCheck size={14} color="#4ade80" /> Schéma copié</>
                    ) : copieSchema === 'ko' ? (
                      <><IconAlert size={14} color="#f87171" /> Échec de la copie</>
                    ) : (
                      <><IconClipboard size={14} /> Copier le schéma</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={reinitialiserDeplacements}
                    disabled={nbDeplacements === 0}
                    title="Retirer tous les déplacements de ce tour"
                    style={{
                      ...styleBoutonDeplacement,
                      opacity: nbDeplacements === 0 ? 0.35 : 1,
                      cursor: nbDeplacements === 0 ? 'default' : 'pointer'
                    }}
                  >
                    <IconRefresh size={14} /> Tout réinitialiser
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sélecteur de flotte : s'ouvre au mousedown sur une case occupée par la/les flotte(s) du joueur */}
          {picker && rapport && (
            <FleetPicker
              anchor={picker.anchor}
              fleets={rapport.flottesJoueur
                .filter(f => f.pos.x === picker.cell.x && f.pos.y === picker.cell.y)
                .map(f => ({ fleet: f, deplacement: deplacements[f.num]?.to }))}
              dragNum={dragState?.num}
              onSelectFleet={onSelectFleet}
              onDragEnd={onDragEnd}
              onClose={fermerPicker}
            />
          )}
        </div>
      </div>

      {/* display:contents : le wrapper ne doit pas interposer de boîte entre la grille et .carte-info —
          sinon le panneau n'est plus l'item de la colonne info (perte de sa hauteur de ligne et
          de son scroll), et l'astuce « Aucun rapport chargé » se faufile dans la colonne info */}
      <div style={{ display: infoPanelCollapsed ? 'none' : 'contents' }}>
        <InfoPanel
          selected={selected}
          onFleetHover={setHoverFleetPos}
          onClose={() => setInfoPanelCollapsed(true)}
          onMoveFleet={onMoveFleetToSelected}
          colorMode={colorMode}
        />
      </div>

      {showGoto && (
        <GotoDialog
          onGo={(pos) => { setCenter(pos); setSelected(pos); setShowFleetsFor(undefined); }}
          onClose={() => setShowGoto(false)}
        />
      )}

      {zoneDialogRect && <ZoneDialog rect={zoneDialogRect} onClose={closeZoneDialog} onPreview={setZonePreview} />}

      {showPaste && (
        <Modal title="Ajouter des systèmes détectés" onClose={() => setShowPaste(false)} panelStyle={{ minWidth: 600, maxWidth: '80%' }}>
          <p style={{ marginTop: 0 }}>
            Collez un système par ligne, au format:
            <br/>
            <code>nbpla=16; nom=Nb 9C; pop=3475; popMax=43547; pos=0_1_26; typeEtoile=1; proprios=4,1</code>
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Un système par ligne"}
            style={{ width: '100%', height: 180 }}
          />
          {pasteFeedback && (
            <div style={{ marginTop: 8, color: '#4ade80' }}>{pasteFeedback}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setShowPaste(false)}>Annuler</button>
            <button
              type="button"
              onClick={() => {
                const res = addDetectedSystemsFromText(pasteText);
                const msgParts = [] as string[];
                if (res.added > 0) msgParts.push(`${res.added} ajouté(s)`);
                if (res.errors.length > 0) msgParts.push(`${res.errors.length} erreur(s)`);
                setPasteFeedback(msgParts.join(' · ') || 'Aucune modification');
                if (res.errors.length === 0) {
                  // fermer et reset pour un flux rapide
                  setShowPaste(false);
                  setPasteText('');
                }
              }}
              style={{ fontWeight: 'bold' }}
            >
              Importer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
