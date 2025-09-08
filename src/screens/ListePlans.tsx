import React, { useMemo, useState, useCallback } from 'react';
import Commandant from '../components/utils/Commandant';
import { useReport } from '../context/ReportContext';
import { PlanVaisseau, Technologie } from '../types';
import { useNavigate } from 'react-router-dom';

type SortKey = 'nom' | 'concepteur' | 'marque' | 'tour' | 'taille' | 'vitesse' | 'pc' | 'minerai' | 'prix' | 'composants';
type SortDir = 'asc' | 'desc';

type Row = PlanVaisseau & { typeSrc: 'public' | 'prive'; compStr: string };

function CreatePlanButton() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/plans/creer')} className="badge" style={{ background: '#2b5', color: '#fff' }}>
      Créer un plan de vaisseau
    </button>
  );
}

export default function ListePlans() {
  const { global, rapport } = useReport();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [filterType, setFilterType] = useState<'all' | 'public' | 'prive'>('all');
  const [filterQ, setFilterQ] = useState('');

  const techLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    (global?.technologies ?? []).forEach((t: Technologie) => map.set(t.code, t.nom));
    return map;
  }, [global]);

  const withCompStr = useCallback((p: PlanVaisseau): string => {
    const comps = p.composants || [];
    return comps
      .map(c => {
        const label = techLabelByCode.get(c.code) ?? c.code;
        return `${label}: ${c.nb}`;
      })
      .join(', ');
  }, [techLabelByCode]);

  const rows: Row[] = useMemo(() => {
    const pub = (global?.plansPublic ?? []).map< Row >(p => ({ ...p, typeSrc: 'public', compStr: withCompStr(p) }));
    const pri = (rapport?.plansVaisseaux ?? []).map< Row >(p => ({ ...p, typeSrc: 'prive', compStr: withCompStr(p) }));
    return [...pub, ...pri];
  }, [global, rapport, withCompStr]);

  const filtered = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    return rows.filter(r => {
      if (filterType !== 'all' && r.typeSrc !== filterType) return false;
      if (q) {
        const hay = [
          r.nom || '',
          r.concepteur || '',
          r.marque || '',
          String(r.tour ?? ''),
          String(r.taille ?? ''),
          String(r.vitesse ?? ''),
          r.compStr || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterType, filterQ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: Row, b: Row) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'nom': av = (a.nom || '').toLowerCase(); bv = (b.nom || '').toLowerCase(); break;
        case 'concepteur': av = (a.concepteur || 0); bv = (b.concepteur || 0); break;
        case 'marque': av = (a.marque || '').toLowerCase(); bv = (b.marque || '').toLowerCase(); break;
        case 'tour': av = a.tour ?? -1; bv = b.tour ?? -1; break;
        case 'taille': av = a.taille ?? -1; bv = b.taille ?? -1; break;
        case 'vitesse': av = a.vitesse ?? -1; bv = b.vitesse ?? -1; break;
        case 'pc': av = a.pc ?? -1; bv = b.pc ?? -1; break;
        case 'minerai': av = a.minerai ?? -1; bv = b.minerai ?? -1; break;
        case 'prix': av = a.prix ?? -1; bv = b.prix ?? -1; break;
        case 'composants': av = a.compStr.toLowerCase(); bv = b.compStr.toLowerCase(); break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    };
    arr.sort(cmp);
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, maxPage);
  const start = (curPage - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  function onSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
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

  return (
    <div style={{ padding: 12, overflow: 'auto', width: 'calc(100% - 20px)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3>Plans de vaisseaux</h3>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <label>
          Type:
          <select value={filterType} onChange={e => { setFilterType(e.target.value as any); setPage(1); }} style={{ marginLeft: 6 }}>
            <option value="all">Tous</option>
            <option value="public">Publics</option>
            <option value="prive">Privés</option>
          </select>
        </label>
        <label style={{ flex: 1, minWidth: 260 }}>
          Recherche:
          <input
            type="text"
            value={filterQ}
            onChange={e => { setFilterQ(e.target.value); setPage(1); }}
            placeholder="Nom, concepteur, marque, composants..."
            style={{ marginLeft: 6, width: '100%' }}
          />
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
        <div style={{ flex: '0 0 auto' }}>
          <CreatePlanButton />
        </div>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {header('nom', 'Nom')}
              {header('concepteur', 'Concepteur')}
              {header('marque', 'Marque')}
              {header('tour', 'Tour')}
              {header('taille', 'Taille')}
              {header('vitesse', 'Vitesse')}
              {header('pc', 'PC')}
              {header('minerai', 'Minerai')}
              {header('prix', 'Prix')}
              {header('composants', 'Composants')}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p, idx) => (
              <tr key={`${p.typeSrc}-${p.nom}-${idx}`}>
                <td>{p.nom}</td>
                <td><Commandant num={p.concepteur} /></td>
                <td>{p.marque ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.tour ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.taille ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.vitesse ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.pc ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.minerai ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{typeof p.prix === 'number' ? p.prix.toFixed(1) : '—'}</td>
                <td style={{ whiteSpace: 'normal' }}>{p.compStr || '—'}</td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 12, color: '#aaa' }}>
                  {(global || rapport) ? 'Aucun plan ne correspond aux filtres.' : 'Chargez les données pour voir les plans.'}
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
