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
import {wrapX, wrapY, getTorusDistance, posToString} from '../utils/position';
import Modal from '../components/utils/Modal';
import {XY, Zone} from '../types';
import {DropdownOption, MultiSelectDropdown} from "../components/multiselect";
import {loadDeplacements, saveDeplacements, clearDeplacements} from '../storage/deplacementOrdersStorage';
import {DeplacementEnAttente, DeplacementOrdre, DIRECTIVE_DEFAUT, OPTIONS_DIRECTIVES, OPTIONS_STRATEGIES, STRATEGIE_DEFAUT, schemaDeplacements} from '../utils/ordreDeplacement';
import {copierSchema} from '../utils/ordreSchema';

// Durée d'affichage de chaque tour pendant la lecture automatique de l'historique (en secondes, modifiable)
const DEFAULT_PLAY_STEP_S = 2;
const MAX_PLAY_STEP_S = 60;

// Boutons du panneau des déplacements (mêmes codes que l'écran Planification des Revenus)
const styleBoutonDeplacement: React.CSSProperties = {
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: '0.85em',
    cursor: 'pointer'
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
  const [showInfluence, setShowInfluence] = useState(() => {
    const saved = localStorage.getItem('carte_show_influence');
    return saved !== null ? JSON.parse(saved) : false;
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
  const [colorMode, setColorMode] = useState<'status' | 'player'>(() => {
    const saved = localStorage.getItem('carte_color_mode');
    return saved !== null ? (saved as 'status' | 'player') : 'status';
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

  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('carte_filters_expanded');
    return saved !== null ? JSON.parse(saved) : false;
  });

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
    localStorage.setItem('carte_show_influence', JSON.stringify(showInfluence));
  }, [showInfluence]);

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
    <div className="no-rapport-hint" style={{ padding: '4px 12px', background: '#332200', color: '#ffcc00', fontSize: '0.9em' }}>
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

  // Raccourcis : Alt + G (aller à une case), Alt + ← / → (tour précédent / suivant de l'historique)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.code === 'KeyG' || e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGoto(true);
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

  // Nouveau rapport ou changement de tour : recharger les déplacements stockés pour le tour affiché
  // (importCount : un import d'un tour plus ancien ne change pas le rapport affiché mais vide le
  // stockage — sans ce compteur, les déplacements en mémoire ressusciteraient à la sauvegarde)
  useEffect(() => {
    setDeplacements(tour !== undefined ? loadDeplacements(tour) : {});
    setPicker(null);
    setDragState(null);
    setDragCursor(null);
  }, [tour, rapport, importCount]);

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
    setPicker(null);
    setDragState(null);
    setDragCursor(null);
  }, []);
  // Un pan démarre sur la case : le geste de sélection est annulé (pan et zone Alt inchangés)
  const onFleetCellGestureAbort = useCallback(() => {
    setPicker(null);
    setDragState(null);
    setDragCursor(null);
  }, []);
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
    setDragState(null);
    setDragCursor(null);
    setPicker(null);
  }, []);
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
      setDragState(null);
      setDragCursor(null);
      setPicker(null);
      return;
    }
    if (cell.x === origine.x && cell.y === origine.y) {
      setDeplacements(d => {
        const reste = { ...d };
        delete reste[fleetNum];
        return reste;
      });
    } else {
      // directive/stratégie par défaut (placeholder) : modifiables dans les menus du panneau
      setDeplacements(d => ({ ...d, [fleetNum]: { to: cell, directive: DIRECTIVE_DEFAUT, strategy: STRATEGIE_DEFAUT } }));
      setDeplacementsExpanded(true); // on ouvre le panneau pour montrer le résultat du dépos
    }
    setDragState(null);
    setDragCursor(null);
    setPicker(null);
  }, [rapport]);

  // Schéma d'ordres : un ordre par déplacement dont la flotte est encore dans le rapport
  // (une flotte introuvable, ex. tour différent, est ignorée ici et en ligne repliée du panneau)
  const ordresDeplacement = useMemo<DeplacementOrdre[]>(() => {
    const liste: DeplacementOrdre[] = [];
    for (const [num, deplacement] of Object.entries(deplacements)) {
      const flotte = rapport?.flottesJoueur.find(f => f.num === Number(num));
      if (flotte) liste.push({
        fleetNum: flotte.num,
        from: flotte.pos,
        to: deplacement.to,
        directive: deplacement.directive,
        strategy: deplacement.strategy,
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
  // Modification de la directive / de la stratégie d'un déplacement existant (menus du panneau)
  const majDeplacement = useCallback((num: number, champ: { directive?: number; strategy?: number }) => {
    setDeplacements(d => {
      const actuel = d[num];
      if (!actuel) return d;
      return { ...d, [num]: { ...actuel, ...champ } };
    });
  }, []);

  const nbDeplacements = Object.keys(deplacements).length;
  return (
    <div className="carte-wrap">
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
        {/* Filtres rapides : icônes discrètes, les options avancées sont dans le panneau Filtres (⚙) */}
        <div className="carte-toolbar-group" role="group" aria-label="Filtres rapides">
          <button type="button" className={showSystems ? 'carte-icon-btn active' : 'carte-icon-btn'} title="Afficher / masquer les systèmes" onClick={() => setShowSystems(v => !v)}>✦</button>
          <button type="button" className={showSystemRadar ? 'carte-icon-btn active' : 'carte-icon-btn'} title="Portée radar des systèmes" onClick={() => setShowSystemRadar(v => !v)}>◎</button>
          <button type="button" className={showFleetRadar ? 'carte-icon-btn active' : 'carte-icon-btn'} title="Portée radar des flottes" onClick={() => setShowFleetRadar(v => !v)}>◉</button>
          <button type="button" className={showMiniMap ? 'carte-icon-btn active' : 'carte-icon-btn'} title="Afficher / masquer la mini-carte" onClick={() => setShowMiniMap(v => !v)}>▣</button>
          <MapHelp renderTrigger={open => (
            <button type="button" className="carte-icon-btn" title="Aide et raccourcis (?)" onClick={open}>?</button>
          )} />
          <button type="button" className={filtersExpanded ? 'carte-icon-btn active' : 'carte-icon-btn'} title="Filtres avancés" onClick={() => setFiltersExpanded(v => !v)}>⚙</button>
          <button type="button" className={deplacementsExpanded ? 'carte-icon-btn active' : 'carte-icon-btn'} title="Déplacements de flottes (glisser-déposer)" onClick={() => setDeplacementsExpanded(v => !v)}>⇢</button>
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
                style={{ border: viewingPastTour ? '2px solid #ffe600' : undefined }}
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
            >
              {playing ? '■' : '▶'}
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
                <div style={{ width: 50, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(remainingMs / playStepMs) * 100}%`, height: '100%', background: '#ffe600', transition: 'width 0.2s linear' }} />
                </div>
                {Math.ceil(remainingMs / 1000)} s
              </div>
            )}
          </div>
        )}

        {/* Actions : import */}
        <div className="carte-toolbar-group" style={{ marginLeft: 'auto' }}>
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
            showInfluence={showInfluence}
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
          {showMiniMap && <MiniMap onCenter={(x, y) => setCenter({ x, y })} colorMode={colorMode} />}
          {/* Légende des couleurs (mode Alliés/Ennemis) : la carte se suffit à elle-même au coup d'œil */}
          {colorMode === 'status' && (
            <div className="map-legend" title="Couleurs de possession des systèmes et des flottes">
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#09ca31' }} /> moi</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#224eff' }} /> alliance</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#ffff00' }} /> PNA</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#f80c0c' }} /> ennemi</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#999999' }} /> neutre</span>
              <span className="map-legend-item"><span className="map-legend-dot map-legend-fleet" /> flotte</span>
            </div>
          )}
          {/* Filtres Popup en haut à droite (la mini-carte occupe le bas à droite) */}
          <div style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: filtersExpanded ? 280 : 120,
              backgroundColor: '#222',
              border: '1px solid #444',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              // Le panneau ne dépasse pas la zone de la carte : l'en-tête reste accessible et le contenu défile
              maxHeight: 'calc(100% - 16px)',
              transition: 'width 0.3s ease'
          }}>
              <div
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  style={{
                      padding: '8px 12px',
                      backgroundColor: '#333',
                      borderBottom: filtersExpanded ? '1px solid #444' : 'none',
                      borderRadius: filtersExpanded ? '8px 8px 0 0' : 8,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.9em',
                      color: '#eee',
                      flexShrink: 0
                  }}
              >
                  <span>Filtres</span>
                  <span>{filtersExpanded ? '▼' : '▲'}</span>
              </div>

              {filtersExpanded && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minHeight: 0 }}>
                      {/* Filtre multi-sélection des commandants */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.85em', color: '#aaa' }}>Afficher uniquement Commandants</span>
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
                              <span style={{ fontSize: '0.85em', color: '#aaa' }}>Tags</span>
                              <MultiSelectDropdown
                                  title="Tous"
                                  options={selectedTagsOption}
                                  selectedValues={selectedTags}
                                  onChange={setSelectedTags}
                              />
                          </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #444', paddingTop: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showSystems}
                              onChange={(e) => setShowSystems(e.target.checked)}
                            />
                            Afficher systèmes
                          </label>
                          <label
                            title="Systèmes connus uniquement par les données publiques (data.xml), jamais détectés dans vos rapports"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, color: showSystems ? '#eee' : '#777', fontSize: '0.9em', cursor: showSystems ? 'pointer' : 'default', marginLeft: 16 }}
                          >
                            <input
                              type="checkbox"
                              disabled={!showSystems}
                              checked={showGlobalSystems}
                              onChange={(e) => setShowGlobalSystems(e.target.checked)}
                            />
                            Carte galactique
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showSectors}
                              onChange={(e) => setShowSectors(e.target.checked)}
                            />
                            Afficher secteurs
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showInfluence}
                              onChange={(e) => setShowInfluence(e.target.checked)}
                            />
                            Afficher influence
                          </label>

                          {showInfluence && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 20 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.8em', color: '#aaa' }}>Opacité ( défaut 18% )</span>
                                      <span style={{ fontSize: '0.8em', color: '#eee' }}>{Math.round(influenceOpacity * 100)}%</span>
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
                              </div>
                          )}

                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showMiniMap}
                              onChange={(e) => setShowMiniMap(e.target.checked)}
                            />
                            Afficher minimap
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: '0.85em', color: '#aaa' }}>Mode de couleur</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                      onClick={() => setColorMode('status')}
                                      style={{
                                          flex: 1,
                                          fontSize: '0.8em',
                                          padding: '4px 2px',
                                          cursor: 'pointer',
                                          backgroundColor: colorMode === 'status' ? '#555' : '#333',
                                          color: '#eee',
                                          border: '1px solid #666',
                                          borderRadius: 4
                                      }}
                                  >
                                      Alliés/Ennemis
                                  </button>
                                  <button
                                      onClick={() => setColorMode('player')}
                                      style={{
                                          flex: 1,
                                          fontSize: '0.8em',
                                          padding: '4px 2px',
                                          cursor: 'pointer',
                                          backgroundColor: colorMode === 'player' ? '#555' : '#333',
                                          color: '#eee',
                                          border: '1px solid #666',
                                          borderRadius: 4
                                      }}
                                  >
                                      Par Joueur
                                  </button>
                              </div>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showCombatBadges}
                              onChange={(e) => setShowCombatBadges(e.target.checked)}
                            />
                            Badges combats
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showOwnerBadges}
                              onChange={(e) => setShowOwnerBadges(e.target.checked)}
                            />
                            Badges propriétaires
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showFleetBadges}
                              onChange={(e) => setShowFleetBadges(e.target.checked)}
                            />
                            Badges flottes
                          </label>
                      </div>

                      {zones.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #444', paddingTop: 8 }}>
                              <span style={{ fontSize: '0.85em', color: '#aaa' }}>Zones manuelles (Alt + clic + glisser)</span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                                  <input
                                      type="checkbox"
                                      checked={showZones}
                                      onChange={(e) => setShowZones(e.target.checked)}
                                  />
                                  Afficher les zones ({zones.length})
                              </label>
                              {/* Choix par label, sans effet tant que toutes les zones sont masquées */}
                              {zoneLabels.map(label => (
                                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: showZones ? '#eee' : '#777', fontSize: '0.9em', cursor: showZones ? 'pointer' : 'default', marginLeft: 16 }}>
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

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #444', paddingTop: 8 }}>
                          <span style={{ fontSize: '0.85em', color: '#aaa' }}>Portées Radar</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showSystemRadar}
                              onChange={(e) => setShowSystemRadar(e.target.checked)}
                            />
                            Systèmes
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={showFleetRadar}
                              onChange={(e) => setShowFleetRadar(e.target.checked)}
                            />
                            Flottes
                          </label>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #444', paddingTop: 8 }}>
                          <span style={{ fontSize: '0.85em', color: '#aaa' }}>Distance Capitale</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eee', fontSize: '0.9em', cursor: 'pointer' }}>
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
                                  background: '#333',
                                  color: '#eee',
                                  border: '1px solid #555',
                                  padding: '2px 4px',
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
              )}
          </div>

          {/* Déplacements en attente : un seul par flotte, repliable comme le panneau Filtres
              (toujours visible, en-tête cliquable ; l'icône ⇢ de la barre d'outils le pilote aussi).
              Haut à gauche de la zone de carte : en haut à droite les Filtres, en bas à droite la
              mini-carte, en bas à gauche la légende ; le panneau info est dans sa propre colonne */}
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: deplacementsExpanded ? 560 : 170, // replié : assez large pour lire « Déplacements (n) » ; déplié : un déplacement par ligne
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            // Le panneau ne dépasse pas la zone de la carte : l'en-tête reste accessible et le contenu défile
            maxHeight: 'calc(100% - 16px)',
            transition: 'width 0.3s ease'
          }}>
            <div
              onClick={() => setDeplacementsExpanded(!deplacementsExpanded)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#333',
                borderBottom: deplacementsExpanded ? '1px solid #444' : 'none',
                borderRadius: deplacementsExpanded ? '8px 8px 0 0' : 8,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                fontWeight: 'bold',
                fontSize: '0.9em',
                color: '#eee',
                flexShrink: 0
              }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Déplacements ({nbDeplacements})
              </span>
              <span style={{ flexShrink: 0 }}>{deplacementsExpanded ? '▾' : '▸'}</span>
            </div>
            {deplacementsExpanded && (
              <>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {nbDeplacements === 0 ? (
                    <div style={{ color: '#666', fontSize: '0.85em' }}>
                      Aucun déplacement — cliquer une case occupée par vos flottes, puis glisser une
                      flotte sur sa case de destination.
                    </div>
                  ) : (
                    Object.entries(deplacements)
                      .map(([num, deplacement]) => ({ num: Number(num), deplacement }))
                      .sort((a, b) => a.num - b.num)
                      .map(({ num, deplacement }) => {
                        const to = deplacement.to;
                        const flotte = rapport?.flottesJoueur.find(f => f.num === num);
                        const origine = flotte?.pos;
                        const dist = origine ? getTorusDistance(origine, to) : undefined;
                        const dansPortee = dist !== undefined && flotte ? dist <= flotte.vitesse : false;
                        // Un déplacement par LIGNE : nom (tronqué si long), origine → destination (distance en
                        // rouge si hors de portée), ⚠ compacte, menus directive/stratégie, ×
                        return (
                          <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{ flex: 1, fontSize: '0.85em', color: '#ddd', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={flotte ? `Flotte ${num + 1} — ${flotte.nom}` : `Flotte ${num + 1} (absente du rapport affiché)`}
                            >
                              <strong>Flotte #{num + 1}</strong>
                              {flotte ? <span style={{ color: '#aaa' }}> — {flotte.nom}</span> : null}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.8em', color: '#bbb', flexShrink: 0 }}>
                              {origine ? posToString(origine) : '—'} → {posToString(to)}
                              {dist !== undefined && (
                                <span
                                  title={dansPortee ? undefined : 'Hors de portée (distance > vitesse)'}
                                  style={{ color: dansPortee ? undefined : '#f44336', fontWeight: dansPortee ? undefined : 'bold' }}
                                >
                                  {' '}({dist})
                                </span>
                              )}
                            </div>
                            {flotte?.direction && (
                              <span
                                title={`Déjà en route vers ${posToString(flotte.direction)} dans le rapport`}
                                style={{ color: '#ff9800', flexShrink: 0, fontSize: '0.85em' }}
                              >
                                ⚠
                              </span>
                            )}
                            {/* Directive et stratégie de l'ordre (valeurs placeholder, à confirmer avec le jeu) */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75em', color: '#aaa', flexShrink: 0 }}>
                              Directive
                              <select
                                className="carte-select"
                                value={deplacement.directive}
                                onChange={e => majDeplacement(num, { directive: Number(e.target.value) })}
                                style={{ width: 52 }}
                              >
                                {OPTIONS_DIRECTIVES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75em', color: '#aaa', flexShrink: 0 }}>
                              Stratégie
                              <select
                                className="carte-select"
                                value={deplacement.strategy}
                                onChange={e => majDeplacement(num, { strategy: Number(e.target.value) })}
                                style={{ width: 52 }}
                              >
                                {OPTIONS_STRATEGIES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </label>
                            <button
                              type="button"
                              title="Supprimer ce déplacement"
                              onClick={() => setDeplacements(d => {
                                const reste = { ...d };
                                delete reste[num];
                                return reste;
                              })}
                              style={{
                                flexShrink: 0,
                                background: 'transparent',
                                border: 'none',
                                color: '#a66',
                                cursor: 'pointer',
                                padding: '0 4px',
                                fontSize: '1.1em'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid #444', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={copierLeSchema}
                    disabled={nbDeplacements === 0}
                    title="Copier le schéma des ordres de déplacement (placeholder) à coller dans la console d'ordres"
                    style={{
                      ...styleBoutonDeplacement,
                      flex: 1,
                      textDecoration: 'underline dotted',
                      opacity: nbDeplacements === 0 ? 0.3 : 1,
                      cursor: nbDeplacements === 0 ? 'default' : 'pointer'
                    }}
                  >
                    {copieSchema === 'ok' ? '✓ Schéma copié' : copieSchema === 'ko' ? '✗ Échec de la copie' : '📋 Copier le schéma'}
                  </button>
                  <button
                    type="button"
                    onClick={reinitialiserDeplacements}
                    disabled={nbDeplacements === 0}
                    title="Retirer tous les déplacements de ce tour"
                    style={{
                      ...styleBoutonDeplacement,
                      textDecoration: 'underline dotted',
                      opacity: nbDeplacements === 0 ? 0.3 : 1,
                      cursor: nbDeplacements === 0 ? 'default' : 'pointer'
                    }}
                  >
                    ↺ Tout réinitialiser
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
              onClose={() => setPicker(null)}
            />
          )}
        </div>
      </div>

      <InfoPanel selected={selected} />

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
            <div style={{ marginTop: 8, color: '#9f9' }}>{pasteFeedback}</div>
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
