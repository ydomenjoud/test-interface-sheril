import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import { Technologie } from '../types';
import SearchableSelect from '../components/utils/SearchableSelect';

type Entry = { code: string; qty: number };

export default function CreatePlan() {
  const { global } = useReport();

  const compTechs = useMemo(() => {
    const list = (global?.technologies ?? []).filter(t => t.type === 1);
    // garder uniquement celles avec une specification.case (composants pertinents)
    return list.filter(t => (t.specification?.case ?? 0) > 0);
  }, [global]);

  const techByCode = useMemo(() => {
    const map = new Map<string, Technologie>();
    compTechs.forEach(t => map.set(t.code, t));
    return map;
  }, [compTechs]);

  // Code de caractéristique pour "propulsion"
  const propulsionCode = useMemo(() => {
    const dict = global?.caracteristiquesComposant || {};
    let code = 0;
    for (const [k, v] of Object.entries(dict)) {
      if ((v || '').toLowerCase() === 'propulsion') {
        code = Number(k);
        break;
      }
    }
    return code; // par défaut 0 si non trouvé
  }, [global]);

  const [selectedCode, setSelectedCode] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [entries, setEntries] = useState<Entry[]>([]);

  function addEntry() {
    const code = selectedCode || compTechs[0]?.code;
    if (!code) return;
    const qty = Math.max(1, Math.floor(selectedQty || 1));
    setEntries(prev => {
      const idx = prev.findIndex(e => e.code === code);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { code, qty }];
    });
  }
  function setQty(code: string, qty: number) {
    setEntries(prev => prev.map(e => e.code === code ? { ...e, qty: Math.max(0, Math.floor(qty || 0)) } : e));
  }
  function remove(code: string) {
    setEntries(prev => prev.filter(e => e.code !== code));
  }

  // Calculs
  const totals = useMemo(() => {
    let totalCase = 0;
    let totalMinerai = 0;
    let totalPrix = 0;
    const marchTotals = new Map<number, number>();
    let propulsionMax = 0;

    for (const e of entries) {
      const t = techByCode.get(e.code);
      if (!t || e.qty <= 0) continue;
      const s = t.specification || {};
      const unitCase = s.case ?? 0;
      const unitMin = s.min ?? 0;
      const unitPrix = s.prix ?? 0;

      totalCase += unitCase * e.qty;
      totalMinerai += unitMin * e.qty;
      totalPrix += unitPrix * e.qty;

      // propulsion: on prend la plus grande valeur présente
      const propVal = (t.caracteristiques || []).find(c => c.code === propulsionCode)?.value ?? 0;
      if (propVal > propulsionMax) propulsionMax = propVal;

      // marchandises par composant
      for (const m of (t.marchandises ?? [])) {
        marchTotals.set(m.code, (marchTotals.get(m.code) || 0) + m.nb * e.qty);
      }
    }

    // Taille / vitesse selon règles
    let taille = undefined as number | undefined;
    let baseSpeed = 0;
    if (global?.tailleVaisseaux?.length) {
      const found = global.tailleVaisseaux.find(r => totalCase >= r.minCase && (r.maxCase === 0 || totalCase <= r.maxCase));
      const rule = found ?? global.tailleVaisseaux[global.tailleVaisseaux.length - 1];
      if (rule) {
        taille = rule.taille;
        baseSpeed = rule.vitesse ?? 0;
      }
    }

    // Vitesse finale: si aucune propulsion, 0 ; sinon base + max propulsion
    const vitesse = propulsionMax > 0 ? baseSpeed + propulsionMax : 0;

    return { totalCase, totalMinerai, totalPrix, marchTotals, taille, baseSpeed, propulsionMax, vitesse };
  }, [entries, techByCode, global, propulsionCode]);

  const marchList = useMemo(() => {
    const out: { code: number; nom: string; nb: number }[] = [];
    totals.marchTotals.forEach((nb, code) => {
      const nom = global?.marchandises.find(m => m.code === code)?.nom ?? String(code);
      out.push({ code, nom, nb });
    });
    out.sort((a, b) => a.code - b.code);
    return out;
  }, [totals.marchTotals, global]);

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3>Créer un plan de vaisseau</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ marginBottom: 4 }}>Composant:</div>
          <SearchableSelect
            options={compTechs.map(t => ({
              value: t.code,
              label: `${t.nom} (${t.code}) — ${t.specification?.case ?? 0} case, min ${t.specification?.min ?? 0}, prix ${t.specification?.prix ?? 0}`
            }))}
            value={selectedCode}
            onChange={setSelectedCode}
            placeholder="Rechercher un composant…"
            style={{ minWidth: 380 }}
          />
        </div>
        <label>
          Quantité:
          <input
            type="number"
            min={1}
            value={selectedQty}
            onChange={e => setSelectedQty(parseInt(e.target.value || '1', 10))}
            style={{ width: 80, marginLeft: 6 }}
          />
        </label>
        <button onClick={addEntry} disabled={compTechs.length === 0 && !selectedCode}>Ajouter</button>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Composant</th>
              <th style={{ textAlign: 'right' }}>Case</th>
              <th style={{ textAlign: 'right' }}>Minerai</th>
              <th style={{ textAlign: 'right' }}>Prix</th>
              <th>Marchandises (unité)</th>
              <th style={{ textAlign: 'right' }}>Qté</th>
              <th style={{ textAlign: 'right' }}>Case tot.</th>
              <th style={{ textAlign: 'right' }}>Minerai tot.</th>
              <th style={{ textAlign: 'right' }}>Prix tot.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
              const t = techByCode.get(e.code);
              if (!t) return null;
              const s = t.specification || {};
              const unitCase = s.case ?? 0;
              const unitMin = s.min ?? 0;
              const unitPrix = s.prix ?? 0;
              const marchUnit = (t.marchandises ?? []).map((m, i) => {
                const nom = global?.marchandises.find(mm => mm.code === m.code)?.nom ?? String(m.code);
                return <span key={i} className="badge">{nom}: <span className="information">{m.nb}</span></span>;
              });

              return (
                <tr key={e.code}>
                  <td>{t.nom}</td>
                  <td style={{ textAlign: 'right' }}>{unitCase}</td>
                  <td style={{ textAlign: 'right' }}>{unitMin}</td>
                  <td style={{ textAlign: 'right' }}>{unitPrix}</td>
                  <td style={{ whiteSpace: 'normal' }}>{marchUnit.length ? marchUnit : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      type="number"
                      min={0}
                      value={e.qty}
                      onChange={ev => setQty(e.code, parseInt(ev.target.value || '0', 10))}
                      style={{ width: 80 }}
                    />

                  </td>
                  <td style={{ textAlign: 'right' }}>{unitCase * e.qty}</td>
                  <td style={{ textAlign: 'right' }}>{unitMin * e.qty}</td>
                  <td style={{ textAlign: 'right' }}>{(unitPrix * e.qty).toFixed(1)}</td>
                  <td>
                    <button onClick={() => remove(e.code)} title="Retirer ce composant" style={{ marginLeft: 6 }}>Suppr.</button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 12, color: '#aaa' }}>
                  Ajoutez des composants pour composer votre plan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Taille: <b>{totals.taille ?? '—'}</b>
        </div>
        <div className="badge" style={{ background: '#123', color: '#ddd', display: 'flex', alignItems: 'center', gap: 8 }}>
          Vitesse: <b>{Number.isFinite(totals.vitesse) ? totals.vitesse : '—'}</b>
          {entries.length > 0 && totals.propulsionMax === 0 && (
            <span style={{ color: '#f0c040' }} title="Aucun composant de propulsion sélectionné — vitesse fixée à 0">
              ⚠ aucun moteur (vitesse 0)
            </span>
          )}
        </div>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Cases: <b>{totals.totalCase}</b>
        </div>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Minerai: <b>{totals.totalMinerai}</b>
        </div>
        <div className="badge" style={{ background: '#123', color: '#ddd' }}>
          Prix: <b>{totals.totalPrix.toFixed(1)}</b>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Marchandises totales</h4>
        {marchList.length === 0 ? (
          <div style={{ color: '#aaa' }}>Aucune marchandise requise.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {marchList.map(m => (
              <span key={m.code} className="badge">
                {m.nom}: <span className="information">{m.nb}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
