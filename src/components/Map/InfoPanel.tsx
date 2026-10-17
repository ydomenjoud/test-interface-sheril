import React, {useEffect, useMemo, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {CombatEvent, FlotteBase, FlotteDetectee, FlotteJoueur, XY, Note} from '../../types';
import { getTorusDistance } from '../../utils/position';
import {
  combatsAtPosition,
  combatKindLabel,
  formatCombatDetailText,
  isCombatTableHtml,
} from '../../parsers/parseCombatMessages';
import Commandant from "../utils/Commandant";
import Position from "../utils/Position";
import {colorForOwnership} from "./CanvasMap";
import {getDescriptionPuissance, getPuissance, getPuissanceFromString} from "../../utils/puissance";
import { NavLink } from 'react-router-dom';
import ZoneEditor from './ZoneEditor';
import { zoneCovers } from '../../utils/zones';
import { isObserved, lastKnownFleets } from '../../utils/fleetHistory';
import { lastKnownSystem } from '../../utils/systemHistory';
import { fleetSnapshotOf } from '../../storage/rapportStore';
import {capaciteReparation} from '../../utils/reparation';

type Props = {
  selected?: XY;
  // Survol d'une ligne de flotte dans le panneau : position de la flotte à surligner sur la carte
  onFleetHover?: (pos: XY | undefined) => void;
};

// Formatage des nombres avec séparateur de milliers (ex. 59 485)
const fmt = (n: number) => n.toLocaleString('fr-FR');

// Ligne issue d'un tour précédent : texte grisé et icône d'avertissement à côté du nom
const staleRowStyle: React.CSSProperties = { color: '#999' };
const StaleIcon = () => (
  <span title="Information d'un tour précédent, peut-être obsolète" style={{ marginRight: 6, color: '#ffb000', cursor: 'help' }}>⚠</span>
);



export default function InfoPanel({ selected, onFleetHover }: Props) {
  const { rapport, global, notes, addNote, deleteNote, allTags, publicCombats, zones, zoneLabels, fleetSnapshots, systemSnapshots } = useReport();

  // Zones affichées : celles qui couvrent la case, plus celles déjà listées pour cette sélection
  // (une zone déplacée ou réduite hors de la case reste éditable jusqu'au prochain clic)
  const [keptZoneIds, setKeptZoneIds] = useState<string[]>([]);
  useEffect(() => {
    setKeptZoneIds(selected ? zones.filter(z => zoneCovers(z, selected)).map(z => z.id) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.x, selected?.y]);
  const zonesHere = useMemo(
    () => (selected ? zones.filter(z => keptZoneIds.includes(z.id) || zoneCovers(z, selected)) : []),
    [zones, selected, keptZoneIds]
  );
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState('#ffcc00');
  const [noteTag, setNoteTag] = useState('');
  // Le formulaire d'ajout est replié derrière un bouton pour laisser la place aux notes existantes
  const [showNoteForm, setShowNoteForm] = useState(false);

  const [sortField, setSortField] = useState<'dist' | 'num' | 'vitesse' | 'as' | 'ap'>('dist');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // En-tête triable de la liste "Mes flottes"
  const sortTh = (field: 'num' | 'dist' | 'vitesse' | 'as' | 'ap', label: string) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => {
        if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortOrder('asc'); }
      }}
    >
      {label} {sortField === field && (sortOrder === 'asc' ? '▲' : '▼')}
    </th>
  );
  const [hoverFleet, setHoverFleet] = useState<{fleet: any; anchor: {top: number; bottom: number; left: number; right: number}} | undefined>(undefined);
  const showFleetHover = (f: any) => (e: React.MouseEvent<HTMLTableRowElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHoverFleet({fleet: f, anchor: {top: r.top, bottom: r.bottom, left: r.left, right: r.right}});
    onFleetHover?.(f.pos);
  };
  const hideFleetHover = () => {
    setHoverFleet(undefined);
    onFleetHover?.(undefined);
  };
  // Changement de sélection : ne pas garder le détail de la flotte de l'ancienne case
  useEffect(() => {
    setHoverFleet(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.x, selected?.y]);

  const atPos = useMemo(() => {
    if (!selected) return { systems: [], fleets: [] as any[], playerFleets: [] as any[] };
    const systems: any[] = [];
    const seen = new Set<string>();

    if (rapport) {
      rapport.systemesJoueur.filter(s => s.pos.x === selected.x && s.pos.y === selected.y).forEach(s => {
        systems.push(s);
        seen.add(`${s.pos.x}_${s.pos.y}`);
      });
      rapport.systemesDetectes.filter(s => s.pos.x === selected.x && s.pos.y === selected.y).forEach(s => {
        if (!seen.has(`${s.pos.x}_${s.pos.y}`)) {
          systems.push(s);
          seen.add(`${s.pos.x}_${s.pos.y}`);
        }
      });
    }

    // Système vu sur la case dans un tour précédent mais plus dans les données actuelles :
    // on affiche la dernière détection stockée (avec son tour) plutôt que le simple nom de data.xml
    if (systems.length === 0 && rapport) {
      const last = lastKnownSystem(systemSnapshots, selected, rapport.tour);
      if (last) {
        systems.push(last.systeme);
        seen.add(`${last.systeme.pos.x}_${last.systeme.pos.y}`);
      }
    }

    if (global?.systemes) {
      global.systemes.filter(s => s.pos.x === selected.x && s.pos.y === selected.y).forEach(s => {
        if (!seen.has(`${s.pos.x}_${s.pos.y}`)) {
          systems.push(s);
          seen.add(`${s.pos.x}_${s.pos.y}`);
        }
      });
    }

    const fleets = rapport ? [
      ...rapport.flottesJoueur.filter(f => f.pos.x === selected.x && f.pos.y === selected.y),
      ...rapport.flottesDetectees.filter(f => f.pos.x === selected.x && f.pos.y === selected.y),
    ] : [];

    let playerFleets = rapport ? rapport.flottesJoueur.map(f => {
      const dist = getTorusDistance(f.pos, selected);
      return { ...f, dist, reachable: dist <= f.vitesse };
    }) : [];

    // Tri
    playerFleets.sort((a, b) => {
      let valA = a[sortField] ?? 0;
      let valB = b[sortField] ?? 0;

      if (valA === valB) return 0;
      const res = valA < valB ? -1 : 1;
      return sortOrder === 'asc' ? res : -res;
    });

    return { systems, fleets, playerFleets };
  }, [selected, rapport, global, systemSnapshots, sortField, sortOrder]);

  const system = useMemo(() => {
    return atPos.systems[0];
  }, [atPos.systems]);

  // Système détecté lors d'un tour précédent (ou à une date inconnue) : ses informations peuvent être obsolètes
  const staleTour: number | 'inconnu' | undefined = useMemo(() => {
    if (!rapport || system?.type !== 'detecte') return undefined;
    if (typeof system.tour !== 'number' || !system.tour) return 'inconnu';
    return system.tour < rapport.tour ? system.tour : undefined;
  }, [system, rapport]);

  // Case hors de vue au tour affiché : on montre les dernières flottes qui y ont été vues
  const pastFleets = useMemo(() => {
    if (!rapport || !selected || atPos.fleets.length > 0) return undefined;
    if (isObserved(fleetSnapshotOf(rapport).observateurs, selected)) return undefined; // vue et vide : rien à montrer
    return lastKnownFleets(fleetSnapshots, selected, rapport.tour);
  }, [rapport, selected, atPos.fleets.length, fleetSnapshots]);

  // Tour (le plus ancien) des données obsolètes affichées : système et/ou flottes d'un tour précédent
  const staleFromTour: number | 'inconnu' | undefined = useMemo(() => {
    const known = [typeof staleTour === 'number' ? staleTour : undefined, pastFleets?.tour].filter((t): t is number => t !== undefined);
    if (known.length > 0) return Math.min(...known);
    return staleTour; // 'inconnu' ou undefined
  }, [staleTour, pastFleets]);

  const isOwner = useMemo(() => system?.proprietaires?.some((p: any) => p === rapport?.joueur?.numero), [system, rapport])

  // Couleur de possession du système (bordure du récapitulatif de case)
  const summaryColor = useMemo(() => {
    if (system?.proprietaires?.length) {
      return colorForOwnership(rapport?.joueur?.numero, system.proprietaires, rapport?.joueur?.alliances, rapport?.joueur?.pna) || '#555';
    }
    return '#555';
  }, [system, rapport]);

  const currentNotes = useMemo(() => {
    if (!selected) return [];
    return notes[`${selected.x}_${selected.y}`] || [];
  }, [selected, notes]);

  const cellCombats = useMemo(() => {
    if (!selected) return [];
    const rapportCombats = rapport?.combats ? combatsAtPosition(rapport.combats, selected) : [];
    const publicCombatsAt = publicCombats ? combatsAtPosition(publicCombats, selected) : [];
    return [...rapportCombats, ...publicCombatsAt];
  }, [selected, rapport, publicCombats]);

  // La case a-t-elle du contenu (système, flottes actuelles/connues, combats, zones) ?
  const hasCellContent = useMemo(
    () => !!system || atPos.fleets.length > 0 || !!pastFleets || cellCombats.length > 0 || zonesHere.length > 0,
    [system, atPos.fleets.length, pastFleets, cellCombats.length, zonesHere.length]
  );

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noteText.trim()) return;
    addNote(selected, noteText, noteColor, noteTag.trim() || undefined);
    setNoteText('');
    setNoteTag('');
    setShowNoteForm(false);
  };

  if (!selected) {
    return <div className="carte-info">Cliquez sur une case de la carte pour voir le détail.</div>;
  }


  return (
    <div className="carte-info">
      <div className="info-block">
        <h3>
          Case <Position pos={selected} />
          {rapport && (
            <span style={{ marginLeft: 10, fontSize: '0.7em', fontWeight: 'normal', color: '#aaa' }}>
              {/* tour d'où viennent les données : celui d'une ancienne observation, sinon le tour consulté */}
              information tour {staleFromTour === undefined ? rapport.tour : staleFromTour}
            </span>
          )}
        </h3>
        {rapport && staleFromTour !== undefined && (
          <div style={{ marginTop: 6, padding: '4px 8px', background: '#332200', color: '#ffcc00', borderLeft: '3px solid #ffb000', fontSize: '0.85em' }}>
            ⚠ Données affichées provenant {staleFromTour === 'inconnu' ? "d'un tour inconnu" : `du tour ${staleFromTour}`} (dernier {rapport.tour})
          </div>
        )}
      </div>

      {!hasCellContent && (
        <div className="info-block" style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em' }}>
          Case vide.
        </div>
      )}

      {/* Récapitulatif du système de la case (affiché seulement s'il y a un système : sans système,
      les sections ci-dessous suffisent) */}
      {system && (
        <div className="info-block" style={{ borderLeft: `4px solid ${summaryColor}`, paddingLeft: 10 }}>
          {system && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: '1.05em' }}>
                  {staleTour !== undefined && <StaleIcon />}
                  {system.nom}
                </strong>
                {isOwner && (
                  <NavLink to={`/player-system-detail/${selected.x}-${selected.y}`} style={{ fontSize: '0.85em' }}>
                    détails
                  </NavLink>
                )}
              </div>
              <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                {Array.isArray(system.proprietaires) && system.proprietaires.length
                  ? system.proprietaires.map((p: number, key: number) => <Commandant num={p} key={key} />)
                  : null}
              </div>
            </>
          )}
          <div style={{ fontSize: '0.85em', color: '#bbb' }}>
            {system?.nbPla != null && <>{fmt(system.nbPla)} planètes</>}
            {system?.pop != null && system?.popMax != null && <> · pop {fmt(system.pop)}/{fmt(system.popMax)}</>}
          </div>
          {/* Capacité de réparation du système par tour (sommée sur les bâtiments de ses planètes) ;
          les systèmes détectés peuvent n'avoir aucune planète */}
          {Array.isArray(system.planetes) && system.planetes.length > 0 && (
            <div style={{ fontSize: '0.85em', color: '#bbb' }}>
              Capacité réparation : {fmt(capaciteReparation(system.planetes, global))}
            </div>
          )}
        </div>
      )}

      {/* Le détail système (nom, possesseurs, planètes, population) est dans le récapitulatif en tête de panneau */}

      {(atPos.fleets.length > 0 || pastFleets) && (
      <div className="info-block">
        <h4>Flottes</h4>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            <th>Nom</th>
            <th>Propriétaire</th>
            <th>Vaisseaux</th>
            <th>Puissance</th>
          </tr>
          </thead>
          <tbody>
          {atPos.fleets.map((f: FlotteBase, i: number) => {
            const owner = (f as any).proprio ?? (rapport?.joueur?.numero ?? undefined);
            // const puissance = (f as any).puiss ?? ((typeof f.as === 'number') ? f.as : '—');
            let puissanceDesc = "";

            if(f.type === 'joueur') {
                const local = f as FlotteJoueur;
                const puissance = getPuissance(local);
                const p = getDescriptionPuissance(puissance);
                puissanceDesc = `AS: ${local.as}/ AP: ${local.ap} (${p})`;
            } else if (f.type === 'detecte') {
                const local = f as FlotteDetectee;
                puissanceDesc = `${getPuissanceFromString(local.puiss)} - ${local.puiss}`;

            }
            return (
              <tr key={`flt-${i}`} {...(f.type === 'joueur' ? { onMouseEnter: showFleetHover(f), onMouseLeave: hideFleetHover } : {})}>
                <td>{f.nom} ({f.num+1})</td>
                <td style={{ textAlign: 'right' }}>
                  {typeof owner === 'number' ? <Commandant num={owner} /> : '—'}
                </td>
                  <td>{f.nbVso}</td>
                <td style={{ textAlign: 'right' }}>{puissanceDesc}</td>
              </tr>
            );
          })}
          {pastFleets?.flottes.map((f, i) => (
            <tr key={`old-${i}`} style={staleRowStyle}>
              <td><StaleIcon />{f.nom} ({f.num+1})</td>
              <td style={{ textAlign: 'right' }}><Commandant num={f.proprio} /></td>
              <td>{f.nbVso}</td>
              <td style={{ textAlign: 'right' }}>{`${getPuissanceFromString(f.puiss)} - ${f.puiss}`}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
      )}

      {atPos.playerFleets.length > 0 && (
        <div className="info-block">
          <h4>Mes flottes</h4>
          <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr>
              {sortTh('num', 'Nom')}
              {sortTh('dist', 'Distance')}
              {sortTh('vitesse', 'Vitesse')}
              {sortTh('as', 'AS')}
              {sortTh('ap', 'AP')}
              <th>Position</th>
            </tr>
            </thead>
            <tbody>
            {atPos.playerFleets.map((f: any, i: number) => {
              const isHere = f.pos.x === selected.x && f.pos.y === selected.y;
              // Hors de portée ce tour : ligne orangée et estompée
              const rowStyle = !f.reachable && !isHere ? { opacity: 0.5, color: '#ffa500' } : {};
              return (
                <tr key={`player-flt-${i}`} style={rowStyle} onMouseEnter={showFleetHover(f)} onMouseLeave={hideFleetHover}>
                  <td>{f.nom} ({f.num+1})</td>
                  <td style={{ textAlign: 'right' }}>{isHere ? '—' : f.dist}</td>
                  <td style={{ textAlign: 'right' }}>{f.vitesse}</td>
                  <td style={{ textAlign: 'right' }}>{f.as ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>{f.ap ?? 0}</td>
                  <td style={{ textAlign: 'right' }}><Position pos={f.pos} /></td>
                </tr>
              );
            })}
            </tbody>
          </table>
          <div style={{ fontSize: '0.75em', color: '#888', marginTop: 4 }}>orange estompé = hors de portée ce tour</div>
        </div>
      )}
      {cellCombats.length > 0 && (
      <div className="info-block">
        <h4>Combats</h4>
        <p className="combat-legend">
          <span className="combat-legend-spatial">S</span> spatial (bas-gauche)
          <span className="combat-legend-planetary">P</span> planétaire (haut-gauche)
        </p>
        <div className="combat-list">
          {cellCombats.map((combat) => (
            <CombatCard key={combat.id} combat={combat} />
          ))}
        </div>
      </div>
      )}

      {zonesHere.length > 0 && (
      <div className="info-block">
        <h4>Zones</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {zonesHere.map(z => <ZoneEditor key={z.id} zone={z} />)}
          <datalist id="zone-editor-labels">
            {zoneLabels.map(l => <option key={l} value={l} />)}
          </datalist>
        </div>
      </div>
      )}

      <div className="info-block">
        <h4>Notes</h4>

        {currentNotes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {currentNotes.map((note: Note) => (
              <div
                key={note.id}
                style={{
                  borderLeft: `4px solid ${note.color}`,
                  background: 'rgba(255,255,255,0.05)',
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  fontSize: '0.9em'
                }}
              >
                <div style={{ flex: 1 }}>
                  {note.tag && (
                    <span style={{
                      display: 'inline-block',
                      background: '#345',
                      color: '#ccc',
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: '0.8em',
                      marginRight: 6,
                      verticalAlign: 'middle'
                    }}>
                      {note.tag}
                    </span>
                  )}
                  <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'inline' }}>{note.text}</div>
                </div>
                <button
                  onClick={() => deleteNote(selected, note.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a66',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '1.1em'
                  }}
                  title="Supprimer la note"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em', marginBottom: 8 }}>Aucune note pour cette case.</div>
        )}

        {showNoteForm ? (
          <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="color"
                value={noteColor}
                onChange={(e) => setNoteColor(e.target.value)}
                style={{ width: 40, height: 30, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                title="Choisir une couleur"
              />
              <input
                type="text"
                value={noteTag}
                onChange={(e) => setNoteTag(e.target.value)}
                placeholder="Tag..."
                list="tags-list"
                style={{ width: 80, padding: '4px 8px', background: '#123', color: '#eee', border: '1px solid #345' }}
              />
              <datalist id="tags-list">
                {allTags.map(tag => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Ajouter une note..."
                style={{ flex: 1, padding: '4px 8px', background: '#123', color: '#eee', border: '1px solid #345' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ padding: '4px 12px' }}>Ajouter</button>
              <button type="button" onClick={() => setShowNoteForm(false)} style={{ padding: '4px 12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 4 }}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowNoteForm(true)}
            style={{ padding: '4px 12px', cursor: 'pointer', backgroundColor: '#333', color: '#eee', border: '1px solid #555', borderRadius: 4, fontSize: '0.85em' }}
          >
            + Ajouter une note
          </button>
        )}
      </div>

      {hoverFleet && (() => {
        const f = hoverFleet.fleet as any;
        const width = 280;
        // À droite de la ligne si la place existe, sinon à gauche ; alignée sur la ligne
        const left = hoverFleet.anchor.right + 8 + width < window.innerWidth
            ? hoverFleet.anchor.right + 8
            : Math.max(8, hoverFleet.anchor.left - width - 8);
        const estHeight = 240;
        let top = hoverFleet.anchor.top;
        if (top + estHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - estHeight - 8);
        // Composition des vaisseaux : type × nombre
        const comp: Record<string, number> = {};
        (f.vaisseaux || []).forEach((v: any) => { comp[v.type] = (comp[v.type] || 0) + 1; });
        const compEntries = Object.entries(comp);
        const lbl: React.CSSProperties = { color: '#999', paddingRight: 12, whiteSpace: 'nowrap' };
        return (
          <div style={{ position: 'fixed', left, top, width, zIndex: 300, pointerEvents: 'none', background: 'rgba(15,15,20,0.97)', border: '1px solid #555', borderRadius: 6, padding: '8px 10px', fontSize: '0.82em', color: '#ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <div style={{ fontWeight: 'bold', color: '#eee', marginBottom: 6 }}>{f.nom} ({f.num + 1})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={lbl}>Position</td><td style={{ textAlign: 'right' }}><Position pos={f.pos} /></td></tr>
                {f.direction && <tr><td style={lbl}>Direction</td><td style={{ textAlign: 'right' }}><Position pos={f.direction} /></td></tr>}
                <tr><td style={lbl}>Vitesse</td><td style={{ textAlign: 'right' }}>{f.vitesse}</td></tr>
                {f.directive ? <tr><td style={lbl}>Directive</td><td style={{ textAlign: 'right' }}>{String(f.directive)}</td></tr> : null}
                <tr><td style={lbl}>AS / AP</td><td style={{ textAlign: 'right' }}>{f.as ?? 0} / {f.ap ?? 0}</td></tr>
                <tr><td style={lbl}>Scan</td><td style={{ textAlign: 'right' }}>{f.scan}</td></tr>
                <tr><td style={lbl}>Vaisseaux</td><td style={{ textAlign: 'right' }}>{f.nbVso}</td></tr>
                {typeof f.dist === 'number' && f.dist > 0 && (
                  <tr><td style={lbl}>Distance</td><td style={{ textAlign: 'right' }}>{f.dist} {f.reachable ? '(atteignable ce tour)' : '(hors de portée)'}</td></tr>
                )}
              </tbody>
            </table>
            {compEntries.length > 0 && (
              <div style={{ marginTop: 6, borderTop: '1px solid #333', paddingTop: 6 }}>
                {compEntries.slice(0, 8).map(([type, nb]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{type}</span><span>× {nb}</span></div>
                ))}
                {compEntries.length > 8 && <div style={{ color: '#888' }}>… +{compEntries.length - 8} autres</div>}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function CombatCard({combat}: { combat: CombatEvent }) {
  const [open, setOpen] = useState(false);
  const isSpatial = combat.kind === 'spatial';

  return (
    <div className={`combat-card combat-card--${combat.kind}`}>
      <button
        type="button"
        className="combat-card-header"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className={`combat-kind-badge combat-kind-badge--${combat.kind}`}>
          {isSpatial ? 'S' : 'P'} {combatKindLabel(combat.kind)}
        </span>
        <span className="combat-card-toggle">{open ? '▼' : '▶'}</span>
      </button>
      <div className="combat-card-summary">
        {combat.summary && <p className="combat-summary-line">{combat.summary}</p>}
        {combat.systemName && (
          <div><strong>Système :</strong> {combat.systemName}</div>
        )}
        {combat.playerFleet && (
          <div><strong>Votre flotte :</strong> {combat.playerFleet}</div>
        )}
        {isSpatial && combat.enemyFleet && (
          <div><strong>Adversaire :</strong> {combat.enemyFleet}
            {combat.enemyCommander ? ` (${combat.enemyCommander})` : ''}
          </div>
        )}
        {!isSpatial && combat.planetsCaptured != null && (
          <div><strong>Planètes prises :</strong> {combat.planetsCaptured}</div>
        )}
      </div>
      {open && (
        <div className="combat-card-details">
          {combat.details.map((block, i) => {
            const text = formatCombatDetailText(block);
            if (!text && !isCombatTableHtml(block.html)) return null;
            return (
              <div key={i} className="combat-detail-block">
                {isCombatTableHtml(block.html) ? (
                  <div
                    className="combat-detail-html"
                    dangerouslySetInnerHTML={{__html: block.html}}
                  />
                ) : (
                  <p>{text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
