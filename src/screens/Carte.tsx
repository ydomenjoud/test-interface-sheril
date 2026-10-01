import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useReport} from '../context/ReportContext';
import CanvasMap, {ZoneRect} from '../components/Map/CanvasMap';
import MiniMap from '../components/Map/MiniMap';
import InfoPanel from '../components/Map/InfoPanel';
import ZoneDialog from '../components/Map/ZoneDialog';
import MapHelp from '../components/Map/MapHelp';
import GotoDialog from '../components/Map/GotoDialog';
import {isTypingTarget} from '../utils/keyboard';
import {wrapX, wrapY} from '../utils/position';
import Modal from '../components/utils/Modal';
import {XY, Zone} from '../types';
import {DropdownOption, MultiSelectDropdown} from "../components/multiselect";

// Durée d'affichage de chaque tour pendant la lecture automatique de l'historique (en secondes, modifiable)
const DEFAULT_PLAY_STEP_S = 2;
const MAX_PLAY_STEP_S = 60;

export default function Carte() {
  const { rapport, global, cellSize, setCellSize, center, setCenter, addDetectedSystemsFromText, allTags, selectedTags, setSelectedTags, zones, zoneLabels, hiddenZoneLabels, setHiddenZoneLabels, tours, selectTour } = useReport();
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
  const [showSystems, setShowSystems] = useState(() => {
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
  const [showSystemRadar, setShowSystemRadar] = useState(() => {
    const saved = localStorage.getItem('carte_show_system_radar');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showFleetRadar, setShowFleetRadar] = useState(() => {
    const saved = localStorage.getItem('carte_show_fleet_radar');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showMiniMap, setShowMiniMap] = useState(() => {
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

  const [filtersExpanded, setFiltersExpanded] = useState(() => {
    const saved = localStorage.getItem('carte_filters_expanded');
    return saved !== null ? JSON.parse(saved) : true;
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

  // Raccourci : Maj + flèche déplace la case sélectionnée (depuis le centre si aucune case n'est sélectionnée)
  useEffect(() => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    function onKey(e: KeyboardEvent) {
      if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      const move = moves[e.key];
      const from = selected ?? center;
      if (!move || !from) return;
      e.preventDefault();
      setSelected({ x: wrapX(from.x + move[0]), y: wrapY(from.y + move[1]) });
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
  return (
    <div className="carte-wrap">
      <div className="carte-toolbar">
        <div>
          Taille des cases:
          <input
            type="range"
            min={16}
            max={64}
            step={2}
            value={cellSize}
            onChange={(e) => setCellSize(parseInt(e.target.value, 10))}
            style={{ marginLeft: 8 }}
          />
          <span style={{ marginLeft: 8 }}>{cellSize}px</span>
        </div>
        <div
          onClick={() => setShowGoto(true)}
          title="Aller à une case (Alt + G)"
          style={{ marginLeft: 20, cursor: 'pointer', textDecoration: 'underline dotted' }}
        >
          Centre: {center ? `${center.x}-${center.y}` : '—'}
        </div>
        {!global && (
          <div style={{ marginLeft: 20, color: '#a66' }}>
            Données globales en chargement…
          </div>
        )}
        {tourOptions.length > 0 && (
          <label style={{ marginLeft: 20 }} title="Afficher la carte telle qu'elle était à ce tour">
            Tour :
            <select
              value={rapport?.tour ?? ''}
              onChange={(e) => { stopPlay(); selectTour(Number(e.target.value)); }}
              style={{
                marginLeft: 8,
                background: '#333',
                color: '#eee',
                padding: '2px 4px',
                // tour passé : bordure jaune pour rappeler qu'on ne regarde pas les données actuelles
                border: viewingPastTour ? '2px solid #ffe600' : '1px solid #555',
              }}
            >
              {tourOptions.map(t => (
                <option key={t} value={t}>{t === latestTour ? `${t} (dernier)` : t}</option>
              ))}
            </select>
          </label>
        )}
        {tourOptions.length > 1 && (
          <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={playing ? stopPlay : startPlay}
              title={playing ? 'Arrêter la lecture' : `Rejouer tous les tours depuis le premier (un tour toutes les ${playStepS} s, zones masquées)`}
              style={{ padding: '2px 8px', cursor: 'pointer', backgroundColor: '#444', color: '#eee', border: '1px solid #666', borderRadius: 4 }}
            >
              {playing ? '■' : '▶'}
            </button>
            <label title="Durée d'affichage de chaque tour pendant la lecture" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.85em', color: '#aaa' }}>
              <input
                type="number"
                min={1}
                max={MAX_PLAY_STEP_S}
                value={playStepS}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1 && v <= MAX_PLAY_STEP_S) setPlayStepS(v);
                }}
                style={{ width: 40, background: '#333', color: '#eee', border: '1px solid #555', padding: '1px 3px' }}
              />
              s
            </label>
            {playing && (
              // Temps restant avant le tour suivant
              <div title="Temps avant le tour suivant" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85em', color: '#aaa' }}>
                <div style={{ width: 50, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(remainingMs / playStepMs) * 100}%`, height: '100%', background: '#ffe600', transition: 'width 0.2s linear' }} />
                </div>
                {Math.ceil(remainingMs / 1000)} s
              </div>
            )}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setShowPaste(true)} style={{ padding: '4px 8px', cursor: 'pointer', backgroundColor: '#444', color: '#eee', border: '1px solid #666', borderRadius: 4 }}>
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
          />
          {showMiniMap && <MiniMap onCenter={(x, y) => setCenter({ x, y })} colorMode={colorMode} />}
          <MapHelp />

          {/* Filtres Popup en bas à droite */}
          <div style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: filtersExpanded ? 280 : 120,
              backgroundColor: '#222',
              border: '1px solid #444',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              // Sur les petits écrans, le panneau ne dépasse pas la hauteur visible : l'en-tête reste accessible et le contenu défile
              maxHeight: 'min(calc(100% - 40px), calc(100vh - 160px))',
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
