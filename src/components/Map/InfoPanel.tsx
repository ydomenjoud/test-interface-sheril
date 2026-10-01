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
import {getDescriptionPuissance, getPuissance, getPuissanceFromString} from "../../utils/puissance";
import { NavLink } from 'react-router-dom';
import ZoneEditor from './ZoneEditor';
import { zoneCovers } from '../../utils/zones';
import { isObserved, lastKnownFleets } from '../../utils/fleetHistory';
import { fleetSnapshotOf } from '../../storage/rapportStore';

type Props = {
  selected?: XY;
};

// Ligne issue d'un tour précédent : texte grisé et icône d'avertissement à côté du nom
const staleRowStyle: React.CSSProperties = { color: '#999' };
const StaleIcon = () => (
  <span title="Information d'un tour précédent, peut-être obsolète" style={{ marginRight: 6, color: '#ffb000', cursor: 'help' }}>⚠</span>
);



export default function InfoPanel({ selected }: Props) {
  const { rapport, global, notes, addNote, deleteNote, allTags, publicCombats, zones, zoneLabels, fleetSnapshots } = useReport();

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

  const [sortField, setSortField] = useState<'dist' | 'num'>('dist');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === valB) return 0;
      const res = valA < valB ? -1 : 1;
      return sortOrder === 'asc' ? res : -res;
    });

    return { systems, fleets, playerFleets };
  }, [selected, rapport, global, sortField, sortOrder]);

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

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noteText.trim()) return;
    addNote(selected, noteText, noteColor, noteTag.trim() || undefined);
    setNoteText('');
    setNoteTag('');
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

      <div className="info-block">
        <h4>Systèmes</h4>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            <th>Nom</th>
            <th>Planètes</th>
            <th>Population</th>
            <th>Commandants</th>
            { isOwner &&<th></th>}
          </tr>
          </thead>
          <tbody>
          {system ? (
            <tr style={staleTour !== undefined ? staleRowStyle : undefined}>
              <td>
                {staleTour !== undefined && <StaleIcon />}
                {system.nom}
              </td>
              <td style={{ textAlign: 'right' }}>{system.nbPla ?? '—'}</td>
                <td>{system.pop}/{system.popMax}</td>
              <td style={{ textAlign: 'right' }}>
                {Array.isArray(system.proprietaires) && system.proprietaires.length
                  ? system.proprietaires.map((p: number, key: number) => <Commandant num={p} key={key} />)
                  : '—'}
              </td>
              { isOwner && <td className='app-nav'><NavLink  to={`/player-system-detail/${selected.x}-${selected.y}`}>détails {isOwner}</NavLink></td> }
            </tr>
          ) : (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucun système ici.</td></tr>
          )}
          </tbody>
        </table>
      </div>

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
              <tr key={`flt-${i}`}>
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
          {atPos.fleets.length === 0 && !pastFleets && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucune flotte ici.</td></tr>
          )}
          </tbody>
        </table>
      </div>

      {atPos.playerFleets.length > 0 && (
        <div className="info-block">
          <h4>Mes flottes</h4>
          <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => {
                  if (sortField === 'num') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortField('num'); setSortOrder('asc'); }
                }}
              >
                Nom {sortField === 'num' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => {
                  if (sortField === 'dist') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortField('dist'); setSortOrder('asc'); }
                }}
              >
                Distance {sortField === 'dist' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th>Vitesse</th>
              <th>AS / AP</th>
              <th>Position</th>
            </tr>
            </thead>
            <tbody>
            {atPos.playerFleets.map((f: any, i: number) => {
              const isHere = f.pos.x === selected.x && f.pos.y === selected.y;
              const rowStyle = !f.reachable && !isHere ? { opacity: 0.5, color: '#ffa500' } : {};
              return (
                <tr key={`player-flt-${i}`} style={rowStyle}>
                  <td>{f.nom} ({f.num+1})</td>
                  <td style={{ textAlign: 'right' }}>{isHere ? '—' : f.dist}</td>
                  <td style={{ textAlign: 'right' }}>{f.vitesse}</td>
                  <td style={{ textAlign: 'right' }}>{f.as ?? 0} / {f.ap ?? 0}</td>
                  <td style={{ textAlign: 'right' }}><Position pos={f.pos} /></td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}
      <div className="info-block">
        <h4>Combats</h4>
        <p className="combat-legend">
          <span className="combat-legend-spatial">S</span> spatial (bas-gauche)
          <span className="combat-legend-planetary">P</span> planétaire (haut-gauche)
        </p>
        {cellCombats.length > 0 ? (
          <div className="combat-list">
            {cellCombats.map((combat) => (
              <CombatCard key={combat.id} combat={combat} />
            ))}
          </div>
        ) : (
          <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em' }}>
            Aucun combat signalé sur cette case.
          </div>
        )}
      </div>

      <div className="info-block">
        <h4>Zones</h4>
        {zonesHere.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {zonesHere.map(z => <ZoneEditor key={z.id} zone={z} />)}
            <datalist id="zone-editor-labels">
              {zoneLabels.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
        ) : (
          <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em' }}>Aucune zone sur cette case (Alt + clic + glisser pour en tracer une).</div>
        )}
      </div>

      <div className="info-block">
        <h4>Notes</h4>
        <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
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
            <button type="submit" style={{ padding: '4px 12px' }}>Ajouter</button>
          </div>
        </form>

        {currentNotes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em' }}>Aucune note pour cette case.</div>
        )}
      </div>
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
