import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import Commandant from "../components/utils/Commandant";
import {commandantAsString} from "../utils/commandant";
import Position from "../components/utils/Position";
import { calculateFleetCombatStats } from '../utils/fleetCombat';
import { FlotteJoueur } from '../types';

// 1. Added shield and shieldPerCase to SortKey
type SortKey = 'pos' | 'nom' | 'direction' | 'directive' | 'vitesse' | 'as' | 'ap' | 'nbv' | 'proprio' | 'dc' | 'db' | 'shield' | 'cases' | 'dcPerCase' | 'dbPerCase' | 'shieldPerCase' | 'exp' | 'moral' | 'equipage' | 'heros' | 'cdt' | 'cdt3' | 'cdt7';
type SortDir = 'asc' | 'desc';

// 2. Added to Column lists
const ALL_COLUMNS: SortKey[] = ['pos', 'nom', 'direction', 'directive', 'vitesse', 'as', 'ap', 'nbv', 'proprio', 'dc', 'db', 'shield', 'cases', 'dcPerCase', 'dbPerCase', 'shieldPerCase', 'exp', 'moral', 'equipage', 'heros', 'cdt', 'cdt3', 'cdt7'];
const COMBAT_COLUMNS = ['dc', 'db', 'shield', 'cdt', 'cdt3', 'cdt7', 'cases', 'dcPerCase', 'dbPerCase', 'shieldPerCase'];

const DIRECTIVE_LABELS: Record<number, string> = {
  0: "Neutre",
  1: "Attaque Système",
  2: "Attaque Préventive",
  3: "Attaque Toutes Flottes",
  4: "Pillage Système",
  5: "Attaque Planète",
  6: "Pillage Planète",
  7: "Éradication Planète",
  8: "Attaque Joueur",
};

const DIRECTIVE_COLORS: Record<number, string> = {
  0: "#aaa",       // Grey for Neutral
  1: "#ff4d4d",    // Red for Attacks
  2: "#ff4d4d",
  3: "#ff4d4d",
  4: "#ffa500",    // Orange for Pillage
  5: "#ff4d4d",
  6: "#ffa500",
  7: "#ff0000",    // Bright Red for Eradication
  8: "#ff4d4d",
};

export default function ListeFlottes() {
  const { rapport, global} = useReport();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMNS);
  const [filterNom, setFilterNom] = useState('');
  const [filterProprios, setFilterProprios] = useState<string[]>([]);

  const currentId = rapport?.joueur.numero || 0;

  const commandantOptions = useMemo(() => {
    const set = new Set<number>();
    if (currentId) set.add(currentId);
    (rapport?.flottesDetectees ?? []).forEach(f => {
      if (typeof f.proprio === 'number') set.add(f.proprio);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rapport, currentId]);

  const all = useMemo(() => {
    if (!rapport || !global) return [];
    const own = rapport.flottesJoueur.map(f => {
      const lieutenantForFleet =
        rapport.lieutenants.find(l => /^\d+$/.test(l.pos) && Number(l.pos) === f.num) || null;
      const stats = calculateFleetCombatStats(f as FlotteJoueur, rapport.plansVaisseaux, global, lieutenantForFleet);
      return {
        ...f,
        ...stats,
        nbv: f.nbVso ?? 0,
        posKey: f.pos.x * 1000 + f.pos.y,
      };
    });
    const det = rapport.flottesDetectees.map(f => ({
      ...f,
      nbv: f.nbVso ?? 0,
      posKey: f.pos.x * 1000 + f.pos.y,
    }));
    return [...own, ...det];
  }, [rapport, global]);

  const filtered = useMemo(() => {
    const q = filterNom.trim().toLowerCase();
    const selected = new Set(filterProprios);
    return all.filter(f => {
      if (selected.size > 0 && !selected.has(String((f as any).proprio ?? ''))) return false;
      if (q && !(f.nom?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, filterNom, filterProprios]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'pos': av = a.posKey; bv = b.posKey; break;
        case 'nom': av = a.nom.toLowerCase(); bv = b.nom.toLowerCase(); break;
        case 'direction': av = a.direction || ''; bv = b.direction || ''; break;
        case 'directive': av = DIRECTIVE_LABELS[a.directive] ?? ''; bv = DIRECTIVE_LABELS[b.directive] ?? ''; break;
        case 'vitesse': av = a.vitesse ?? 0; bv = b.vitesse ?? 0; break;
        case 'as': av = a.as ?? 0; bv = b.as ?? 0; break;
        case 'ap': av = a.ap ?? 0; bv = b.ap ?? 0; break;
        case 'nbv': av = a.nbv ?? 0; bv = b.nbv ?? 0; break;
        case 'proprio': av = a.proprio ?? 0; bv = b.proprio ?? 0; break;
        case 'dc': av = a.dc ?? 0; bv = b.dc ?? 0; break;
        case 'db': av = a.db ?? 0; bv = b.db ?? 0; break;
        case 'shield': av = a.shield ?? 0; bv = b.shield ?? 0; break; // 3. Sorting logic
        case 'cases': av = a.cases ?? 0; bv = b.cases ?? 0; break;
        case 'dcPerCase': av = a.dcPerCase ?? 0; bv = b.dcPerCase ?? 0; break;
        case 'dbPerCase': av = a.dbPerCase ?? 0; bv = b.dbPerCase ?? 0; break;
        case 'shieldPerCase': av = a.shieldPerCase ?? 0; bv = b.shieldPerCase ?? 0; break; // 3. Sorting logic
        case 'cdt': av = a.cdt ?? 0; bv = b.cdt ?? 0; break;
        case 'cdt3': av = a.cdt3 ?? 0; bv = b.cdt3 ?? 0; break;
        case 'cdt7': av = a.cdt7 ?? 0; bv = b.cdt7 ?? 0; break;
        case 'exp': av = a.exp ?? 0; bv = b.exp ?? 0; break;
        case 'moral': av = a.moral ?? 0; bv = b.moral ?? 0; break;
        case 'equipage': av = a.equipage?.map((e: { nom: string; couleur: string }) => e.nom).join(', ') ?? ''; bv = b.equipage?.map((e: { nom: string; couleur: string }) => e.nom).join(', ') ?? ''; break;
        case 'heros': av = a.heros ?? ''; bv = b.heros ?? ''; break;
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
        <div>
          <button onClick={() => setVisibleColumns(prev => {
            const next = new Set(prev);
            if (COMBAT_COLUMNS.every(c => next.has(c))) COMBAT_COLUMNS.forEach(c => next.delete(c));
            else COMBAT_COLUMNS.forEach(c => next.add(c));
            return Array.from(next);
          })}>Combat</button>
        </div>
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
          Commandants:
          <select
            multiple
            value={filterProprios}
            onChange={e => {
              const vals = Array.from(e.currentTarget.selectedOptions).map(o => o.value);
              setFilterProprios(vals);
              setPage(1);
            }}
            style={{ marginLeft: 6, minWidth: 140 }}
          >
            {commandantOptions.map(id => (
              <option key={id} value={String(id)}>{commandantAsString(global, id)}</option>
            ))}
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
              {visibleColumns.includes('pos') && header('pos', 'Position')}
              {visibleColumns.includes('nom') && header('nom', 'Nom')}
              {visibleColumns.includes('direction') && header('direction', 'Direction')}
              {visibleColumns.includes('directive') && header('directive', 'Directive')}
              {visibleColumns.includes('vitesse') && header('vitesse', 'Vitesse')}
              {visibleColumns.includes('as') && header('as', 'AS')}
              {visibleColumns.includes('ap') && header('ap', 'AP')}
              {visibleColumns.includes('dc') && header('dc', 'D.C.')}
              {visibleColumns.includes('db') && header('db', 'D.B.')}
              {visibleColumns.includes('shield') && header('shield', 'Bouclier')}
              {visibleColumns.includes('cdt') && header('cdt', 'CdT')}
              {visibleColumns.includes('cdt3') && header('cdt3', 'CdT3')}
              {visibleColumns.includes('cdt7') && header('cdt7', 'CdT7')}
              {visibleColumns.includes('cases') && header('cases', 'Cases')}
              {visibleColumns.includes('shieldPerCase') && header('shieldPerCase', 'Boucl./Case')}
              {visibleColumns.includes('dcPerCase') && header('dcPerCase', 'D.C./Case')}
              {visibleColumns.includes('dbPerCase') && header('dbPerCase', 'D.B./Case')}
              {visibleColumns.includes('exp') && header('exp', 'Exp')}
              {visibleColumns.includes('moral') && header('moral', 'Moral')}
              {visibleColumns.includes('equipage') && header('equipage', 'Equipage')}
              {visibleColumns.includes('heros') && header('heros', 'Héros')}
              {visibleColumns.includes('nbv') && header('nbv', 'Vaisseaux')}
              {visibleColumns.includes('proprio') && header('proprio', 'Propriétaire')}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((f: any, i) => (
              <tr key={`${f.type}-${f.num}-${i}`}>
                {visibleColumns.includes('pos') && <td style={{ whiteSpace: 'nowrap' }}><Position pos={f.pos} /></td>}
                {visibleColumns.includes('nom') && <td>{f.nom}</td>}
                {visibleColumns.includes('direction') && <td><Position pos={f.direction} /></td>}
                {visibleColumns.includes('directive') && (
                  <td style={{ fontWeight: 'bold' }}>
                    {f.directive !== undefined && DIRECTIVE_LABELS[f.directive as number] ? (
                      <span style={{ color: DIRECTIVE_COLORS[f.directive as number] || '#ccc' }}>
                        {DIRECTIVE_LABELS[f.directive as number]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                {visibleColumns.includes('vitesse') && <td style={{ textAlign: 'right' }}>{f.vitesse ?? '—'}</td>}
                {visibleColumns.includes('as') && <td style={{ textAlign: 'right' }}>{f.as ?? '—'}</td>}
                {visibleColumns.includes('ap') && <td style={{ textAlign: 'right' }}>{f.ap ?? '—'}</td>}
                {visibleColumns.includes('dc') && <td style={{ textAlign: 'right' }}>{f.dc?.toFixed(1) ?? '—'}</td>}
                {visibleColumns.includes('db') && <td style={{ textAlign: 'right' }}>{f.db?.toFixed(1) ?? '—'}</td>}
                {visibleColumns.includes('shield') && <td style={{ textAlign: 'right' }}>{f.shield ?? '—'}</td>}
                {visibleColumns.includes('cdt') && <td style={{ textAlign: 'right' }}>
                  {f.cdt > 0 ? Math.round(f.cdt * 100) : 'N/A'}
                </td>}
                {visibleColumns.includes('cdt3') && <td style={{ textAlign: 'right' }}>
                  {f.cdt3 > 0 ? Math.round(f.cdt3 * 100) : 'N/A'}
                </td>}
                {visibleColumns.includes('cdt7') && <td style={{ textAlign: 'right' }}>
                  {f.cdt7 > 0 ? Math.round(f.cdt7 * 100) : 'N/A'}
                </td>}
                {visibleColumns.includes('cases') && <td style={{ textAlign: 'right' }}>{f.cases ?? '—'}</td>}
                {visibleColumns.includes('shieldPerCase') && <td style={{ textAlign: 'right' }}>{f.shieldPerCase?.toFixed(1) ?? '—'}</td>}
                {visibleColumns.includes('dcPerCase') && <td style={{ textAlign: 'right' }}>{f.dcPerCase?.toFixed(1) ?? '—'}</td>}
                {visibleColumns.includes('dbPerCase') && <td style={{ textAlign: 'right' }}>{f.dbPerCase?.toFixed(1) ?? '—'}</td>}
                {visibleColumns.includes('exp') && <td style={{ textAlign: 'right' }}>{f.exp?.toFixed(0) ?? '—'}</td>}
                {visibleColumns.includes('moral') && <td style={{ textAlign: 'right' }}>{f.moral?.toFixed(0) ?? '—'}</td>}
                {visibleColumns.includes('equipage') && <td>
                  {f.equipage?.length > 0 ? (
                    f.equipage.map((e: { nom: string; couleur: string }, i: number) => (
                      <React.Fragment key={i}>
                        <span style={{ color: e.couleur }}>{e.nom}</span>
                        {i < f.equipage.length - 1 && ', '}
                      </React.Fragment>
                    ))
                  ) : 'N/A'}
                </td>}
                {visibleColumns.includes('heros') && <td>{f.heros ?? ''}</td>}
                {visibleColumns.includes('nbv') && <td style={{ textAlign: 'right' }}>{f.nbv ?? '—'}</td>}
                {visibleColumns.includes('proprio') && <td style={{ textAlign: 'right' }}><Commandant num={f.proprio || 0} /></td>}
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={20} style={{ textAlign: 'center', padding: 12, color: '#aaa' }}>
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
