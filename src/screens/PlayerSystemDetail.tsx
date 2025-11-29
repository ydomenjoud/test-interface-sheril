// import React, { useMemo, useState } from 'react';
import { useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import { Planete } from '../types';
import { atmospheresNameList, maxPopulationByRace, planetTerraformationCost } from '../utils/planet';
import { useParams } from 'react-router-dom';
import Position from '../components/utils/Position';
import Commandant from '../components/utils/Commandant';

export default function PlayerSystemDetail() {
  const { rapport, global } = useReport();

  const { key } = useParams();

  const races = useMemo(() => {
    // No Koros
    return (global?.races || []).filter(r => r.id !== 6)
  }, [global])
  const currentId = useMemo(() => rapport?.joueur.numero, [rapport]);

  const selectedSystem = useMemo(() => rapport?.systemesJoueur?.find((s) => key === `${s.pos.x}-${s.pos.y}`), [rapport, key]);

  const [selectedPlanet, setSelectedPlanet] = useState<Planete | undefined>();
  const [isShowOwnedOnly, setIsShowOwnedOnly] = useState<boolean>(true);

  const planetsList = useMemo(() => (selectedSystem?.planetes || [])
    .filter(planet => !isShowOwnedOnly || planet.proprietaire === currentId),
    [selectedSystem, isShowOwnedOnly, currentId]);

  const [terraformationOffset, setTerraformationInput] = useState<number>(0);

  const terraformationCost = useMemo(() => {
    if (!selectedPlanet) {
      return 0;
    }
    return planetTerraformationCost(selectedPlanet.terraformation, terraformationOffset)
  }, [selectedPlanet, terraformationOffset])

  const systemTerraformationCost = useMemo<number>(() => {
    if (terraformationOffset === 0) {
      return 0;
    }
    return planetsList.filter(planet => planet.proprietaire === currentId)
      .reduce((systemSum, planet) => systemSum + planetTerraformationCost(planet.terraformation, terraformationOffset), 0);
  }, [terraformationOffset, planetsList, currentId])

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>

      <h3>Système {selectedSystem && <span> {selectedSystem.nom} <Position pos={selectedSystem.pos}></Position></span>}</h3>

      <label htmlFor="ownedOnly">
        Afficher seulement les planètes possédées
        <input name='ownedOnly' type='checkbox' value={'hey'} checked={isShowOwnedOnly} onChange={e => { setIsShowOwnedOnly(e.target.checked) }} />
      </label>

      <label htmlFor="terraform">
        Simulation de terraformation + {terraformationOffset}
      </label>
      <span>coût de la terraformation du système : {systemTerraformationCost}</span>
      <input style={{ maxWidth: 500 }} name='terraform' type='range' step={1} min={0} max={100} value={terraformationOffset} onChange={e => setTerraformationInput(e.target.valueAsNumber)} />


      <table className='tech-table'>
        <thead>
          <th>Planète</th>
          <th>Propriétaire</th>
          {races.map(r => <th colSpan={2} className={'race' + r.id}>{r.nom}</th>)}
          <th></th>
        </thead>
        <tbody>
          {planetsList.length > 0 && planetsList.map((planet) => <>
            <tr>
              <td>{planet.num + 1}</td>
              <td><Commandant num={planet.proprietaire} /></td>
              {races.map(race => {
                const raceClass = 'race' + race.id
                // Aucun niveau de terraformation ne rendra la planète vivable.
                if (planet.gravity < race.graviteSupporte.min || planet.gravity > race.graviteSupporte.max) {
                  return <>
                    <td className={raceClass}>-</td>
                    <td className={raceClass}>-</td>
                  </>
                }

                if (planet.populations[0]?.raceId === race.id) {
                  return <>
                    <td className={raceClass}>{planet.populations[0].nb + 1}</td>
                    <td className={raceClass}>
                      {planet.populations[0].max}
                      {terraformationOffset > 0 && <>&nbsp;({maxPopulationByRace(race, planet, terraformationOffset)})</>}
                    </td>
                  </>
                }
                return <>
                  <td className={raceClass}>0</td>
                  <td className={raceClass}>
                    {maxPopulationByRace(race, planet)}
                    {terraformationOffset > 0 && <>&nbsp;({maxPopulationByRace(race, planet, terraformationOffset)})</>}
                  </td>
                </>
              })
              }
              <td>
                {planet === selectedPlanet
                  ? <button onClick={() => setSelectedPlanet(undefined)}>cacher</button>
                  : <button onClick={() => setSelectedPlanet(planet)}>détails</button>
                }
              </td>
            </tr>
            {planet === selectedPlanet &&
              <tr>
                <td>{planet.num}</td>
                <td colSpan={14}>
                  <ul>
                    <li>Atmosphère: {atmospheresNameList[selectedPlanet.atmosphere]}</li>
                    <li>Radiations: {selectedPlanet.radiation}mR</li>
                    <li>Température: {selectedPlanet.temperature}°C</li>
                    <li>Gravité: {selectedPlanet.gravity}g</li>
                    <li>
                      Terraformation: {selectedPlanet.terraformation}
                      {terraformationOffset > 0 && <span>
                        ({selectedPlanet.terraformation + terraformationOffset}, cost: {terraformationCost})
                      </span>
                      }
                    </li>
                    {/* Ajouter d'autres infos par planètes */}
                  </ul>
                </td>
              </tr>
            }
          </>)}
        </tbody>
        <tfoot></tfoot>
      </table>

      {/* {selectedPlanet ? populationTables() : null} */}
    </div>
  )
}

