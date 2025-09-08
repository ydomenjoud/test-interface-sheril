import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import { Technologie } from '../types';

type SortKey = 'connu' | 'type' | 'nom' | 'recherche' | 'description' | 'marchandises' | 'caracteristiques' | 'parents';
type SortDir = 'asc' | 'desc';

function typeLabel(t: 0 | 1) {
  return t === 0 ? 'Bâtiment' : 'Composant';
}

// Helpers affichage niveau en chiffres romains (niv est 0-based)
function toRoman(n: number): string {
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  if (n <= 0) return romans[0];
  if (n >= romans.length) return romans[romans.length - 1];
  return romans[n];
}
function romanFromNiv(niv?: number): string {
  // niv 0 => 1 => I, niv 4 => 5 => V ; cap à X
  const lvl = Math.max(1, Math.min(10, ((niv ?? 0) + 1)));
  return toRoman(lvl);
}
function formatTechName(t?: Technologie): string {
  if (!t) return '';
  return `${t.nom} ${romanFromNiv(t.niv)}`;
}

export default function ListeTechnologies() {
  const { global, rapport } = useReport();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [filterConnu, setFilterConnu] = useState<'all' | 'connues' | 'inconnues'>('all');
  const [filterType, setFilterType] = useState<'all' | 'batiment' | 'composant'>('all');
  const [filterNom, setFilterNom] = useState('');

  // Tous les hooks sont appelés inconditionnellement
  const knownSet = useMemo(() => {
    const set = new Set<string>();
    (rapport?.technologiesConnues ?? []).forEach(c => set.add(c.toLowerCase()));
    return set;
  }, [rapport]);

  const withDerived = useMemo(() => {
    const list = global?.technologies ?? [];
    const marchMap = new Map<number, string>();
    (global?.marchandises ?? []).forEach(m => marchMap.set(m.code, m.nom));
    return list.map(t => {
      const connu = knownSet.has(t.code);
      const caracStr = (t.caracteristiques || [])
        .map(c => {
          const label = t.type === 1 ? global?.caracteristiquesComposant[c.code] : global?.caracteristiquesBatiment[c.code];
          return `${label ?? c.code}:${c.value}`;
        }).join(', ');
      const parentsStr = (t.parents || []).join(', ');
      const marchStr = (t.marchandises || [])
        .map(m => `${marchMap.get(m.code) ?? m.code}: ${m.nb}`)
        .join(', ');
      return { ...t, connu, caracStr, parentsStr, marchStr };
    });
  }, [global, knownSet]);

  const filtered = useMemo(() => {
    const q = filterNom.trim().toLowerCase();
    return withDerived.filter(t => {
      if (filterConnu === 'connues' && !t.connu) return false;
      if (filterConnu === 'inconnues' && t.connu) return false;
      if (filterType === 'batiment' && t.type !== 0) return false;
      if (filterType === 'composant' && t.type !== 1) return false;
      if (q && !(t.nom?.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [withDerived, filterConnu, filterType, filterNom]);

  const [parentFilters, setParentFilters] = useState<string[]>([]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'connu': av = a.connu ? 1 : 0; bv = b.connu ? 1 : 0; break;
        case 'type': av = a.type; bv = b.type; break;
        case 'nom': av = (a.nom || '').toLowerCase(); bv = (b.nom || '').toLowerCase(); break;
        case 'recherche': av = a.recherche ?? 0; bv = b.recherche ?? 0; break;
        case 'description': av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase(); break;
        case 'marchandises': av = (a.marchStr || '').toLowerCase(); bv = (b.marchStr || '').toLowerCase(); break;
        case 'caracteristiques': av = a.caracStr.toLowerCase(); bv = b.caracStr.toLowerCase(); break;
        case 'parents': av = a.parentsStr.toLowerCase(); bv = b.parentsStr.toLowerCase(); break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    };
    arr.sort(cmp);
    return arr;
  }, [filtered, sortKey, sortDir]);

  const byParentsOrSorted = useMemo(() => {
    if (!parentFilters.length) return sorted;
    const set = new Set(parentFilters);
    return sorted.filter(t => set.has(t.code));
  }, [sorted, parentFilters]);

  const total = sorted.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, maxPage);
  const start = (curPage - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  function onSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  }

  function header(k: SortKey, label: string) {
    const active = sortKey === k;
    return (
      <th onClick={() => onSort(k)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  }

  const rowStyle = (t: Technologie & { connu: boolean }) =>
    t.connu ? { background: '#0f3d0f33' } : { background: '#ffa50022' };

  return (
    <div style={{ padding: 12, overflow: 'auto', width: '100%', height: 'calc(100%-20px)', display: 'flex', flexDirection: 'column' }}>
      <h3>Technologies</h3>
      {!global && (
        <div style={{ marginBottom: 8, color: '#a66' }}>Chargement des données globales…</div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        {parentFilters.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>Filtres parents:</span>
            {parentFilters.map((code) => (
              <span key={code} className="badge" style={{ background: '#235', color: '#ddd' }}>
                {(() => {
                  const tt = global?.technologies.find(t => t.code === code);
                  return tt ? formatTechName(tt) : code;
                })()}
                <button
                  onClick={() => setParentFilters(p => p.filter(c => c !== code))}
                  style={{ marginLeft: 6 }}
                  aria-label="retirer"
                  title="Retirer"
                >
                  ×
                </button>
              </span>
            ))}
            <button onClick={() => setParentFilters([])}>Effacer</button>
          </div>
        )}
        <label>
          Connu:
          <select value={filterConnu} onChange={e => { setFilterConnu(e.target.value as any); setPage(1); }} style={{ marginLeft: 6 }}>
            <option value="all">Tous</option>
            <option value="connues">Connues</option>
            <option value="inconnues">Inconnues</option>
          </select>
        </label>
        <label>
          Type:
          <select value={filterType} onChange={e => { setFilterType(e.target.value as any); setPage(1); }} style={{ marginLeft: 6 }}>
            <option value="all">Tous</option>
            <option value="batiment">Bâtiment</option>
            <option value="composant">Composant</option>
          </select>
        </label>
        <label style={{ flex: 1, minWidth: 220 }}>
          Nom:
          <input
            type="text"
            value={filterNom}
            onChange={e => { setFilterNom(e.target.value); setPage(1); }}
            placeholder="Filtrer par nom ou code…"
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
      </div>

      <div style={{ overflow: 'auto' }}>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {header('connu', 'Connu')}
              {header('type', 'Type')}
              {header('nom', 'Nom')}
              {header('recherche', 'Recherche')}
              {header('description', 'Description')}
              {header('marchandises', 'Marchandises')}
              {header('caracteristiques', 'Caractéristiques')}
              {header('parents', 'Parents')}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const total = byParentsOrSorted.length;
              const maxPage = Math.max(1, Math.ceil(total / pageSize));
              const curPage = Math.min(page, maxPage);
              const start = (curPage - 1) * pageSize;
              const pageItems2 = byParentsOrSorted.slice(start, start + pageSize);

              return pageItems2.map((t) => {
                const carac = t.caracteristiques?.map((c, i) => {
                  const label = t.type === 1 ? global?.caracteristiquesComposant[c.code] : global?.caracteristiquesBatiment[c.code];
                  let value = c.value+'';
                  switch(c.code) {
                      case 7:
                          value = global?.marchandises.find(m => m.code === c.code)?.nom || c.value+'';
                  }
                  return (
                    <span key={i} className="badge" >
                      {(label ?? c.code)} : <span className={'information'}>{value}</span>
                    </span>
                  );
                });

                const marchContent = (t.marchandises && t.marchandises.length)
                  ? t.marchandises.map((m, i) => {
                      const nom = global?.marchandises.find(mm => mm.code === m.code)?.nom ?? String(m.code);
                      return (
                        <span key={i} className="badge" title={`code ${m.code}`}>
                            {nom}: <span className={'information'}>{m.nb}</span>
                        </span>
                      );
                    })
                  : '';

                const parentsContent = t.parents?.length
                  ? t.parents.map((code, idx) => {
                      const pTech = global?.technologies.find(tt => tt.code === code);
                      const name = pTech ? formatTechName(pTech) : code;
                      return (
                        <span
                          key={code}
                          onClick={() => setParentFilters(arr => arr.includes(code) ? arr : [...arr, code])}
                          title="Cliquer pour filtrer par cette technologie"
                          style={{ cursor: 'pointer', textDecoration: 'underline', marginRight: 6 }}
                        >
                          {name}{idx < t.parents.length - 1 ? ',' : ''}
                        </span>
                      );
                    })
                  : '';

                return (
                  <tr key={t.code} style={rowStyle(t as any)}>
                    <td>{(t as any).connu ? 'Oui' : 'Non'}</td>
                    <td>{typeLabel(t.type)}</td>
                    <td title={t.code} style={{ whiteSpace: 'nowrap' }}>{formatTechName(t)}</td>
                    <td style={{ textAlign: 'right' }}>{t.recherche}</td>
                    <td>
                      <span
                          className={'information'}
                          style={{ fontSize: '0.8rem' }}
                        dangerouslySetInnerHTML={{ __html: t.description ?? '' }}
                      />
                    </td>
                    <td>
                      {marchContent}
                    </td>
                    <td>{carac}</td>
                    <td>{parentsContent}</td>
                  </tr>
                );
              });
            })()}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 12, color: '#aaa' }}>
                  {global ? 'Aucune technologie ne correspond aux filtres.' : 'Chargement…'}
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
