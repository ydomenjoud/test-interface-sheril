import React from 'react';
import { useReport } from '../context/ReportContext';

export default function ListeFlottes() {
  const { rapport } = useReport();
  if (!rapport) return <div style={{ padding: 16 }}>Chargez les données pour voir la liste des flottes.</div>;
  return (
    <div style={{ padding: 12, overflow: 'auto', width: '100%' }}>
      <h3>Flottes du joueur</h3>
      <ul>
        {rapport.flottesJoueur.map((f, i) => (
          <li key={`fj-${i}`}>
            {f.nom} — #{f.num} — {f.pos.x}-{f.pos.y}
            {f.vaisseaux?.length ? (
              <ul>
                {f.vaisseaux.map((v, j) => <li key={j}>{v.type}</li>)}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <h3>Flottes détectées</h3>
      <ul>
        {rapport.flottesDetectees.map((f, i) => (
          <li key={`fd-${i}`}>{f.nom} — #{f.num} — {f.pos.x}-{f.pos.y} — proprio {f.proprio} — puissance {f.puiss}</li>
        ))}
      </ul>
    </div>
  );
}
