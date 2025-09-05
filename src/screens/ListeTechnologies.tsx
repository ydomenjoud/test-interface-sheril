import React from 'react';
import { useReport } from '../context/ReportContext';

export default function ListeTechnologies() {
  const { global } = useReport();
  if (!global) return <div style={{ padding: 16 }}>Chargement des données globales…</div>;
  return (
    <div style={{ padding: 12, overflow: 'auto', width: '100%' }}>
      <h3>Technologies</h3>
      <ul>
        {global.technologies.map((t, i) => (
          <li key={i} title={t.description ?? ''}>
            [{t.type === 0 ? 'Bâtiment' : 'Composant'}] {t.nom} (niv {t.niv}) — code {t.code} — recherche {t.recherche}
            {t.caracteristiques?.length ? (
              <ul>
                {t.caracteristiques.map((c, j) => {
                  const label = t.type === 1 ? global.caracteristiquesComposant[c.code] : global.caracteristiquesBatiment[c.code];
                  return <li key={j}>{label ?? c.code}: {c.value}</li>;
                })}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
