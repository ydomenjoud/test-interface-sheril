import React, {useState, useEffect} from 'react';
import {useReport} from '../context/ReportContext';
import CanvasMap from '../components/Map/CanvasMap';
import MiniMap from '../components/Map/MiniMap';
import InfoPanel from '../components/Map/InfoPanel';
import {XY} from '../types';
import {DropdownOption, MultiSelectDropdown} from "../components/multiselect";

export default function Carte() {
  const { rapport, global, cellSize, setCellSize, center, setCenter, addDetectedSystemsFromText, allTags, selectedTags, setSelectedTags } = useReport();
  const [selected, setSelected] = useState<XY | undefined>(undefined);
  const [showFleetsFor, setShowFleetsFor] = useState<XY | undefined>(undefined);
  const [selectedOwners, setSelectedOwners] = useState<(number)[]>(() => {
    const saved = localStorage.getItem('carte_selected_owners');
    return saved ? JSON.parse(saved) : [];
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
        <div style={{ marginLeft: 20 }}>
          Centre: {center ? `${center.x}-${center.y}` : '—'}
        </div>
        {!global && (
          <div style={{ marginLeft: 20, color: '#a66' }}>
            Données globales en chargement…
          </div>
        )}
        <div style={{ marginLeft: 20 }} className="hideOnMobile">
          Astuce: utilisez les flèches pour naviguer, maintenez Ctrl pour se déplacer par 5.
        </div>

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
            selectedOwners={selectedOwners}
            showCombatBadges={showCombatBadges}
            showOwnerBadges={showOwnerBadges}
            showFleetBadges={showFleetBadges}
            showSystemRadar={showSystemRadar}
            showFleetRadar={showFleetRadar}
            showStabilityZones={showStabilityZones}
            stabilitySystemPos={stabilitySystemPos}
          />
          <MiniMap onCenter={(x, y) => setCenter({ x, y })} />

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
                      color: '#eee'
                  }}
              >
                  <span>Filtres</span>
                  <span>{filtersExpanded ? '▼' : '▲'}</span>
              </div>

              {filtersExpanded && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Filtre multi-sélection des commandants */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.85em', color: '#aaa' }}>Commandants</span>
                          <MultiSelectDropdown
                              title="Tous"
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

      {showPaste && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowPaste(false)}
        >
          <div
            style={{ background: '#1e1e1e', color: '#eee', padding: 16, borderRadius: 6, minWidth: 600, maxWidth: '80%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Ajouter des systèmes détectés</h3>
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
          </div>
        </div>
      )}
    </div>
  );
}
