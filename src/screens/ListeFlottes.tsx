import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import Commandant from "../components/utils/Commandant";

type SortKey = 'pos' | 'nom' | 'direction' | 'directive' | 'vitesse' | 'as' | 'ap' | 'nbv' | 'proprio';
type SortDir = 'asc' | 'desc';

export default function ListeFlottes() {
  const { rapport } = useReport();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterNom, setFilterNom] = useState('');
  const [filterProprio, setFilterProprio] = useState<string>('all');

  const currentId = rapport?.joueur.numero || 0;

  const all = useMemo(() => {
    if (!rapport) return [];
    const own = rapport.flottesJoueur.map(f => ({
      ...f,
      proprio: currentId,
      nbv: f.vaisseaux?.length ?? 0,
      posKey: f.pos.x * 1000 + f.pos.y,
    }));
    const det = rapport.flottesDetectees.map(f => ({
      ...f,
      nbv: f.nbVso ?? 0,
      posKey: f.pos.x * 1000 + f.pos.y,
    }));
    return [...own, ...det];
  }, [rapport, currentId]);

  const filtered = useMemo(() => {
    const q = filterNom.trim().toLowerCase();
    return all.filter(f => {
      if (filterProprio !== 'all' && String((f as any).proprio ?? '') !== filterProprio) return false;
      if (q && !(f.nom?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, filterNom, filterProprio]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'pos': av = a.posKey; bv = b.posKey; break;
        case 'nom': av = a.nom.toLowerCase(); bv = b.nom.toLowerCase(); break;
        case 'direction': av = a.direction || ''; bv = b.direction || ''; break;
        case 'directive': av = String(a.directive ?? ''); bv = String(b.directive ?? ''); break;
        case 'vitesse': av = a.vitesse ?? 0; bv = b.vitesse ?? 0; break;
        case 'as': av = a.as ?? 0; bv = b.as ?? 0; break;
        case 'ap': av = a.ap ?? 0; bv = b.ap ?? 0; break;
        case 'nbv': av = a.nbv ?? 0; bv = b.nbv ?? 0; break;
        case 'proprio': av = a.proprio ?? 0; bv = b.proprio ?? 0; break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, maxPage);
  const start = (curPage - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  function onSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }
  function header(k: SortKey, label: string) {
    const active = sortKey === k;
    return (
      <th onClick={() => onSort(k)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  }

  if (!rapport) return <div style={{ padding: 16 }}>Chargez les données pour voir la liste des flottes.</div>;

  return (
    <div style={{ padding: 12, overflow: 'auto', width: '100%', height: 'calc(100% - 20px)', display: 'flex', flexDirection: 'column' }}>
      <h3>Flottes</h3>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ flex: 1, minWidth: 240 }}>
          Nom:
          <input
            type="text"
            value={filterNom}
            onChange={e => { setFilterNom(e.target.value); setPage(1); }}
            placeholder="Filtrer par nom…"
            style={{ marginLeft: 6, width: '100%' }}
          />
        </label>
        <label>
          Propriétaire:
          <select value={filterProprio} onChange={e => { setFilterProprio(e.target.value); setPage(1); }} style={{ marginLeft: 6 }}>
            <option value="all">Tous</option>
            <option value={String(currentId)}>{`Joueur (${currentId || '—'})`}</option>
            {/* valeurs fréquentes optionnelles; laisser “all” sinon */}
          </select>
        </label>
        <label>
          Par page:
          <select
            value={pageSize}
            onChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
            style={{ marginLeft: 6 }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {header('pos', 'Position')}
              {header('nom', 'Nom')}
              {header('direction', 'Direction')}
              {header('directive', 'Directive')}
              {header('vitesse', 'Vitesse')}
              {header('as', 'AS')}
              {header('ap', 'AP')}
              {header('nbv', 'Vaisseaux')}
              {header('proprio', 'Propriétaire')}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((f: any, i) => (
              <tr key={`${f.type}-${f.num}-${i}`}>
                <td style={{ whiteSpace: 'nowrap' }}>{f.pos.x}-{f.pos.y}</td>
                <td>{f.nom}</td>
                <td>{f.direction ?? '—'}</td>
                <td>{f.directive ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{f.vitesse ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{f.as ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{f.ap ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{f.nbv ?? '—'}</td>
                <td style={{ textAlign: 'right' }}><Commandant num={f.proprio || 0} /></td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 12, color: '#aaa' }}>
                  Aucune flotte ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <button disabled={curPage <= 1} onClick={() => setPage(1)}>{'<<'}</button>
        <button disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{'<'}</button>
        <span>Page {curPage} / {maxPage} — {total} éléments</span>
        <button disabled={curPage >= maxPage} onClick={() => setPage(p => Math.min(maxPage, p + 1))}>{'>'}</button>
        <button disabled={curPage >= maxPage} onClick={() => setPage(maxPage)}>{'>>'}</button>
      </div>
    </div>
  );
}
