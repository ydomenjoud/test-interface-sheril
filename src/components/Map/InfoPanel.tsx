import React, {useMemo, useState} from 'react';
import {useReport} from '../../context/ReportContext';
import {FlotteBase, FlotteDetectee, FlotteJoueur, XY, Note} from '../../types';
import Commandant from "../utils/Commandant";
import Position from "../utils/Position";
import {getDescriptionPuissance, getPuissance, getPuissanceFromString} from "../../utils/puissance";
import { NavLink } from 'react-router-dom';

type Props = {
  selected?: XY;
};

export default function InfoPanel({ selected }: Props) {
  const { rapport, global, notes, addNote, deleteNote, allTags } = useReport();
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState('#ffcc00');
  const [noteTag, setNoteTag] = useState('');

  const atPos = useMemo(() => {
    if (!selected) return { systems: [], fleets: [] as any[] };
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

    return { systems, fleets };
  }, [selected, rapport, global]);

  const system = useMemo(() => {
    return atPos.systems[0];
  }, [atPos.systems]);

  const isOwner = useMemo(() => system?.proprietaires?.some((p: any) => p === rapport?.joueur?.numero), [system, rapport])

  const currentNotes = useMemo(() => {
    if (!selected) return [];
    return notes[`${selected.x}_${selected.y}`] || [];
  }, [selected, notes]);

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
        <h3>Case <Position pos={selected} /></h3>
      </div>

      <div className="info-block">
        <h4>Systèmes</h4>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            <th>Nom</th>
            <th>Planètes</th>
            <th>Commandants</th>
            { isOwner &&<th></th>}
          </tr>
          </thead>
          <tbody>
          {system ? (
            <tr>
              <td>{system.nom}</td>
              <td style={{ textAlign: 'right' }}>{system.nbPla ?? '—'}</td>
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
                <td style={{ textAlign: 'right' }}>{puissanceDesc}</td>
              </tr>
            );
          })}
          {atPos.fleets.length === 0 && (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucune flotte ici.</td></tr>
          )}
          </tbody>
        </table>
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
