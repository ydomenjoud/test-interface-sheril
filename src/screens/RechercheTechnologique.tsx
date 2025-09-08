import React, {useMemo, useState} from 'react';
import {useReport} from '../context/ReportContext';
import SearchableSelect from "../components/utils/SearchableSelect";
import {formatTechName} from "../utils/global";

type Assign = { code: string; amount: number };

export default function RechercheTechnologique() {
  const { global, rapport } = useReport();

  const knownSet = useMemo(() => {
    const set = new Set<string>();
    (rapport?.technologiesConnues ?? []).forEach(c => set.add(c.toLowerCase()));
    return set;
  }, [rapport]);

  // Techs atteignables = non connues dont tous les parents sont connus
  const atteignables = useMemo(() => {
    const list = (global?.technologies ?? []);
    return list.filter(t => {
      if (!t.code) return false;
      if (knownSet.has(t.code)) return false;
      const parents = t.parents || [];
        return parents.every(p => knownSet.has(p.toLowerCase()));
    }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [global, knownSet]);

  // Assignations
  const [assigns, setAssigns] = useState<Assign[]>([    ]);
  const [selectedCode, setSelectedCode] = useState<string>('');

  function addAssign() {
    const code = selectedCode || atteignables[0]?.code;
    if (!code) return;
    if (assigns.some(a => a.code === code)) return;
    const t = (global?.technologies ?? []).find(tt => tt.code === code);
    const def = t?.recherche ?? 0;
    setAssigns(prev => [...prev, { code, amount: def }]);
    setSelectedCode('');
  }
  function setAmount(code: string, val: number) {
    setAssigns(prev => prev.map(a => a.code === code ? { ...a, amount: Math.max(0, Number.isFinite(val) ? val : 0) } : a));
  }
  function remove(code: string) {
    setAssigns(prev => prev.filter(a => a.code !== code));
  }

  const budget = Math.max(0, rapport?.budgetTechnologique ?? 0);
  const totalAllocated = assigns.reduce((s, a) => s + (a.amount || 0), 0);
  const percent = budget > 0 ? Math.min(100, Math.ceil((totalAllocated / budget) * 100)) : 0;

  const rows = assigns.map(a => {
    const t = (global?.technologies ?? []).find(tt => tt.code === a.code);
    const amount = a.amount || 0;
    const rowPct = budget > 0 ? Math.min(100, Math.ceil((amount / budget) * 100)) : 0;
    return { a, t, rowPct };
  });

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3>Recherche technologique</h3>

      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Budget: <b>{budget.toFixed(1)}</b>
        </div>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Alloué: <b>{totalAllocated.toFixed(1)}</b>
        </div>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Reste: <b>{Math.max(0, budget - totalAllocated).toFixed(1)}</b>
        </div>
        <div className="badge" style={{ background: '#235', color: '#ddd' }}>
          % alloué: <b>{percent}%</b>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ marginBottom: 4 }}>Technologie atteignable:</div>
            <SearchableSelect
              options={atteignables.map(t => ({
                value: t.code,
                label: `${formatTechName(t)} — coût recherche: ${t.recherche}`
              }))}
              value={selectedCode}
              onChange={setSelectedCode}
              placeholder="Rechercher une technologie…"
              style={{ minWidth: 380 }}
            />
          </div>
        <button onClick={addAssign} disabled={atteignables.length === 0 || (selectedCode && assigns.some(a => a.code === selectedCode)) || false}>
          Ajouter
        </button>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Technologie</th>
              <th style={{ textAlign: 'right' }}>Coût recherche</th>
              <th style={{ textAlign: 'right' }}>Montant affecté</th>
              <th style={{ textAlign: 'right' }}>% budget</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, t, rowPct }) => (
              <tr key={a.code}>
                <td>{t?.nom ?? a.code}</td>
                <td style={{ textAlign: 'right' }}>{t?.recherche ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    type="number"
                    min={0}
                    max={t?.recherche || 0}
                    value={a.amount}
                    onChange={e => setAmount(a.code, parseFloat(e.target.value || '0'))}
                    style={{ width: 120, textAlign: 'right' }}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>{rowPct}%</td>
                <td>
                  <button onClick={() => remove(a.code)}>Supprimer</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 12, color: '#aaa' }}>
                  Ajoutez une technologie atteignable pour répartir le budget.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
