import React, { useMemo } from 'react';
import { useReport } from '../../context/ReportContext';
import { XY } from '../../types';

type Props = {
  selected?: XY;
};

export default function InfoPanel({ selected }: Props) {
  const { rapport, global } = useReport();

  const atPos = useMemo(() => {
    if (!selected || !rapport) return { systems: [], fleets: [] as any[] };
    const systems = [
      ...rapport.systemesJoueur.filter(s => s.pos.x === selected.x && s.pos.y === selected.y),
      ...rapport.systemesDetectes.filter(s => s.pos.x === selected.x && s.pos.y === selected.y),
    ];
    const fleets = [
      ...rapport.flottesJoueur.filter(f => f.pos.x === selected.x && f.pos.y === selected.y),
      ...rapport.flottesDetectees.filter(f => f.pos.x === selected.x && f.pos.y === selected.y),
    ];
    return { systems, fleets };
  }, [selected, rapport]);

  if (!selected) {
    return <div className="carte-info">Cliquez sur une case de la carte pour voir le détail.</div>;
  }

  return (
    <div className="carte-info">
      <div className="info-block">
        <h3>Case {selected.x}-{selected.y}</h3>
      </div>

      {atPos.systems.map((s: any, idx: number) => (
        <div className="info-block" key={`sys-${idx}`}>
          <h4>Système: {s.nom}</h4>
          <div>Type d'étoile: {s.typeEtoile}</div>
          <div>Propriétaires: {Array.isArray(s.proprietaires) ? s.proprietaires.join(', ') : '—'}</div>
          {'nombrePla' in s && <div>Planètes: {s.nombrePla}</div>}
          {'planetes' in s && s.planetes?.length > 0 && (
            <div>
              <h5>Planètes</h5>
              <ul>
                {s.planetes.map((p: any) => (
                  <li key={p.num}>
                    n°{p.num} — PDC: {p.pdc}
                    {typeof p.proprietaire !== 'undefined' && <> — Proprio planète: {p.proprietaire}</>}
                    {typeof p.minerai !== 'undefined' && <> — Minerai: {p.minerai}</>}
                    {p.batiments?.length > 0 && (
                      <div>
                        Bâtiments:
                        <ul>
                          {p.batiments.map((b: any, i: number) => {
                            const tech = global?.technologies.find(t => t.code === b.techCode);
                            const details = tech?.caracteristiques.map(c => {
                              const label = tech?.type === 1 ? global?.caracteristiquesComposant[c.code] : global?.caracteristiquesBatiment[c.code];
                              return `${label ?? c.code}: ${c.value}`;
                            }).join(', ');
                            return (
                              <li key={i} title={`${tech?.description ?? ''}\n${details ?? ''}`}>
                                {tech?.nom ?? b.techCode} × {b.count}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {p.populations?.length > 0 && (
                      <div>
                        Populations:
                        <ul>
                          {p.populations.map((pop: any, k: number) => {
                            const raceName = global?.races.find(r => r.id === pop.raceId)?.nom ?? `Race ${pop.raceId}`;
                            return <li key={k}>{raceName}: {pop.nb}</li>;
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {atPos.fleets.length > 0 && (
        <div className="info-block">
          <h4>Flottes</h4>
          <ul>
            {atPos.fleets.map((f: any, i: number) => (
              <li key={i}>
                {f.nom} {f.puiss ? `(puissance: ${f.puiss})` : ''}{' '}
                {f.vaisseaux ? (
                  <ul>
                    {f.vaisseaux.map((v: any, j: number) => (
                      <li key={j}>{v.type} {v.nb ? `× ${v.nb}` : ''} {v.puissance ? `— P: ${v.puissance}` : ''}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
