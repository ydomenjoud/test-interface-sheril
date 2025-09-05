import React from 'react';
import { useReport } from '../context/ReportContext';

export default function ListeSystemes() {
  const { rapport } = useReport();
  if (!rapport) return <div style={{ padding: 16 }}>Chargez les données pour voir la liste des systèmes.</div>;
  return (
    <div style={{ padding: 12, overflow: 'auto', width: '100%' }}>
      <h3>Systèmes du joueur</h3>
      <ul>
        {rapport.systemesJoueur.map((s, i) => (
          <li key={`sj-${i}`}>
            {s.nom} — {s.pos.x}-{s.pos.y} — {s.nombrePla} planètes — étoile {s.typeEtoile}
            {s.proprietaires?.length ? ` — commandants: ${s.proprietaires.join(', ')}` : ''}
          </li>
        ))}
      </ul>
      <h3>Systèmes détectés</h3>
      <ul>
        {rapport.systemesDetectes.map((s, i) => (
          <li key={`sd-${i}`}>
            {s.nom} — {s.pos.x}-{s.pos.y} — {s.nbPla} planètes — étoile {s.typeEtoile} — proprio: {s.proprietaires.join(', ') || '—'}
          </li>
        ))}
      </ul>
    </div>
  );
}
