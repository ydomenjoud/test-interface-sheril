import React, { useRef } from 'react';
import { useReport } from '../context/ReportContext';
import Commandant from "./utils/Commandant";

export default function Header() {
  const { rapport, loadRapportFile, ready, setCenter } = useReport();
  const rapportInput = useRef<HTMLInputElement>(null);

  return (
    <header className="app-header">
      <div className="header-title">Interface Sheril</div>
      <div>
          <Commandant num={rapport?.joueur.numero} />
      </div>
      <button
        className="badge"
        onClick={() => { if (rapport?.joueur.capitale) setCenter(rapport.joueur.capitale); }}
        title="Centrer sur la capitale"
        style={{ cursor: rapport?.joueur.capitale ? 'pointer' : 'not-allowed' }}
      >
        Capitale: {rapport?.joueur.capitale ? `${rapport.joueur.capitale.x}-${rapport.joueur.capitale.y}` : '—'}
      </button>
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
