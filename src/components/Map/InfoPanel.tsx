import React, {useMemo} from 'react';
import {useReport} from '../../context/ReportContext';
import {XY} from '../../types';
import Commandant from "../utils/Commandant";

type Props = {
  selected?: XY;
};

export default function InfoPanel({ selected }: Props) {
  const { rapport } = useReport();

  const atPos = useMemo(() => {
    if (!selected || !rapport) return { systems: [], fleets: [] as any[] };
    const systems = [
      ...rapport.systemesJoueur.filter(s => s.pos.x === selected.x && s.pos.y === selected.y),
      ...rapport.systemesDetectes.filter(s => s.pos.x === selected.x && s.pos.y === selected.y),
    ];
    const fleets = [
      ...rapport.flottesJoueur.filter(f => f.pos.x === selected.x && f.pos.y === selected.y),
      ...rapport.flottesDetectees.filter(f => f.pos.x === selected.x && f.pos.y === selected.y),
    ];
    return { systems, fleets };
  }, [selected, rapport]);

  // Hooks déclarés inconditionnellement
  const [fltSort, setFltSort] = React.useState<{ key: 'nom' | 'vitesse' | 'as' | 'ap', dir: 'asc' | 'desc' }>({ key: 'nom', dir: 'asc' });
  const [fltFilter, setFltFilter] = React.useState<string>('');

  const system = useMemo(() => {
    return atPos.systems[0];
  }, [atPos.systems]);

  const fltRows = useMemo(() => {
    const rows = [...atPos.fleets].filter((f: any) => f.nom.toLowerCase().includes(fltFilter.trim().toLowerCase()));
    rows.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (fltSort.key) {
        case 'nom': av = a.nom.toLowerCase(); bv = b.nom.toLowerCase(); break;
        case 'vitesse': av = a.vitesse ?? 0; bv = b.vitesse ?? 0; break;
        case 'as': av = a.as ?? 0; bv = b.as ?? 0; break;
        case 'ap': av = a.ap ?? 0; bv = b.ap ?? 0; break;
      }
      if (av < bv) return fltSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return fltSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [atPos.fleets, fltFilter, fltSort]);

  if (!selected) {
    return <div className="carte-info">Cliquez sur une case de la carte pour voir le détail.</div>;
  }

  function sortHeader(label: string, cur: any, setter: any, key: any) {
    const active = cur.key === key;
    return (
      <th
        onClick={() => setter((s: any) => ({ key, dir: active && s.dir === 'asc' ? 'desc' : 'asc' }))}
        style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {label} {active ? (cur.dir === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  }

  return (
    <div className="carte-info">
      <div className="info-block">
        <h3>Case {selected.x}-{selected.y}</h3>
      </div>

      <div className="info-block">
        <h4>Systèmes</h4>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            <th>Nom</th>
            <th>Planètes</th>
            <th>Commandants</th>
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
            </tr>
          ) : (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucun système ici.</td></tr>
          )}
          </tbody>
        </table>
      </div>

      <div className="info-block">
        <h4>Flottes</h4>
        <div style={{ marginBottom: 6 }}>
          <input
            type="text"
            placeholder="Filtrer par nom…"
            value={fltFilter}
            onChange={e => setFltFilter(e.target.value)}
          />
        </div>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            {sortHeader('Nom', fltSort, setFltSort, 'nom')}
            {sortHeader('Vitesse', fltSort, setFltSort, 'vitesse')}
            {sortHeader('AS', fltSort, setFltSort, 'as')}
            {sortHeader('AP', fltSort, setFltSort, 'ap')}
          </tr>
          </thead>
          <tbody>
          {fltRows.map((f: any, i: number) => (
            <tr key={`flt-${i}`}>
              <td>{f.nom}</td>
              <td style={{ textAlign: 'right' }}>{f.vitesse ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{f.as ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{f.ap ?? '—'}</td>
            </tr>
          ))}
          {fltRows.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucune flotte ici.</td></tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
