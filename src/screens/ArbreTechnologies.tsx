import React, { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import TechTreeCanvas from '../components/TechTree/TechTreeCanvas';
import { Technologie } from '../types';

function toRoman(n: number): string {
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  if (n <= 0) return romans[0];
  if (n >= romans.length) return romans[romans.length - 1];
  return romans[n];
}
function romanFromNiv(niv?: number): string {
  const lvl = Math.max(1, Math.min(10, ((niv ?? 0) + 1)));
  return toRoman(lvl);
}
function formatTechName(t?: Technologie): string {
  if (!t) return '';
  return `${t.nom} ${romanFromNiv(t.niv)}`;
}

export default function ArbreTechnologies() {
  const { global, rapport } = useReport();
  const [selectedCode, setSelectedCode] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [parentsDepth, setParentsDepth] = useState<number>(2);
  const [childrenDepth, setChildrenDepth] = useState<number>(2);

  const knownSet = useMemo(() => {
    const s = new Set<string>();
    (rapport?.technologiesConnues ?? []).forEach(c => s.add(c.toLowerCase()));
    return s;
  }, [rapport]);

  const techs = useMemo(() => global?.technologies ?? [], [global]);

  // Initial: pour chaque "base", garder la techno connue avec le plus petit niveau
  const initialCodes = useMemo(() => {
    const byBase = new Map<string, Technologie>();
    const techByCode = new Map<string, Technologie>();
    techs.forEach(t => techByCode.set(t.code, t));
    (rapport?.technologiesConnues ?? []).forEach(code => {
      const t = techByCode.get(code);
      if (!t) return;
      const prev = byBase.get(t.base);
      if (!prev || t.niv < prev.niv) {
        byBase.set(t.base, t);
      }
    });
    return Array.from(byBase.values()).map(t => t.code);
  }, [techs, rapport]);

  const techByCode = useMemo(() => {
    const m = new Map<string, Technologie>();
    techs.forEach(t => m.set(t.code, t));
    return m;
  }, [techs]);

  const options = useMemo(() => {
    return techs.map(t => ({
      code: t.code,
      label: `${formatTechName(t)} — ${t.code}`,
    }));
  }, [techs]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    // Chercher par code exact, sinon par nom contient
    const byCode = techByCode.get(query);
    if (byCode) {
      setSelectedCode(byCode.code);
      return;
    }
    const found = techs.find(t => (t.nom?.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)));
    if (found) {
      setSelectedCode(found.code);
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'hidden', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0 }}>Arbre technologique</h3>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ flex: 1, minWidth: 280 }}>
          Rechercher une technologie:
          <input
            type="text"
            list="tech-search-list"
            placeholder="Nom ou code…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // le submit gère
              }
            }}
            style={{ marginLeft: 6, width: '100%' }}
          />
        </label>
        <datalist id="tech-search-list">
          {options.slice(0, 500).map(o => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </datalist>
        <label title="Nombre de colonnes d’ancêtres à afficher (à gauche)">
          Profondeur parents:
          <input
            type="number"
            min={0}
            max={8}
            value={parentsDepth}
            onChange={e => setParentsDepth(Math.max(0, Math.min(8, Number(e.target.value))))}
            style={{ width: 64, marginLeft: 6 }}
          />
        </label>
        <label title="Nombre de colonnes d’enfants à afficher (à droite)">
          Profondeur enfants:
          <input
            type="number"
            min={0}
            max={8}
            value={childrenDepth}
            onChange={e => setChildrenDepth(Math.max(0, Math.min(8, Number(e.target.value))))}
            style={{ width: 64, marginLeft: 6 }}
          />
        </label>
        <button type="submit">Aller</button>
        {selectedCode && (
          <button type="button" onClick={() => setSelectedCode(undefined)}>Réinitialiser</button>
        )}
        <span style={{ color: '#9aa2b1', fontSize: 12 }}>
          Parents: orange • Enfants: bleu • Clic gauche + déplacement pour se déplacer • Molette: zoom
        </span>
      </form>

      <div style={{ flex: 1, minHeight: 0 }}>
        <TechTreeCanvas
          techs={techs}
          knownCodes={knownSet}
          selectedCode={selectedCode}
          onSelect={(c) => setSelectedCode(c)}
          initialCodes={initialCodes}
          parentsDepth={parentsDepth}
          childrenDepth={childrenDepth}
        />
      </div>
    </div>
  );
}
