import React, {useMemo} from 'react';
import {useReport} from '../../context/ReportContext';
import {FlotteBase, FlotteDetectee, FlotteJoueur, XY} from '../../types';
import Commandant from "../utils/Commandant";
import Position from "../utils/Position";
import {getDescriptionPuissance, getPuissance, getPuissanceFromString} from "../../utils/puissance";

type Props = {
  selected?: XY;
};

export default function InfoPanel({ selected }: Props) {
  const { rapport } = useReport();

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

  const system = useMemo(() => {
    return atPos.systems[0];
  }, [atPos.systems]);

  if (!selected) {
    return <div className="carte-info">Cliquez sur une case de la carte pour voir le détail.</div>;
  }

  console.log({system})


  return (
    <div className="carte-info">
      <div className="info-block">
        <h3>Case <Position pos={selected} /></h3>
      </div>

      <div className="info-block">
        <h4>Systèmes</h4>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            <th>Nom</th>
            <th>Planètes</th>
            <th>Commandants</th>
          </tr>
          </thead>
          <tbody>
          {system ? (
            <tr>
              <td>{system.nom}</td>
              <td style={{ textAlign: 'right' }}>{system.nbPla ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>
                {Array.isArray(system.proprietaires) && system.proprietaires.length
                  ? system.proprietaires.map((p: number, key: number) => <Commandant num={p} key={key} />)
                  : '—'}
              </td>
            </tr>
          ) : (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucun système ici.</td></tr>
          )}
          </tbody>
        </table>
      </div>

      <div className="info-block">
        <h4>Flottes</h4>
        <table className="tech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
          <tr>
            <th>Nom</th>
            <th>Propriétaire</th>
            <th>Puissance</th>
          </tr>
          </thead>
          <tbody>
          {atPos.fleets.map((f: FlotteBase, i: number) => {
            const owner = (f as any).proprio ?? (rapport?.joueur?.numero ?? undefined);
            // const puissance = (f as any).puiss ?? ((typeof f.as === 'number') ? f.as : '—');
            let puissanceDesc = "";

            if(f.type === 'joueur') {
                const local = f as FlotteJoueur;
                const puissance = getPuissance(local);
                const p = getDescriptionPuissance(puissance);
                puissanceDesc = `AS: ${local.as}/ AP: ${local.ap} (${p})`;
            } else if (f.type === 'detecte') {
                const local = f as FlotteDetectee;
                puissanceDesc = `${getPuissanceFromString(local.puiss)} - ${local.puiss}`;

            }
            return (
              <tr key={`flt-${i}`}>
                <td>{f.nom} ({f.num+1})</td>
                <td style={{ textAlign: 'right' }}>
                  {typeof owner === 'number' ? <Commandant num={owner} /> : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>{puissanceDesc}</td>
              </tr>
            );
          })}
          {atPos.fleets.length === 0 && (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 8, color: '#aaa' }}>Aucune flotte ici.</td></tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
