// import React, { useMemo, useState } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import SearchableSelect from '../components/utils/SearchableSelect';
import { SystemeJoueur, XY } from '../types';
import { raceIndexToNameMap, racesEnumList } from "../utils/races";
import { atmospheresNameList, maxPopulationByRace } from '../utils/planet';

export default function Terraformation() {
  const { rapport, global } = useReport();

  const positonFormat = (pos: XY) => {
    const f = (n: number) => n.toString().padStart(2, '0');
    return `[${f(pos.x)}-${f(pos.y)}]`;
  }
  const playerSystems = useMemo(() => rapport?.systemesJoueur?.map(s => ({ ...s, code: positonFormat(s.pos) })) || [], [rapport]);

  const [selectedSystemCode, setSelectedSystem] = useState<string>('')

  const selectedSystem = useMemo(() => playerSystems.find(({ code }) => code === selectedSystemCode), [selectedSystemCode])

  const [selectedPlanetIndex, setSelectedPlanetIndex] = useState<number>(0);

  useEffect(() => {
    setSelectedPlanetIndex(0)
  }, [selectedSystemCode])

  const selectedPlanet = useMemo(() => (selectedSystem?.planetes?.[selectedPlanetIndex]), [selectedPlanetIndex, selectedSystem]);
  const [terraformationInput, setTerraformationInput] = useState<number>(0);

  useEffect(() => {
    setTerraformationInput(selectedPlanet?.terraformation || 0)
  }, [selectedPlanet])

  const terraformationCost = useMemo(() => {
    if (!selectedPlanet || terraformationInput <= selectedPlanet.terraformation) {
      return 0;
    }
    const difference = terraformationInput - selectedPlanet.terraformation

    // coût terraformation n => 50 + 2*n
    return (new Array(difference)
      .fill(selectedPlanet.terraformation)
      .map<number>((v, index) => 50 + (v + index + 1) * 2)
      .reduce((sum, levelCost) => sum + levelCost, 0));
  }, [selectedPlanet, terraformationInput])

  function populationTables() {
    if (!selectedPlanet) {
      return null;
    }

    const currentPopulation = selectedPlanet.populations.find(p => p.nb > 0);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '100px' }}>
          <div>
            <h4>Population actuelle</h4>
            <table className="tech-table">
              <thead>
                <th>Race</th>
                <th>Population</th>
                <th>Population Max</th>
              </thead>
              <tbody>
                <tr>
                  <td className={currentPopulation ? 'race'+currentPopulation.raceId : ''}>{currentPopulation ? raceIndexToNameMap.get(currentPopulation.raceId) : 'Aucune'}</td>
                  <td>{currentPopulation?.nb || 0}</td>
                  <td>{currentPopulation?.max || 0}</td>
                </tr>
              </tbody>
            </table>

          </div>
          <div>
            <h4>Caractéristiques de la planète</h4>
            <table className="tech-table">
              <thead>
                <th>Atmosphère</th>
                <th>Radiations</th>
                <th>Température</th>
                <th>Gravité</th>
                <th>Terraformation</th>
              </thead>
              <tbody>
                <tr>
                  <td>{atmospheresNameList[selectedPlanet.atmosphere]}</td>
                  <td>{selectedPlanet.radiation}mR</td>
                  <td>{selectedPlanet.temperature}°C</td>
                  <td>{selectedPlanet.gravity}g</td>
                  <td>{selectedPlanet.terraformation}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div>
            <label htmlFor="terraformationInput">Projection de terraformation : </label>
            <input name="terraformationInput" type='range' min={selectedPlanet.terraformation} max="100" onChange={(e) => setTerraformationInput(e.target.valueAsNumber)}></input>
          </div>
          <div style={{display: 'flex', gap: '15px' }}>
            <span>Niveau projeté: {terraformationInput}</span>
            <span>Nombre de tour: {Math.max(terraformationInput - selectedPlanet.terraformation, 0)}</span>
            <span>Coût pour l'atteindre: { terraformationCost }ce</span>
          </div>

          <table className="tech-table">
            <thead>
              <th>Race</th>
              <th>Population Max actuel </th>
              <th>Population Max Projeté</th>
            </thead>
            <tbody>
              {racesEnumList.map((raceId) => (
                <tr>
                  <td className={'race'+raceId}>{raceIndexToNameMap.get(raceId)}</td>
                  <td>{maxPopulationByRace(raceId, selectedPlanet)}</td>
                  <td>{maxPopulationByRace(raceId, {...selectedPlanet, terraformation: terraformationInput})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    )
  }


  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3>Terraformation</h3>

      {/* Barre de recherche */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ marginBottom: 4 }}>Système possédés:</div>
        <SearchableSelect
          options={playerSystems.map(s => ({
            value: s.code, label: `${s.code} - ${s.nom}`
          }))}
          value={selectedSystemCode}
          onChange={setSelectedSystem}
          placeholder="Sélectionner un système"
          style={{ minWidth: 380 }}
        />

        <div style={{ marginBottom: 4 }}>Planète:</div>
        <input 
          type='number'
          min="1" 
          max={(selectedSystem?.nbPla || 0) + 1 }
          value={selectedPlanetIndex + 1 }
          onChange={(e) => setSelectedPlanetIndex(e.target.valueAsNumber -1)}
          style={{ minWidth: 15 }}
        />
      </div>

      {selectedPlanet ? populationTables() : null}
    </div>
  )
}

