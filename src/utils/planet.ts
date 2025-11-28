// Bornes de vie des différentes races

import { Planete, Race } from "../types";

export const Atmospheres = [
    [3, 2, 2, 2, 2],
    [2, 2, 1, 1, 0],
    [0, 0, 0, 1, 2],
    [2, 2, 1, 2, 2],
    [-1, 0, 2, -1, -1],
    [-1, 0, 2, -1, -1]
]
export const atmospheresNameList = [
    'idéale',
    'vivifiante',
    'classique',
    'toxique',
    'très toxique',
];


export function planetTerraformationCost(currentLevel: number, offset: number = 0) {
    offset = Math.max(offset,0);

    // coût terraformation n => 50 + 2*n
    return (new Array(offset)
      .fill(currentLevel)
      .map<number>((v, index) => 50 + (v + index + 1) * 2)
      .reduce((sum, levelCost) => sum + levelCost, 0));
}


export function maxPopulationByRace({id, graviteSupporte, radiationSupporte, temperatureSupporte}: Race, {terraformation, radiation: radiation, temperature, gravity, size, atmosphere}: Planete, offset: number = 0): number {
    terraformation = Math.max(terraformation + offset, 0);
    
    if ([
        radiation < (-2 * terraformation + radiationSupporte.min),
        radiation > (2 * terraformation + radiationSupporte.max),
        temperature < (-2 * terraformation + temperatureSupporte.min),
        temperature  > (2 * terraformation + temperatureSupporte.max),
        gravity < graviteSupporte.min,
        gravity  > graviteSupporte.max,
    ].some(v => v)) {
        return 0;
    }
    
	const radiationFactor = 1 - (1000 * (radiation - (-2 * terraformation + radiationSupporte.min)) * (radiation - (2 * terraformation + radiationSupporte.max)))
					/ (Math.pow(2 * terraformation, 2) + Math.pow(radiationSupporte.min - radiationSupporte.max, 2));

	const temperatureFactor = 1 - (1000 * (temperature - (-2 * terraformation + temperatureSupporte.min)) * (temperature - (2 * terraformation + temperatureSupporte.max)))
					/ (Math.pow(2 * terraformation, 2) + Math.pow(temperatureSupporte.min - temperatureSupporte.max, 2));

	const gravityFactor = 1 - (1000 * (gravity - graviteSupporte.min) * (gravity - graviteSupporte.max))
					/ (Math.pow(graviteSupporte.min - graviteSupporte.max, 2));

                    
    const maxPop = Math.floor((( (Math.floor(radiationFactor) + Math.floor(temperatureFactor) + Math.floor(gravityFactor)) * 2 * size + Atmospheres[id][atmosphere] * 100 * size) * 9 / 10));
    console.log({radiationFactor, temperatureFactor, gravityFactor, maxPop});
    return Math.max(
        maxPop, 10
    );
} 