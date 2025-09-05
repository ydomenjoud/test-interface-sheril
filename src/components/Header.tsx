import React, { useRef } from 'react';
import { useReport } from '../context/ReportContext';

export default function Header() {
  const { rapport, loadRapportFile, ready } = useReport();
  const rapportInput = useRef<HTMLInputElement>(null);

  return (
    <header className="app-header">
      <div className="header-title">4X Interface</div>
      <div className="badge">Joueur: {rapport?.joueur.nom ?? '—'}</div>
      <div className="badge">Race: {rapport?.joueur.raceId ?? '—'}</div>
      <div className="badge">Capitale: {rapport?.joueur.capitale ? `${rapport.joueur.capitale.x}-${rapport.joueur.capitale.y}` : '—'}</div>
      <div className="header-spacer" />
      <input
        ref={rapportInput}
        type="file"
        accept=".xml"
        onChange={async (e) => {
          const f = e.currentTarget?.files?.[0];
          // On capture la ref AVANT l'await pour éviter tout souci avec l'event
          const inputEl = rapportInput.current;
          if (f) {
            await loadRapportFile(f);
          }
          if (inputEl) inputEl.value = '';
        }}
        title="Charger rapport.xml"
      />
      <button
        onClick={async () => {
          const txt = await fetch('/examples/rapport.xml').then(r => r.text());
          const file = new File([txt], 'rapport.xml', { type: 'text/xml' });
          await loadRapportFile(file);
          if (rapportInput.current) rapportInput.current.value = '';
        }}
      >
        Charger exemple de rapport
      </button>
      <span className="badge">{ready ? 'Données prêtes' : 'En attente des données'}</span>
    </header>
  );
}
