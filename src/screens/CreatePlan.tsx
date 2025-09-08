import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useReport } from '../context/ReportContext';
import { Technologie } from '../types';

type Entry = { code: string; qty: number };

// Sélecteur avec recherche intégrée (sans dépendance externe)
function SearchableSelect(props: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const { options, value, onChange, placeholder, style } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(() => options.find(o => o.value === value) || null, [options, value]);

  useEffect(() => {
    // suivi du label sélectionné dans l’input quand on ferme/ouvre
    if (!open && selected) setQuery(selected.label);
    if (!open && !selected) setQuery('');
  }, [open, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function commit(val: string) {
    onChange(val);
    setOpen(false);
    const sel = options.find(o => o.value === val);
    setQuery(sel?.label ?? '');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      setHighlight(h => Math.min(filtered.length - 1, h + 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlight(h => Math.max(0, h - 1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const opt = filtered[highlight];
      if (opt) commit(opt.value);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
      e.preventDefault();
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 320, ...style }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', border: '1px solid #555', borderRadius: 4, padding: '4px 8px',
          background: '#111', color: '#ddd', gap: 6
        }}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder || 'Choisir…'}
          value={open ? query : (selected?.label ?? '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={onKeyDown}
          style={{
            flex: 1, background: 'transparent', color: 'inherit', border: 'none', outline: 'none', minWidth: 0
          }}
        />
        <span style={{ opacity: 0.7 }}>▾</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 260, overflow: 'auto',
            background: '#0f0f10', border: '1px solid #444', borderRadius: 4, zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
          }}
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 8, color: '#aaa' }}>Aucun résultat</div>
          ) : filtered.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(o.value); }}
              style={{
                padding: '6px 8px',
                background: i === highlight ? '#1e2a44' : 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
              title={o.label}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
